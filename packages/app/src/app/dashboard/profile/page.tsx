import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CancelButton } from "./cancel-button";

const STATUS_LABELS: Record<string, { label: string; style: string }> = {
  trialing: { label: "Trial", style: "bg-yellow-400/10 text-yellow-400" },
  active: { label: "Active", style: "bg-success/10 text-success" },
  canceled: { label: "Canceled", style: "bg-destructive/10 text-destructive" },
  past_due: { label: "Past due", style: "bg-destructive/10 text-destructive" },
  none: { label: "No subscription", style: "bg-secondary text-muted-foreground" },
};

export default async function ProfilePage() {
  const session = await getSession();
  if (!session.userId) redirect("/sign-in");

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) redirect("/sign-in");

  const status = STATUS_LABELS[user.subscriptionStatus] || STATUS_LABELS.none;
  const endsAt = user.subscriptionEndsAt
    ? new Date(typeof user.subscriptionEndsAt === "number" ? user.subscriptionEndsAt * 1000 : user.subscriptionEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
  const canCancel = (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") && !user.cancelAtPeriodEnd;

  return (
    <div>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-3 w-3" />
        Projects
      </Link>

      <h1 className="text-xl font-bold mb-8">Profile</h1>

      <div className="space-y-6 max-w-md">
        <div className="rounded-xl ring-1 ring-foreground/10 p-5 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Email</p>
            <p className="text-sm">{user.email}</p>
          </div>

          {user.githubUsername && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">GitHub</p>
              <p className="text-sm">{user.githubUsername}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl ring-1 ring-foreground/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Subscription</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${status.style}`}>
                {status.label}
              </span>
            </div>
            <p className="text-2xl font-bold">$29<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
          </div>

          {endsAt && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">
                {user.cancelAtPeriodEnd || user.subscriptionStatus === "canceled" ? "Access until" : "Next billing date"}
              </p>
              <p className="text-sm">{endsAt}</p>
            </div>
          )}

          {user.cancelAtPeriodEnd && user.subscriptionStatus !== "canceled" && (
            <p className="text-xs text-muted-foreground">Your subscription will end at the next billing date. You'll have access until then.</p>
          )}

          {canCancel && <CancelButton />}
        </div>
      </div>
    </div>
  );
}
