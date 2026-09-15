import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ZoneService } from "./zone.service";
import { ApiError } from "../../utils/ApiError";

const create = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await ZoneService.create(req.user!.organizationId, req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, message: "Zone created.", data: result });
});

const getAll = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await ZoneService.getAll(req.user!.organizationId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Zones fetched.", data: result });
});

const getById = catchAsync(async (req, res) => {
  const result = await ZoneService.getById(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Zone fetched.", data: result });
});

export const ZoneController = { create, getAll, getById };
