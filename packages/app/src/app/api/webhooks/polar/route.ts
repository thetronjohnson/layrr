import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.text();
  const headers = {
    "webhook-id": req.headers.get("webhook-id") || "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
    "webhook-signature": req.headers.get("webhook-signature") || "",
  };

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(body, headers, process.env.POLAR_WEBHOOK_SECRET!);
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      console.error("Webhook verification failed:", e.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    throw e;
  }

  const type = event.type;

  if (
    type === "subscription.created" ||
    type === "subscription.active" ||
    type === "subscription.updated" ||
    type === "subscription.canceled" ||
    type === "subscription.revoked" ||
    type === "subscription.past_due"
  ) {
    const sub = event.data;
    const customerId = sub.customerId;

    // Map Polar status to our status
    let status: "trialing" | "active" | "canceled" | "past_due" | "none";
    switch (sub.status) {
      case "trialing":
        status = "trialing";
        break;
      case "active":
        status = "active";
        break;
      case "past_due":
        status = "past_due";
        break;
      case "canceled":
      case "revoked":
        status = "canceled";
        break;
      default:
        status = "none";
    }

    const endsAt = sub.endsAt || sub.currentPeriodEnd || null;

    // Find user by polar customer ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.polarCustomerId, customerId))
      .limit(1);

    const updateData = {
      polarSubscriptionId: sub.id,
      subscriptionStatus: status,
      subscriptionEndsAt: endsAt,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      updatedAt: new Date(),
    };

    if (user) {
      await db.update(users).set(updateData).where(eq(users.id, user.id));
    } else {
      // Try matching by metadata userId from checkout
      const metadata = sub.metadata as Record<string, string> | null;
      const userId = metadata?.userId;
      if (userId) {
        await db.update(users).set({
          polarCustomerId: customerId,
          ...updateData,
        }).where(eq(users.id, userId));
      } else {
        console.error("Webhook: could not find user for customer", customerId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
