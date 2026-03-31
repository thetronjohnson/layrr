import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { uniqueSlug } from "@/lib/slug";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { githubRepo, name, branch } = await req.json();
  if (!githubRepo || !name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await db.select().from(projects)
    .where(and(eq(projects.userId, session.userId), eq(projects.githubRepo, githubRepo)))
    .limit(1);
  if (existing.length > 0) return NextResponse.json(existing[0]);

  const slug = await uniqueSlug();
  const [project] = await db.insert(projects).values({
    userId: session.userId,
    name,
    slug,
    githubRepo,
    branch: branch || "main",
  }).returning();

  return NextResponse.json(project);
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(projects)
    .where(eq(projects.userId, session.userId))
    .orderBy(desc(projects.updatedAt));

  return NextResponse.json(result);
}
