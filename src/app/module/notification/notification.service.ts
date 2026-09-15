import { prisma } from "../../lib/prisma";
import type { NotificationChannel } from "../../../generated/prisma";

/**
 * Fire-and-forget notification dispatch. Deliberately does NOT throw on
 * failure — a bounced email or down SMS provider should never roll back
 * a shipment status change. Callers should invoke this AFTER their
 * transaction has committed, not from inside it.
 *
 * Real email/SMS wiring (Nodemailer/Resend, Twilio, FCM) plugs in at the
 * `dispatch()` call below; left as a console log here so the whole flow
 * runs without external credentials.
 */
const notify = async (params: {
  userId: string;
  title: string;
  body: string;
  channel?: NotificationChannel;
  meta?: Record<string, unknown>;
}) => {
  const record = await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      body: params.body,
      channel: params.channel ?? "IN_APP",
      meta: params.meta as any,
      status: "PENDING",
    },
  });

  try {
    await dispatch(record.channel, params);
    await prisma.notification.update({
      where: { id: record.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  } catch (err) {
    console.error(`[notification] failed to send ${record.id}:`, err);
    await prisma.notification.update({ where: { id: record.id }, data: { status: "FAILED" } });
  }

  return record;
};

async function dispatch(
  channel: NotificationChannel,
  params: { userId: string; title: string; body: string },
) {
  // TODO: wire Nodemailer/Resend for EMAIL, an SMS provider for SMS, and
  // FCM/APNs for PUSH. IN_APP notifications need no external dispatch —
  // the row in the `notifications` table IS the delivery.
  if (channel === "IN_APP") return;
  console.log(`[notification:${channel}] -> user ${params.userId}: ${params.title}`);
}

const getUserNotifications = async (userId: string) => {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
};

export const NotificationService = { notify, getUserNotifications };
