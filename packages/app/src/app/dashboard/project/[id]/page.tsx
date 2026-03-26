import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, editEvents } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { ContainerControls } from "./controls";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");

  const { id } = await params;

  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, session.userId)))
    .limit(1);

  if (!project) notFound();

  const edits = await db.select().from(editEvents)
    .where(eq(editEvents.projectId, id))
    .orderBy(desc(editEvents.createdAt))
    .limit(20);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">{project.githubRepo}</p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Editor
          </h2>
          <ContainerControls
            projectId={project.id}
            status={project.containerStatus}
            framework={project.framework}
            machineId={project.flyMachineId}
          />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Details
          </h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-zinc-500">Repository</dt>
              <dd className="mt-1 font-medium">{project.githubRepo}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Branch</dt>
              <dd className="mt-1 font-medium">{project.branch}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Framework</dt>
              <dd className="mt-1 font-medium">{project.framework || "Detecting..."}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Total Edits</dt>
              <dd className="mt-1 font-medium">{edits.length}</dd>
            </div>
          </dl>
        </div>

        {edits.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Recent Edits
            </h2>
            <div className="space-y-3">
              {edits.map((edit) => (
                <div
                  key={edit.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3"
                >
                  <span className="text-sm">{edit.instruction}</span>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    {edit.success ? (
                      <span className="text-emerald-400">success</span>
                    ) : (
                      <span className="text-red-400">failed</span>
                    )}
                    <span>{edit.createdAt.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
