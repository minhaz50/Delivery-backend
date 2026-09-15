import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../utils/ApiError";
import { config } from "../config";

export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode = 500;
  let message = "Something went wrong!";
  let errorDetails: unknown = undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errorDetails = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation error";
    errorDetails = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = 409;
      message = `A record with this ${(err.meta?.target as string[])?.join(", ") || "value"} already exists.`;
    } else if (err.code === "P2025") {
      statusCode = 404;
      message = "Record not found.";
    } else {
      statusCode = 400;
      message = "Database request error.";
    }
  } else if (err instanceof Error) {
    message = err.message || message;
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errorDetails,
    stack:
      config.env === "development" && err instanceof Error
        ? err.stack
        : undefined,
  });
};
