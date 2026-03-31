import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { polar } from "@/lib/polar";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function getBaseUrl(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const base = getBaseUrl(req);

  const checkout = await polar.checkouts.create({
    products: [process.env.POLAR_PRODUCT_ID!],
    successUrl: `${base}/dashboard?subscribed=1`,
    customerEmail: user.email || undefined,
    metadata: {
      userId: session.userId,
    },
  });

  return NextResponse.json({ url: checkout.url });
}
