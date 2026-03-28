import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const [user] = await db.select().from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user?.githubToken) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  const res = await fetch(`https://api.github.com/repos/${user.githubUsername}/${name}`, {
    headers: {
      Authorization: `Bearer ${user.githubToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  return NextResponse.json({ available: res.status === 404 });
}
