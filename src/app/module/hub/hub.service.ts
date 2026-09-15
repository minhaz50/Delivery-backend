import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { Role } from "../../../generated/prisma/client";

const create = async (
  organizationId: string,
  payload: {
    name: string;
    code: string;
    zoneId: string;
    address: string;
    latitude?: number;
    longitude?: number;
    managerId?: string;
  },
) => {
  const zone = await prisma.zone.findFirst({
    where: { id: payload.zoneId, organizationId },
  });
  if (!zone)
    throw ApiError.badRequest("Zone does not belong to your organization.");

  const existing = await prisma.hub.findUnique({
    where: { organizationId_code: { organizationId, code: payload.code } },
  });
  if (existing)
    throw ApiError.conflict(
      "A hub with this code already exists in your organization.",
    );

  return prisma.hub.create({ data: { ...payload, organizationId } });
};

const getAll = async (organizationId: string) => {
  return prisma.hub.findMany({
    where: { organizationId },
    include: {
      zone: true,
      manager: { select: { id: true, name: true, email: true } },
    },
    orderBy: { name: "asc" },
  });
};

const getById = async (id: string) => {
  const hub = await prisma.hub.findUnique({
    where: { id },
    include: {
      zone: true,
      manager: true,
      couriers: { include: { user: true } },
    },
  });
  if (!hub) throw ApiError.notFound("Hub not found.");
  return hub;
};

const assignManager = async (
  hubId: string,
  managerId: string,
  organizationId: string,
) => {
  const manager = await prisma.user.findFirst({
    where: { id: managerId, organizationId },
  });
  if (!manager)
    throw ApiError.badRequest("Manager must be a user in this organization.");
  if (manager.role !== Role.HUB_MANAGER) {
    throw ApiError.badRequest("Assigned user must have the HUB_MANAGER role.");
  }
  return prisma.hub.update({ where: { id: hubId }, data: { managerId } });
};

export const HubService = { create, getAll, getById, assignManager };
