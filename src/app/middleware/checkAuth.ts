import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken, type JwtPayload } from "../utils/jwt";
import { prisma } from "../lib/prisma";
import type { Role } from "../../generated/prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verifies the access token and (optionally) restricts the route to a set
 * of roles. Unlike the reference project, the role check happens against
 * the CURRENT role/status in the database, not just what was baked into
 * the token — a demoted or blocked user is rejected immediately rather
 * than waiting for their old token to expire.
 */
export const auth =
  (...allowedRoles: Role[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice(7) : header;

      if (!token) {
        throw ApiError.unauthorized("Authentication token is required.");
      }

      let decoded: JwtPayload;
      try {
        decoded = verifyAccessToken(token);
      } catch {
        throw ApiError.unauthorized("Invalid or expired token.");
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || user.isDeleted) {
        throw ApiError.unauthorized("This account no longer exists.");
      }
      if (user.status === "BLOCKED") {
        throw ApiError.forbidden("This account has been blocked.");
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        throw ApiError.forbidden(
          "You do not have permission to perform this action.",
        );
      }

      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
