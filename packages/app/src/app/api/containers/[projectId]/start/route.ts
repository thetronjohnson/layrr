import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { createMachine, startMachine, flyStateToStatus } from "@/lib/fly";
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

  // Get user's GitHub token
  const [user] = await db.select().from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user?.githubToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  try {
    if (project.flyMachineId) {
      // Machine exists — start it
      await startMachine(project.flyMachineId);
      await db.update(projects).set({
        containerStatus: "STARTING",
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(projects.id, projectId));
    } else {
      // Create new machine
      await db.update(projects).set({
        containerStatus: "CREATING",
        updatedAt: new Date(),
      }).where(eq(projects.id, projectId));

      const machine = await createMachine({
        name: projectId,
        githubRepo: project.githubRepo,
        githubToken: user.githubToken,
        branch: project.branch,
      });

      await db.update(projects).set({
        flyMachineId: machine.id,
        containerStatus: flyStateToStatus(machine.state) as any,
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(projects.id, projectId));
    }

    return NextResponse.json({ status: "STARTING" });
  } catch (error: any) {
    console.error("Container start error:", error);
    await db.update(projects).set({
      containerStatus: "ERROR",
      updatedAt: new Date(),
    }).where(eq(projects.id, projectId));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
