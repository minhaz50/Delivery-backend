import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { OrganizationService } from "./organization.service";

const create = catchAsync(async (req, res) => {
  const result = await OrganizationService.create(req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, message: "Organization created.", data: result });
});

const getAll = catchAsync(async (_req, res) => {
  const result = await OrganizationService.getAll();
  sendResponse(res, { statusCode: httpStatus.OK, message: "Organizations fetched.", data: result });
});

const getAllPublic = catchAsync(async (_req, res) => {
  const result = await OrganizationService.getAllPublic();
  sendResponse(res, { statusCode: httpStatus.OK, message: "Organizations fetched.", data: result });
});

const getById = catchAsync(async (req, res) => {
  const result = await OrganizationService.getById(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Organization fetched.", data: result });
});

const update = catchAsync(async (req, res) => {
  const result = await OrganizationService.update(req.params.id, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Organization updated.", data: result });
});

export const OrganizationController = { create, getAll, getAllPublic, getById, update };
