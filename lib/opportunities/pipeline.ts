import { and, eq } from "drizzle-orm";
import { assertRole, isPipelineStatus, type PipelineStatus } from "../auth/roles";
import type { Principal } from "../auth/principal";
import type { AppDatabase } from "../db/client";
import { opportunities, pipelineEntries } from "../db/schema";
import { isUuid } from "../domain";
import { AppError } from "../auth/roles";

export async function setPipeline(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  status: PipelineStatus | "clear",
): Promise<void> {
  assertRole(principal.role, "member");
  if (!isUuid(opportunityId)) throw new AppError("not-found", "Opportunity not found.", 404);
  if (status !== "clear" && !isPipelineStatus(status)) {
    throw new AppError("invalid-status", "Pipeline status is not recognized.", 400);
  }
  const [opportunity] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(and(eq(opportunities.id, opportunityId), eq(opportunities.plane, principal.plane)))
    .limit(1);
  if (!opportunity) throw new AppError("not-found", "Opportunity not found.", 404);
  const scope = and(
    eq(pipelineEntries.organizationId, principal.organizationId),
    eq(pipelineEntries.opportunityId, opportunityId),
  );
  if (status === "clear") {
    await db.delete(pipelineEntries).where(scope);
    return;
  }
  const now = new Date();
  await db
    .insert(pipelineEntries)
    .values({
      organizationId: principal.organizationId,
      opportunityId,
      status,
      updatedBy: principal.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [pipelineEntries.organizationId, pipelineEntries.opportunityId],
      set: { status, updatedBy: principal.userId, updatedAt: now },
    });
}
