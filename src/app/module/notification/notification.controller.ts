import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { NotificationService } from "./notification.service";

const getMine = catchAsync(async (req, res) => {
  const result = await NotificationService.getUserNotifications(req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Notifications fetched.", data: result });
});

export const NotificationController = { getMine };
