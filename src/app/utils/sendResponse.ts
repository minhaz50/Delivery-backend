import type { Response } from "express";

interface ResponsePayload<T> {
  statusCode: number;
  success?: boolean;
  message: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  data?: T;
}

export const sendResponse = <T>(res: Response, payload: ResponsePayload<T>) => {
  res.status(payload.statusCode).json({
    success: payload.success ?? true,
    statusCode: payload.statusCode,
    message: payload.message,
    meta: payload.meta,
    data: payload.data,
  });
};
