import { and, eq } from "drizzle-orm";
import { AppError, assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import type { AppDatabase } from "../db/client";
import { eligibilityMarks, opportunities } from "../db/schema";
import { getOpportunity } from "../opportunities/detail";
import { isDisposition, requirementsFromFacts, type Disposition, type SourceRequirement } from "./model";

export type EligibilityLine = SourceRequirement & { disposition: Disposition | null };

export type EligibilityView = {
  loaded: boolean;
  costSharing: boolean | null;
  lines: EligibilityLine[];
};

export async function eligibilityForOpportunity(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
): Promise<EligibilityView | null> {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) return null;
  const parsed = requirementsFromFacts(opportunity.sourceFacts);
  const marks = await db
    .select({ sourceKey: eligibilityMarks.sourceKey, disposition: eligibilityMarks.disposition })
    .from(eligibilityMarks)
    .innerJoin(opportunities, eq(eligibilityMarks.opportunityId, opportunities.id))
    .where(
      and(
        eq(eligibilityMarks.organizationId, principal.organizationId),
        eq(eligibilityMarks.opportunityId, opportunity.id),
        eq(opportunities.plane, principal.plane),
      ),
    );
  const byKey = new Map<string, Disposition>();
  for (const mark of marks) {
    if (isDisposition(mark.disposition)) byKey.set(mark.sourceKey, mark.disposition);
  }
  return {
    loaded: parsed.loaded,
    costSharing: typeof opportunity.sourceFacts.costSharing === "boolean" ? opportunity.sourceFacts.costSharing : null,
    lines: parsed.requirements.map((requirement) => ({
      ...requirement,
      disposition: byKey.get(requirement.sourceKey) ?? null,
    })),
  };
}

export async function setEligibilityMark(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  sourceKey: string,
  disposition: string,
): Promise<void> {
  assertRole(principal.role, "member");
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) throw new AppError("not-found", "That record is not in this catalog.", 404);
  const match = requirementsFromFacts(opportunity.sourceFacts).requirements.find((item) => item.sourceKey === sourceKey);
  if (!match) throw new AppError("eligibility-invalid", "That requirement is not on the stored source record.", 400);
  if (disposition.trim() === "") {
    await db
      .delete(eligibilityMarks)
      .where(
        and(
          eq(eligibilityMarks.organizationId, principal.organizationId),
          eq(eligibilityMarks.opportunityId, opportunity.id),
          eq(eligibilityMarks.sourceKey, sourceKey),
        ),
      );
    return;
  }
  if (!isDisposition(disposition)) {
    throw new AppError("eligibility-invalid", "That disposition is not recognized.", 400);
  }
  const now = new Date();
  await db
    .insert(eligibilityMarks)
    .values({
      organizationId: principal.organizationId,
      opportunityId: opportunity.id,
      sourceKey,
      disposition,
      updatedBy: principal.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [eligibilityMarks.organizationId, eligibilityMarks.opportunityId, eligibilityMarks.sourceKey],
      set: { disposition, updatedBy: principal.userId, updatedAt: now },
    });
}
