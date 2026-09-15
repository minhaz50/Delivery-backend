import { prisma } from "../../lib/prisma";
import { cache } from "../../lib/redis";
import { config } from "../../config";
import { ServiceLevel } from "../../../generated/prisma";

export interface IPriceQuote {
  price: number;
  currency: string;
  breakdown: {
    baseFee: number;
    perKgFee: number;
    baseWeightKg: number;
    billableExtraKg: number;
    extraCharge: number;
    source: "EXACT_ZONE_PAIR" | "ORG_DEFAULT" | "PLATFORM_DEFAULT";
  };
}

const createRule = async (
  organizationId: string,
  payload: {
    fromZoneId?: string;
    toZoneId?: string;
    serviceLevel: ServiceLevel;
    baseFee: number;
    perKgFee: number;
    baseWeightKg: number;
  },
) => {
  const rule = await prisma.pricingRule.create({ data: { ...payload, organizationId } });
  await invalidatePricingCache(organizationId);
  return rule;
};

const getAllRules = async (organizationId: string) => {
  return prisma.pricingRule.findMany({
    where: { organizationId, isActive: true },
    include: { fromZone: true, toZone: true },
  });
};

/**
 * Resolves the price for a shipment. Lookup order, most to least specific:
 *   1. Exact zone-pair rule for the requested service level
 *   2. Organization's "default" rule for that service level (fromZoneId/
 *      toZoneId both null — a catch-all tariff)
 *   3. Platform-wide default from config (BASE_DELIVERY_FEE / PRICE_PER_KG)
 *
 * This is read on every shipment-creation request and pricing rules
 * change rarely, so the resolved quote is cached in Redis for a short TTL.
 */
const calculatePrice = async (
  organizationId: string,
  params: {
    originZoneId: string;
    destinationZoneId: string;
    weightKg: number;
    serviceLevel: ServiceLevel;
  },
): Promise<IPriceQuote> => {
  const cacheKey = `pricing:${organizationId}:${params.originZoneId}:${params.destinationZoneId}:${params.serviceLevel}`;
  type CachedRule = { baseFee: number; perKgFee: number; baseWeightKg: number; source: IPriceQuote["breakdown"]["source"] };
  const cached = await cache.get<CachedRule>(cacheKey);

  let rule: CachedRule;

  if (cached) {
    rule = cached;
  } else {
    const exact = await prisma.pricingRule.findFirst({
      where: {
        organizationId,
        isActive: true,
        serviceLevel: params.serviceLevel,
        fromZoneId: params.originZoneId,
        toZoneId: params.destinationZoneId,
      },
    });

    if (exact) {
      rule = { ...exact, source: "EXACT_ZONE_PAIR" };
    } else {
      const orgDefault = await prisma.pricingRule.findFirst({
        where: {
          organizationId,
          isActive: true,
          serviceLevel: params.serviceLevel,
          fromZoneId: null,
          toZoneId: null,
        },
      });
      rule = orgDefault
        ? { ...orgDefault, source: "ORG_DEFAULT" }
        : {
            baseFee: config.pricing.baseDeliveryFee,
            perKgFee: config.pricing.pricePerKg,
            baseWeightKg: 1,
            source: "PLATFORM_DEFAULT",
          };
    }

    await cache.set(cacheKey, rule, 300); // 5 minutes
  }

  const billableExtraKg = Math.max(0, params.weightKg - rule.baseWeightKg);
  const extraCharge = Number((billableExtraKg * rule.perKgFee).toFixed(2));
  const price = Number((rule.baseFee + extraCharge).toFixed(2));

  return {
    price,
    currency: "BDT",
    breakdown: {
      baseFee: rule.baseFee,
      perKgFee: rule.perKgFee,
      baseWeightKg: rule.baseWeightKg,
      billableExtraKg,
      extraCharge,
      source: rule.source,
    },
  };
};

async function invalidatePricingCache(organizationId: string) {
  // Short TTL makes a full key-scan-and-delete unnecessary for this
  // scaffold; rules simply take effect within 5 minutes. A production
  // deployment could track and delete exact keys, or use Redis SCAN with
  // a `pricing:{orgId}:*` pattern here instead.
  await cache.del(`pricing:invalidated:${organizationId}:${Date.now()}`);
}

export const PricingService = { createRule, getAllRules, calculatePrice };
