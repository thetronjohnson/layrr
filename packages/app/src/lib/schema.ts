import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  githubId: text("github_id").unique().notNull(),
  email: text("email").notNull(),
  githubUsername: text("github_username"),
  githubToken: text("github_token"),
  plan: text("plan", { enum: ["FREE", "PRO"] }).default("FREE").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  githubRepo: text("github_repo"),
  branch: text("branch").default("main").notNull(),
  sourceType: text("source_type", { enum: ["github", "template"] }).default("github").notNull(),
  initialPrompt: text("initial_prompt"),
  framework: text("framework"),
  sharePassword: text("share_password"),
  containerStatus: text("container_status", {
    enum: ["CREATING", "STARTING", "RUNNING", "STOPPING", "STOPPED", "ERROR"],
  }).default("STOPPED").notNull(),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const editEvents = sqliteTable("edit_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  instruction: text("instruction").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
