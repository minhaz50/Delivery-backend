import { prisma } from "../../lib/prisma";

const getDashboardSummary = async (organizationId: string) => {
  const [statusCounts, revenue, activeCouriers, totalCouriers, deliveredShipments, hubCount] =
    await Promise.all([
      prisma.shipment.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { organizationId, status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.courierProfile.count({ where: { organizationId, isAvailable: true } }),
      prisma.courierProfile.count({ where: { organizationId } }),
      prisma.shipment.findMany({
        where: { organizationId, status: "DELIVERED", deliveredAt: { not: null } },
        select: { createdAt: true, deliveredAt: true },
        take: 500, // sample recent deliveries rather than scanning the full history
        orderBy: { deliveredAt: "desc" },
      }),
      prisma.hub.count({ where: { organizationId, isActive: true } }),
    ]);

  const avgDeliveryHours =
    deliveredShipments.length > 0
      ? deliveredShipments.reduce((sum, s) => {
          const hours = (s.deliveredAt!.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }, 0) / deliveredShipments.length
      : null;

  return {
    shipmentsByStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
    totalRevenue: revenue._sum.amount ?? 0,
    couriers: { active: activeCouriers, total: totalCouriers },
    activeHubs: hubCount,
    avgDeliveryTimeHours: avgDeliveryHours ? Number(avgDeliveryHours.toFixed(1)) : null,
    sampledDeliveredCount: deliveredShipments.length,
  };
};

const getCourierLeaderboard = async (organizationId: string) => {
  const earnings = await prisma.courierEarning.groupBy({
    by: ["courierId"],
    where: { courier: { organizationId } },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 20,
  });

  const courierIds = earnings.map((e) => e.courierId);
  const couriers = await prisma.courierProfile.findMany({
    where: { id: { in: courierIds } },
    include: { user: { select: { name: true, email: true } } },
  });
  const courierMap = new Map(couriers.map((c) => [c.id, c]));

  return earnings.map((e) => ({
    courier: courierMap.get(e.courierId)?.user,
    totalEarnings: e._sum.amount ?? 0,
    completedLegs: e._count._all,
    rating: courierMap.get(e.courierId)?.rating,
  }));
};

export const AnalyticsService = { getDashboardSummary, getCourierLeaderboard };
