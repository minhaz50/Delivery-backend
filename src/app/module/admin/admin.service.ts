import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { Role, UserStatus } from "../../../generated/prisma";
import { AnalyticsService } from "../analytics/analytics.service";

const listUsers = async (params: {
  organizationId: string;
  role?: Role;
  status?: UserStatus;
  page: number;
  limit: number;
}) => {
  const where: Record<string, unknown> = {
    organizationId: params.organizationId,
    isDeleted: false,
  };
  if (params.role) where.role = params.role;
  if (params.status) where.status = params.status;

  const skip = (params.page - 1) * params.limit;

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        organizationId: true,
        createdAt: true,
        courierProfile: {
          select: { id: true, isAvailable: true, vehicleType: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
};

const updateUserRole = async (params: {
  targetUserId: string;
  newRole: Role;
  actingAdminId: string;
  actingAdminRole: Role;
  actingAdminOrgId: string | null;
}) => {
  if (params.targetUserId === params.actingAdminId) {
    throw ApiError.badRequest("You cannot change your own role.");
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: params.targetUserId, isDeleted: false },
  });
  if (!targetUser) throw ApiError.notFound("User not found.");

  if (params.actingAdminRole !== Role.SUPER_ADMIN) {
    if (targetUser.organizationId !== params.actingAdminOrgId) {
      throw ApiError.forbidden(
        "You can only manage users within your own organization.",
      );
    }
    if (params.newRole === Role.SUPER_ADMIN) {
      throw ApiError.forbidden(
        "Only a SUPER_ADMIN can grant the SUPER_ADMIN role.",
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: params.targetUserId },
    data: { role: params.newRole },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
    },
  });

  return updated;
};

const getDashboardStats = async (organizationId: string) => {
  return AnalyticsService.getDashboardSummary(organizationId);
};

const getAuditLogs = async (params: {
  organizationId: string;
  page: number;
  limit: number;
}) => {
  const skip = (params.page - 1) * params.limit;
  const where = { shipment: { organizationId: params.organizationId } };

  const [data, total] = await Promise.all([
    prisma.shipmentEvent.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: { createdAt: "desc" },
      include: {
        shipment: { select: { id: true, trackingId: true } },
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.shipmentEvent.count({ where }),
  ]);

  return {
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
};

export const AdminService = {
  listUsers,
  updateUserRole,
  getDashboardStats,
  getAuditLogs,
};
