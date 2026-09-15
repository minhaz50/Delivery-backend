import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { cache } from "../../lib/redis";

const create = async (organizationId: string, payload: { name: string; code: string; city: string }) => {
  const existing = await prisma.zone.findUnique({
    where: { organizationId_code: { organizationId, code: payload.code } },
  });
  if (existing) throw ApiError.conflict("A zone with this code already exists in your organization.");
  return prisma.zone.create({ data: { ...payload, organizationId } });
};

const getAll = async (organizationId: string) => {
  const cacheKey = `zones:${organizationId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const zones = await prisma.zone.findMany({ where: { organizationId }, orderBy: { city: "asc" } });
  await cache.set(cacheKey, zones, 300); // 5 min — zones change rarely
  return zones;
};

const getById = async (id: string) => {
  const zone = await prisma.zone.findUnique({ where: { id } });
  if (!zone) throw ApiError.notFound("Zone not found.");
  return zone;
};

export const ZoneService = { create, getAll, getById };
