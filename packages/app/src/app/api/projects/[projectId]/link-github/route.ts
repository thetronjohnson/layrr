import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { linkGithubRepo } from "@/lib/server-api";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const { repoName } = await req.json();
  if (!repoName) return NextResponse.json({ error: "Missing repo name" }, { status: 400 });

  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.userId)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [user] = await db.select().from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user?.githubToken) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  const githubRepo = `${user.githubUsername}/${repoName}`;

  // Create the repo on GitHub
  const createRes = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${user.githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: repoName, private: false }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    if (createRes.status === 422) {
      return NextResponse.json({ error: "Repository name already taken" }, { status: 422 });
    }
    return NextResponse.json({ error: err.message || "Failed to create repository" }, { status: createRes.status });
  }

  // Push workspace to the new repo via Hono server
  const pushResult = await linkGithubRepo(projectId, githubRepo, user.githubToken);
  if (!pushResult.success) {
    return NextResponse.json({ error: pushResult.message || "Failed to push to repository" }, { status: 500 });
  }

  // Update project in DB
  await db.update(projects).set({
    githubRepo,
    sourceType: "github" as any,
    updatedAt: new Date(),
  }).where(eq(projects.id, projectId));

  return NextResponse.json({ success: true, githubRepo });
}
