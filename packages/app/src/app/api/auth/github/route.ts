import { generateState } from "arctic";
import { github } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode"); // "popup" for popup flow

  const state = generateState();
  const stateValue = mode === "popup" ? `popup:${state}` : state;
  const url = github.createAuthorizationURL(stateValue, ["repo", "read:user", "user:email"]);

  const cookieStore = await cookies();
  cookieStore.set("github_oauth_state", stateValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return NextResponse.redirect(url);
}
