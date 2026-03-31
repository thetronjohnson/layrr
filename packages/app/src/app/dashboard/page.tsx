import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GitBranch, Sparkles, Globe, FileText } from "lucide-react";
import { ProjectActions } from "./actions";
import { Welcome } from "./welcome";

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

const STATUS_LABELS: Record<string, string> = {
  RUNNING: "Live",
  STARTING: "Starting...",
  CREATING: "Creating...",
  STOPPED: "Offline",
  ERROR: "Issue",
  STOPPING: "Stopping...",
};

function TemplateCard({ name, prompt, icon: Icon }: { name: string; prompt: string; icon: any }) {
  return (
    <Link
      href={`/dashboard/new?name=${encodeURIComponent(name)}&prompt=${encodeURIComponent(prompt)}`}
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/50 text-left"
    >
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{name}</span>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");

  const userProjects = await db.select().from(projects)
    .where(eq(projects.userId, session.userId))
    .orderBy(desc(projects.updatedAt));

  const displayName = (session.githubUsername || session.displayName || "there").split(" ")[0];

  return (
    <div>
      {userProjects.length === 0 ? (
        <div>
          <div className="mb-8">
            <Welcome name={displayName} />
            <p className="text-xs text-muted-foreground">Describe what you want and AI will build it.</p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <Link
              href="/dashboard/new"
              className="flex items-center justify-center gap-2 rounded-lg ring-1 ring-foreground/10 py-3 text-sm font-medium hover:ring-foreground/20 transition-all"
            >
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Create new
            </Link>
            <ProjectActions showNewButton={false} githubConnected={!!session.githubToken} inline />
          </div>

          {/* Templates */}
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Templates</p>
          <div className="flex flex-col">
            <TemplateCard
              name="Landing Page"
              prompt="A modern SaaS landing page with a hero section, features grid with icons, pricing table with 3 tiers, testimonials, and a waitlist signup form. Use a clean, professional design."
              icon={Globe}
            />
            <TemplateCard
              name="Portfolio"
              prompt="A minimal personal portfolio website with a bio section, a grid of project cards with images and descriptions, a skills section, and a contact form. Dark theme, elegant typography."
              icon={FileText}
            />
            <TemplateCard
              name="Blog"
              prompt="A minimal blog homepage with a header, a list of blog post cards with title, date, excerpt, and a featured post at the top. Include a sidebar with categories and an about section. Clean, readable design."
              icon={FileText}
            />
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-bold">Projects</h1>
            <ProjectActions githubConnected={!!session.githubToken} />
          </div>
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
                {project.githubRepo && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <GithubIcon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{project.githubRepo}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    {project.githubRepo && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <GitBranch className="h-2.5 w-2.5" />
                        {project.branch}
                      </span>
                    )}
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
  const label = STATUS_LABELS[status] || "Offline";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0 ${s.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}
