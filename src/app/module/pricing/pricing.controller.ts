import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PricingService } from "./pricing.service";
import { ApiError } from "../../utils/ApiError";

const createRule = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await PricingService.createRule(req.user!.organizationId, req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, message: "Pricing rule created.", data: result });
});

const getAllRules = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await PricingService.getAllRules(req.user!.organizationId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Pricing rules fetched.", data: result });
});

const quote = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await PricingService.calculatePrice(req.user!.organizationId, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Price quote calculated.", data: result });
});

export const PricingController = { createRule, getAllRules, quote };
