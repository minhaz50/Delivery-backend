import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";
import { ApiError } from "../../utils/ApiError";
import { Role } from "../../../generated/prisma";

const initiate = catchAsync(async (req, res) => {
  const result = await PaymentService.initiateForShipment({
    shipmentId: req.body.shipmentId,
    requesterId: req.user!.userId,
    requesterRole: req.user!.role,
    method: req.body.method,
  });
  sendResponse(res, { statusCode: httpStatus.OK, message: "Payment initiated.", data: result });
});

const getById = catchAsync(async (req, res) => {
  const result = await PaymentService.getById(req.params.id);

  if (req.user!.role === Role.CUSTOMER && result.shipment?.customerId !== req.user!.userId) {
    throw ApiError.forbidden("This payment does not belong to you.");
  }

  sendResponse(res, { statusCode: httpStatus.OK, message: "Payment fetched.", data: result });
});

const confirm = catchAsync(async (req, res) => {
  const result = await PaymentService.markPaid(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Payment confirmed.", data: result });
});

const refund = catchAsync(async (req, res) => {
  const result = await PaymentService.refund(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Payment refunded.", data: result });
});

export const PaymentController = { initiate, getById, confirm, refund };
