import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { pushProject } from "@/lib/server-api";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [user] = await db.select().from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user?.githubToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  const { targetBranch } = await req.json();
  if (!targetBranch) {
    return NextResponse.json({ error: "Missing targetBranch" }, { status: 400 });
  }

  try {
    const result = await pushProject(projectId, targetBranch, user.githubToken, project.githubRepo || undefined);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
