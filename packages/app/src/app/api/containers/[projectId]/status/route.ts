import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getMachineStatus, flyStateToStatus } from "@/lib/fly";
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

  let status: string = project.containerStatus;

  // If we have a machine, check its real status
  if (project.flyMachineId) {
    try {
      const flyState = await getMachineStatus(project.flyMachineId);
      status = flyStateToStatus(flyState);

      // Update DB if status changed
      if (status !== project.containerStatus) {
        await db.update(projects).set({
          containerStatus: status as any,
          updatedAt: new Date(),
        }).where(eq(projects.id, projectId));
      }
    } catch {
      // Can't reach Fly — use cached status
    }
  }

  return NextResponse.json({
    status,
    framework: project.framework,
    machineId: project.flyMachineId,
  });
}
