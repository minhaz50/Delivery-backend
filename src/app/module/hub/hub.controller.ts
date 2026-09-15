import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { HubService } from "./hub.service";
import { ApiError } from "../../utils/ApiError";

const create = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await HubService.create(req.user!.organizationId, req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, message: "Hub created.", data: result });
});

const getAll = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await HubService.getAll(req.user!.organizationId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Hubs fetched.", data: result });
});

const getById = catchAsync(async (req, res) => {
  const result = await HubService.getById(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Hub fetched.", data: result });
});

const assignManager = catchAsync(async (req, res) => {
  const result = await HubService.assignManager(req.params.id, req.body.managerId, req.user!.organizationId!);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Hub manager assigned.", data: result });
});

export const HubController = { create, getAll, getById, assignManager };
