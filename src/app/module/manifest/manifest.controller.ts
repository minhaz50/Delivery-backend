import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ManifestService } from "./manifest.service";
import { ApiError } from "../../utils/ApiError";

const create = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await ManifestService.create({
    organizationId: req.user!.organizationId,
    fromHubId: req.body.fromHubId,
    toHubId: req.body.toHubId,
    vehicleInfo: req.body.vehicleInfo,
    createdById: req.user!.userId,
  });
  sendResponse(res, { statusCode: httpStatus.CREATED, message: "Manifest created.", data: result });
});

const addItems = catchAsync(async (req, res) => {
  const result = await ManifestService.addItems(req.params.id, req.body.shipmentIds, req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Shipments added to manifest.", data: result });
});

const dispatch = catchAsync(async (req, res) => {
  const result = await ManifestService.dispatch(req.params.id, req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Manifest dispatched.", data: result });
});

const arrive = catchAsync(async (req, res) => {
  const result = await ManifestService.arrive(req.params.id, req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Manifest marked as arrived.", data: result });
});

const close = catchAsync(async (req, res) => {
  const result = await ManifestService.close(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Manifest closed.", data: result });
});

const getById = catchAsync(async (req, res) => {
  const result = await ManifestService.getById(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Manifest fetched.", data: result });
});

const list = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await ManifestService.listForOrganization(req.user!.organizationId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Manifests fetched.", data: result });
});

export const ManifestController = { create, addItems, dispatch, arrive, close, getById, list };
