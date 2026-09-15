import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { pick } from "../../utils/pick";

const create = async (payload: {
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone?: string;
}) => {
  const existing = await prisma.organization.findUnique({ where: { slug: payload.slug } });
  if (existing) throw ApiError.conflict("An organization with this slug already exists.");
  return prisma.organization.create({ data: payload });
};

const getAll = async () => {
  return prisma.organization.findMany({ orderBy: { createdAt: "desc" } });
};

const getAllPublic = async () => {
  return prisma.organization.findMany({
    where: { isActive: true },
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });
};

const getById = async (id: string) => {
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) throw ApiError.notFound("Organization not found.");
  return org;
};

const update = async (id: string, payload: Record<string, unknown>) => {
  await getById(id);
  const data = pick(payload, ["name", "contactEmail", "contactPhone", "isActive"]);
  return prisma.organization.update({ where: { id }, data });
};

export const OrganizationService = { create, getAll, getAllPublic, getById, update };
