import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserService } from "./user.service";

const getMe = catchAsync(async (req, res) => {
  const result = await UserService.getMe(req.user!.userId);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Profile fetched successfully.", data: result });
});

const updateProfile = catchAsync(async (req, res) => {
  const result = await UserService.updateProfile(req.user!.userId, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Profile updated successfully.", data: result });
});

const changePassword = catchAsync(async (req, res) => {
  const result = await UserService.changePassword(req.user!.userId, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, message: "Password changed successfully.", data: result });
});

export const UserController = { getMe, updateProfile, changePassword };
