import "dotenv/config";

export const config = {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,
  backendUrl: process.env.BACKEND_URL,
  frontendUrl: process.env.FRONTEND_URL,

  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },

  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,

  redisUrl: process.env.REDIS_URL,

  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || "no-reply@courier.local",
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  payment: {
    provider: process.env.PAYMENT_PROVIDER || "MOCK",
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    stripeCurrency: process.env.STRIPE_CURRENCY || "usd",
    stripeSuccessUrl: process.env.STRIPE_SUCCESS_URL || "http://localhost:3000/payment/success",
    stripeCancelUrl: process.env.STRIPE_CANCEL_URL || "http://localhost:3000/payment/cancel",
    sslcommerz: {
      storeId: process.env.SSLCOMMERZ_STORE_ID,
      storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD,
    },
    bkash: {
      appKey: process.env.BKASH_APP_KEY,
      appSecret: process.env.BKASH_APP_SECRET,
    },
  },

  pricing: {
    baseDeliveryFee: Number(process.env.BASE_DELIVERY_FEE) || 50,
    pricePerKg: Number(process.env.PRICE_PER_KG) || 20,
  },
};

/**
 * Fails fast on boot instead of blowing up on the first request that
 * touches a missing secret. Call this once from server.ts.
 */
export function assertRequiredEnv() {
  const required = [
    "DATABASE_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. Copy .env.example to .env and fill these in.`,
    );
  }
}
