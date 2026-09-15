import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ShipmentService } from "./shipment.service";
import { ApiError } from "../../utils/ApiError";
import { Role } from "../../../generated/prisma";

const create = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) {
    throw ApiError.badRequest(
      "Your account is not attached to an organization yet. Contact support to be linked to a courier org.",
    );
  }
  const result = await ShipmentService.createShipment(req.user!.userId, req.user!.organizationId, req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, message: "Shipment created.", data: result });
});

const schedulePickup = catchAsync(async (req, res) => {
  const result = await ShipmentService.schedulePickup(
    req.params.id,
    req.user!.userId,
    req.body.pickupScheduledAt,
  );
  sendResponse(res, { statusCode: httpStatus.OK, message: "Pickup scheduled.", data: result });
});

const cancel = catchAsync(async (req, res) => {
  const result = await ShipmentService.cancelShipment(req.params.id, req.user!.userId, req.body.reason);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Shipment cancelled.", data: result });
});

const initiateReturn = catchAsync(async (req, res) => {
  const result = await ShipmentService.initiateReturn(req.params.id, req.user!.userId, req.body.reason);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Return initiated.", data: result });
});

const markReturnInTransit = catchAsync(async (req, res) => {
  const result = await ShipmentService.markReturnInTransit(req.params.id, req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Return marked in transit.", data: result });
});

const markReturnedToSender = catchAsync(async (req, res) => {
  const result = await ShipmentService.markReturnedToSender(req.params.id, req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Return completed.", data: result });
});

const getById = catchAsync(async (req, res) => {
  const result = await ShipmentService.getById(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Shipment fetched.", data: result });
});

const update = catchAsync(async (req, res) => {
  const result = await ShipmentService.updateShipment(req.params.id, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Shipment updated.", data: result });
});

const updateStatus = catchAsync(async (req, res) => {
  const result = await ShipmentService.forceUpdateStatus(
    req.params.id,
    req.body.status,
    req.user!.userId,
    req.body.note,
    req.body.location,
  );
  sendResponse(res, { statusCode: httpStatus.OK, message: "Shipment status updated.", data: result });
});

const remove = catchAsync(async (req, res) => {
  const result = await ShipmentService.softDelete(req.params.id, req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Shipment deleted.", data: result });
});

const search = catchAsync(async (req, res) => {
  const { q, page, limit } = req.query as unknown as { q: string; page: number; limit: number };

  const filters: Parameters<typeof ShipmentService.searchShipments>[0] = { keyword: q, page, limit };
  if (req.user!.role === Role.CUSTOMER) {
    filters.customerId = req.user!.userId;
  } else {
    filters.organizationId = req.user!.organizationId ?? undefined;
  }

  const result = await ShipmentService.searchShipments(filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Search results fetched.",
    meta: result.meta,
    data: result.data,
  });
});

const track = catchAsync(async (req, res) => {
  const result = await ShipmentService.trackByTrackingId(req.params.trackingId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Tracking info fetched.", data: result });
});

const list = catchAsync(async (req, res) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };

  // Scope results by role: customers only ever see their own shipments,
  // couriers only see shipments tied to their own assignments, staff
  // (admin/ops/hub manager) see everything in their organization.
  const filters: Parameters<typeof ShipmentService.listShipments>[0] = { status, page, limit };
  if (req.user!.role === Role.CUSTOMER) {
    filters.customerId = req.user!.userId;
  } else if (req.user!.role === Role.COURIER) {
    filters.courierUserId = req.user!.userId;
  } else {
    filters.organizationId = req.user!.organizationId ?? undefined;
  }

  const result = await ShipmentService.listShipments(filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Shipments fetched.",
    meta: result.meta,
    data: result.data,
  });
});

export const ShipmentController = {
  create,
  schedulePickup,
  update,
  updateStatus,
  remove,
  search,
  cancel,
  initiateReturn,
  markReturnInTransit,
  markReturnedToSender,
  getById,
  track,
  list,
};
