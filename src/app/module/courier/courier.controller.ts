import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { CourierService } from "./courier.service";
import { ApiError } from "../../utils/ApiError";

const createProfile = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await CourierService.createProfile(req.user!.organizationId, req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, message: "Courier profile created.", data: result });
});

const setAvailability = catchAsync(async (req, res) => {
  const result = await CourierService.setAvailability(req.user!.userId, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Availability updated.", data: result });
});

const assignCourier = catchAsync(async (req, res) => {
  const result = await CourierService.assignCourierToShipment({
    shipmentId: req.params.shipmentId,
    legType: req.body.legType,
    preferredCourierId: req.body.preferredCourierId,
    actorId: req.user!.userId,
  });
  sendResponse(res, { statusCode: httpStatus.OK, message: "Courier assigned.", data: result });
});

const acceptAssignment = catchAsync(async (req, res) => {
  const result = await CourierService.acceptAssignment(req.params.id, req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Assignment accepted.", data: result });
});

const completePickup = catchAsync(async (req, res) => {
  const result = await CourierService.completePickupLeg(req.params.id, req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Pickup completed.", data: result });
});

const completeDelivery = catchAsync(async (req, res) => {
  const result = await CourierService.completeDeliveryLeg(
    req.params.id,
    req.user!.userId,
    req.body.codCollected,
  );
  sendResponse(res, { statusCode: httpStatus.OK, message: "Delivery completed.", data: result });
});

const failLeg = catchAsync(async (req, res) => {
  const result = await CourierService.failLeg(req.params.id, req.user!.userId, req.body.reason);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Leg marked as failed.", data: result });
});

const confirmArrivalAtOriginHub = catchAsync(async (req, res) => {
  const result = await CourierService.confirmArrivalAtOriginHub({
    shipmentId: req.params.shipmentId,
    hubId: req.body.hubId,
    actorId: req.user!.userId,
  });
  sendResponse(res, { statusCode: httpStatus.OK, message: "Arrival at origin hub confirmed.", data: result });
});

const getMyAssignments = catchAsync(async (req, res) => {
  const result = await CourierService.getMyAssignments(req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Assignments fetched.", data: result });
});

const getMyEarnings = catchAsync(async (req, res) => {
  const result = await CourierService.getMyEarnings(req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Earnings fetched.", data: result });
});

export const CourierController = {
  createProfile,
  setAvailability,
  assignCourier,
  acceptAssignment,
  completePickup,
  completeDelivery,
  failLeg,
  confirmArrivalAtOriginHub,
  getMyAssignments,
  getMyEarnings,
};
