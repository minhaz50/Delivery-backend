import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminService } from "./admin.service";
import { ApiError } from "../../utils/ApiError";

const listUsers = catchAsync(async (req, res) => {
  if (!req.user!.organizationId)
    throw ApiError.badRequest("User is not attached to an organization.");
  const { role, status, page, limit } = req.query as unknown as {
    role?: any;
    status?: any;
    page: number;
    limit: number;
  };

  const result = await AdminService.listUsers({
    organizationId: req.user!.organizationId,
    role,
    status,
    page,
    limit,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Users fetched.",
    meta: result.meta,
    data: result.data,
  });
});

const updateUserRole = catchAsync(async (req, res) => {
  const result = await AdminService.updateUserRole({
    targetUserId: req.params.id,
    newRole: req.body.role,
    actingAdminId: req.user!.userId,
    actingAdminRole: req.user!.role,
    actingAdminOrgId: req.user!.organizationId,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "User role updated.",
    data: result,
  });
});

const getDashboardStats = catchAsync(async (req, res) => {
  if (!req.user!.organizationId)
    throw ApiError.badRequest("User is not attached to an organization.");
  const result = await AdminService.getDashboardStats(req.user!.organizationId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Dashboard stats fetched.",
    data: result,
  });
});

const getAuditLogs = catchAsync(async (req, res) => {
  if (!req.user!.organizationId)
    throw ApiError.badRequest("User is not attached to an organization.");
  const { page, limit } = req.query as unknown as {
    page: number;
    limit: number;
  };
  const result = await AdminService.getAuditLogs({
    organizationId: req.user!.organizationId,
    page,
    limit,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Audit logs fetched.",
    meta: result.meta,
    data: result.data,
  });
});

export const AdminController = {
  listUsers,
  updateUserRole,
  getDashboardStats,
  getAuditLogs,
};
