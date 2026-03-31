import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listRepos } from "@/lib/github";
import { RepoSelector } from "./repo-selector";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export default async function NewProjectPage() {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");

  if (!session.githubToken) {
    return (
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3 w-3" />
          Projects
        </Link>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <div className="mb-4 rounded-full bg-secondary p-3">
            <GithubIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mb-1 text-sm font-medium">Connect your GitHub account</p>
          <p className="mb-6 text-xs text-muted-foreground max-w-xs text-center">
            To import repositories, you need to connect your GitHub account.
          </p>
          <a
            href="/api/auth/github"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <GithubIcon className="h-3.5 w-3.5" />
            Connect GitHub
          </a>
        </div>
      </div>
    );
  }

  let repos;
  try {
    repos = await listRepos(session.githubToken);
  } catch {
    return (
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3 w-3" />
          Projects
        </Link>
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Failed to load repositories. Please try again.</p>
          <a href="/api/auth/github" className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Reconnect GitHub
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Import from GitHub</h1>
      <p className="mb-8 text-sm text-muted-foreground">Select a repository to start editing visually.</p>
      <RepoSelector repos={repos} />
    </div>
  );
}
