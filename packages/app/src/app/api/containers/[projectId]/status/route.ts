import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getContainerStatus } from "@/lib/server-api";
import { NextResponse } from "next/server";

export async function GET(
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

  // Check actual process state from server
  try {
    const result = await getContainerStatus(projectId);
    const statusMap: Record<string, string> = {
      running: "RUNNING",
      starting: "STARTING",
      error: "ERROR",
      stopped: "STOPPED",
    };
    const status = statusMap[result.status] || "STOPPED";

    // Sync DB if different
    if (status !== project.containerStatus) {
      await db.update(projects).set({
        containerStatus: status as any,
        framework: result.framework || project.framework,
        updatedAt: new Date(),
      }).where(eq(projects.id, projectId));
    }

    return NextResponse.json({
      status,
      proxyPort: result.proxyPort,
      framework: result.framework || project.framework,
      editCount: result.editCount || 0,
      accessToken: result.accessToken,
      slug: result.slug || project.slug,
    });
  } catch {
    // Server unreachable — use DB value
    return NextResponse.json({
      status: project.containerStatus,
      framework: project.framework,
    });
  }
}
