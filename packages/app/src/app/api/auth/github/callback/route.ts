import { github, getSession } from "@/lib/auth";
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
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("github_oauth_state")?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_state", getBaseUrl(req)));
  }

  try {
    const tokens = await github.validateAuthorizationCode(code);
    const accessToken = tokens.accessToken();

    // Fetch GitHub user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser = await userRes.json();

    // Fetch email
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const emails = await emailRes.json();
    const primaryEmail = emails.find((e: any) => e.primary)?.email || githubUser.email || "";

    const session = await getSession();

    // If already logged in (e.g. Google user), link GitHub to existing account
    if (session.userId) {
      // Clear github_id from any other user that already has it
      await db.update(users).set({
        githubId: null,
        githubToken: null,
        githubUsername: null,
        updatedAt: new Date(),
      }).where(eq(users.githubId, String(githubUser.id)));

      await db.update(users).set({
        githubId: String(githubUser.id),
        githubToken: accessToken,
        githubUsername: githubUser.login,
        updatedAt: new Date(),
      }).where(eq(users.id, session.userId));

      session.githubToken = accessToken;
      session.githubUsername = githubUser.login;
      await session.save();

      const isPopupLink = storedState?.startsWith("popup:");
      cookieStore.delete("github_oauth_state");

      if (isPopupLink) {
        return new NextResponse(
          `<html><body><script>window.opener?.postMessage("github-connected","*");window.close();</script></body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }
      return NextResponse.redirect(new URL("/dashboard", getBaseUrl(req)));
    }

    // Normal login/signup flow
    const existing = await db.select().from(users).where(eq(users.githubId, String(githubUser.id))).limit(1);

    let userId: string;
    if (existing.length > 0) {
      userId = existing[0].id;
      await db.update(users).set({
        githubToken: accessToken,
        email: primaryEmail,
        githubUsername: githubUser.login,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));
    } else {
      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 3);
      const [newUser] = await db.insert(users).values({
        githubId: String(githubUser.id),
        email: primaryEmail,
        githubUsername: githubUser.login,
        githubToken: accessToken,
        subscriptionStatus: "trialing",
        subscriptionEndsAt: trialEnds,
      }).returning();
      userId = newUser.id;
    }

    session.userId = userId;
    session.githubToken = accessToken;
    session.githubUsername = githubUser.login;
    session.displayName = githubUser.login;
    await session.save();

    const isPopup = storedState?.startsWith("popup:");
    cookieStore.delete("github_oauth_state");

    if (isPopup) {
      return new NextResponse(
        `<html><body><script>window.opener?.postMessage("github-connected","*");window.close();</script></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return NextResponse.redirect(new URL("/dashboard", getBaseUrl(req)));
  } catch (error) {
    console.error("GitHub OAuth error:", error);
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", getBaseUrl(req)));
  }
}
