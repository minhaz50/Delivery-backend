import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthService } from "./auth.service";
import { ApiError } from "../../utils/ApiError";

const register = catchAsync(async (req, res) => {
  const result = await AuthService.registerCustomer(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: "Registration successful.",
    data: result,
  });
});

const login = catchAsync(async (req, res) => {
  const result = await AuthService.login(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Login successful.",
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  if (!token) throw ApiError.badRequest("refreshToken is required.");
  const result = await AuthService.refreshAccessToken(token);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Access token refreshed.",
    data: result,
  });
});

const getMe = catchAsync(async (req, res) => {
  const result = await AuthService.getMe(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Profile fetched successfully.",
    data: result,
  });
});

export const AuthController = { register, login, refreshToken, getMe };
