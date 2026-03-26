import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { stopMachine } from "@/lib/fly";
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

  try {
    if (project.flyMachineId) {
      await stopMachine(project.flyMachineId);
    }
    await db.update(projects).set({
      containerStatus: "STOPPED",
      updatedAt: new Date(),
    }).where(eq(projects.id, projectId));

    return NextResponse.json({ status: "STOPPED" });
  } catch (error: any) {
    console.error("Container stop error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
