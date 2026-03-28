import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createFromTemplate } from "@/lib/server-api";
import { NextResponse } from "next/server";

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = generateSlug(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const [existing] = await db.select().from(projects).where(eq(projects.slug, candidate)).limit(1);
    if (!existing) return candidate;
    attempt++;
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, prompt } = await req.json();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const slug = await uniqueSlug(name);

  const [project] = await db.insert(projects).values({
    userId: session.userId,
    name,
    slug,
    sourceType: "template",
    framework: "nextjs",
    initialPrompt: prompt || null,
    containerStatus: "CREATING",
  }).returning();

  // Fire and forget
  createFromTemplate(project.id, name, prompt || '', user?.githubUsername || 'layrr', user?.email || 'layrr@layrr.dev', session.userId, undefined, slug)
    .then(async () => {
      await db.update(projects).set({ containerStatus: "RUNNING" as any, updatedAt: new Date() }).where(eq(projects.id, project.id));
    })
    .catch(async () => {
      await db.update(projects).set({ containerStatus: "ERROR" as any, updatedAt: new Date() }).where(eq(projects.id, project.id));
    });

  return NextResponse.json({ id: project.id });
}
