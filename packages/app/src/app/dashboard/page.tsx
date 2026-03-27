import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, GitBranch } from "lucide-react";
import { ProjectActions, EmptyActions } from "./actions";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");

  const userProjects = await db.select().from(projects)
    .where(eq(projects.userId, session.userId))
    .orderBy(desc(projects.updatedAt));

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
            <button className="rounded-md bg-background px-3 py-1.5 text-xs font-semibold shadow-sm">
              Projects
            </button>
            <button className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-not-allowed" disabled>
              Team
              <span className="ml-1.5 rounded bg-foreground/5 px-1 py-0.5 text-[9px] text-muted-foreground/60">soon</span>
            </button>
          </div>
          <ProjectActions />
        </div>
      </div>

      {userProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24">
          <div className="mb-4 rounded-full bg-secondary p-3">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mb-1 text-sm font-medium">No projects yet</p>
          <p className="mb-6 text-xs text-muted-foreground">Create a new website or import from GitHub</p>
          <EmptyActions />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {userProjects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/project/${project.id}`}
              className="group rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-all hover:ring-foreground/20"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-[13px] font-semibold truncate min-w-0">{project.name}</h2>
                <StatusPill status={project.containerStatus} />
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <GithubIcon className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{project.githubRepo}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <GitBranch className="h-2.5 w-2.5" />
                    {project.branch}
                  </span>
                  {project.framework && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {project.framework}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {timeAgo(project.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; dot: string }> = {
    RUNNING: { bg: "bg-success/10 text-success", dot: "bg-success" },
    STARTING: { bg: "bg-yellow-400/10 text-yellow-400", dot: "bg-yellow-400 animate-pulse" },
    CREATING: { bg: "bg-yellow-400/10 text-yellow-400", dot: "bg-yellow-400 animate-pulse" },
    STOPPED: { bg: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground/50" },
    ERROR: { bg: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
    STOPPING: { bg: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground/50" },
  };

  const s = styles[status] || styles.STOPPED;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${s.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status.toLowerCase()}
    </span>
  );
}
