import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnalyticsService } from "./analytics.service";
import { ApiError } from "../../utils/ApiError";

const getDashboardSummary = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await AnalyticsService.getDashboardSummary(req.user!.organizationId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Dashboard summary fetched.", data: result });
});

const getCourierLeaderboard = catchAsync(async (req, res) => {
  if (!req.user!.organizationId) throw ApiError.badRequest("User is not attached to an organization.");
  const result = await AnalyticsService.getCourierLeaderboard(req.user!.organizationId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Courier leaderboard fetched.", data: result });
});

export const AnalyticsController = { getDashboardSummary, getCourierLeaderboard };
