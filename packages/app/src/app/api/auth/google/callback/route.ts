import { google, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getBaseUrl(req: Request): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  if (!google) {
    return NextResponse.redirect(new URL("/sign-in?error=google_not_configured", getBaseUrl(req)));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;
  const codeVerifier = cookieStore.get("google_code_verifier")?.value;

  if (!code || !state || state !== storedState || !codeVerifier) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_state", getBaseUrl(req)));
  }

  try {
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    const accessToken = tokens.accessToken();

    // Fetch Google user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const googleUser = await userRes.json();

    const googleId = String(googleUser.id);
    const email = googleUser.email || "";
    const displayName = googleUser.name || email.split("@")[0];

    // Upsert user
    const existing = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);

    let userId: string;
    if (existing.length > 0) {
      userId = existing[0].id;
      await db.update(users).set({
        email,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));
    } else {
      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 3);
      const [newUser] = await db.insert(users).values({
        googleId,
        email,
        githubUsername: displayName,
        subscriptionStatus: "trialing",
        subscriptionEndsAt: trialEnds,
      }).returning();
      userId = newUser.id;
    }

    // Set session
    const session = await getSession();
    session.userId = userId;
    session.displayName = displayName;
    await session.save();

    cookieStore.delete("google_oauth_state");
    cookieStore.delete("google_code_verifier");

    return NextResponse.redirect(new URL("/dashboard", getBaseUrl(req)));
  } catch (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", getBaseUrl(req)));
  }
}
