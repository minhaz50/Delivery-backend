import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config";
import type { Role } from "../../generated/prisma";

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

export const signAccessToken = (payload: JwtPayload) =>
  jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  } as SignOptions);

export const signRefreshToken = (payload: JwtPayload) =>
  jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as SignOptions);

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, config.jwt.accessSecret) as JwtPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
