import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { polar } from "@/lib/polar";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user?.polarSubscriptionId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  await polar.subscriptions.update({
    id: user.polarSubscriptionId,
    subscriptionUpdate: { cancelAtPeriodEnd: true },
  });

  await db.update(users).set({
    cancelAtPeriodEnd: true,
    updatedAt: new Date(),
  }).where(eq(users.id, session.userId));

  return NextResponse.json({ success: true });
}
