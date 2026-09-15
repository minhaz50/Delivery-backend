import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { config } from "../../config";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import type {
  IAuthTokens,
  ILoginPayload,
  IRegisterCustomerPayload,
} from "./auth.interface";
import { Role } from "../../../generated/prisma/client";

const toTokenPayload = (user: {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
}) => ({
  userId: user.id,
  email: user.email,
  role: user.role,
  organizationId: user.organizationId,
});

const registerCustomer = async (payload: IRegisterCustomerPayload) => {
  const existing = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: payload.organizationSlug },
  });
  if (!organization || !organization.isActive) {
    throw ApiError.badRequest("Unknown or inactive courier organization.");
  }

  const hashedPassword = await bcrypt.hash(
    payload.password,
    config.bcryptSaltRounds,
  );

  // Registration is always CUSTOMER. Staff accounts (courier, hub manager,
  // ops manager, admin) are provisioned by an existing ADMIN via the
  // user-management endpoint, never through public self-registration.
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: payload.name,
      email: payload.email,
      password: hashedPassword,
      phone: payload.phone,
      role: Role.CUSTOMER,
    },
  });

  const tokens = issueTokens(user);
  return { user: sanitize(user), ...tokens };
};

const login = async (payload: ILoginPayload) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if (!user || user.isDeleted) {
    throw ApiError.unauthorized("Invalid email or password.");
  }
  if (user.status === "BLOCKED") {
    throw ApiError.forbidden("This account has been blocked. Contact support.");
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized("Invalid email or password.");
  }

  const tokens = issueTokens(user);
  return { user: sanitize(user), ...tokens };
};

const refreshAccessToken = async (
  refreshToken: string,
): Promise<IAuthTokens> => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token.");
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || user.isDeleted || user.status === "BLOCKED") {
    throw ApiError.unauthorized("This account is no longer active.");
  }

  return issueTokens(user);
};

const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { courierProfile: true, organization: true },
  });
  if (!user) throw ApiError.notFound("User not found.");
  return sanitize(user);
};

function issueTokens(user: {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
}): IAuthTokens {
  const payload = toTokenPayload(user);
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

// Never return the password hash to the client.
function sanitize<T extends { password?: string }>(user: T) {
  const { password, ...rest } = user;
  return rest;
}

export const AuthService = {
  registerCustomer,
  login,
  refreshAccessToken,
  getMe,
};
