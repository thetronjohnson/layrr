import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { startContainer } from "@/lib/server-api";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
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

  // GitHub token only required for GitHub-imported projects without an existing workspace
  if (!user?.githubToken && project.sourceType === 'github') {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  // Update DB immediately
  await db.update(projects).set({
    containerStatus: "STARTING" as any,
    lastActiveAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(projects.id, projectId));

  // Fire and forget — don't await the long process
  startContainer(projectId, project.githubRepo || '', project.branch, user?.githubToken || '', user?.githubUsername || 'layrr', user?.email || '', project.sharePassword || undefined)
    .then(async (result) => {
      await db.update(projects).set({
        containerStatus: result.status === 'running' ? 'RUNNING' as any : 'ERROR' as any,
        framework: result.framework,
        updatedAt: new Date(),
      }).where(eq(projects.id, projectId));
    })
    .catch(async () => {
      await db.update(projects).set({
        containerStatus: "ERROR" as any,
        updatedAt: new Date(),
      }).where(eq(projects.id, projectId));
    });

  return NextResponse.json({ status: "STARTING" });
}
