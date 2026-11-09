import { and, eq } from "drizzle-orm";
import { askStoredDraft } from "../ai/config";
import { AppError, assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import { asDate, utcToday } from "../dates";
import type { AppDatabase } from "../db/client";
import { opportunities, pursuitDecisions, pursuitDrafts } from "../db/schema";
import { eligibilityForOpportunity } from "../eligibility/service";
import { getOpportunity } from "../opportunities/detail";
import { isReadinessCategory, type ReadinessCategory, type ReadinessFlag } from "../readiness/model";
import { listReadiness } from "../readiness/service";
import { cleanText } from "../text";
import {
  captureGaps,
  isRecommendation,
  storedPursuitPacket,
  suggestFromStored,
  type FitInput,
  type FitRecord,
  type Recommendation,
  type Suggestion,
} from "./model";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type PursuitDecision = {
  recommendation: Recommendation;
  reason: string;
  updatedAt: Date;
};

export type PursuitDraft = {
  model: string;
  draft: string | null;
  error: string | null;
  updatedAt: Date;
};

export type PursuitView = {
  opportunityId: string;
  title: string;
  solicitationNumber: string | null;
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  agency: string | null;
  notice: string | null;
  deadline: string | null;
  deadlineRaw: string | null;
  costSharing: boolean | null;
  fit: FitInput;
  gaps: string[];
  suggestion: Suggestion;
  decision: PursuitDecision | null;
  draft: PursuitDraft | null;
};

function fitRecords(
  records: {
    category: ReadinessCategory;
    label: string | null;
    recordedValue: string | null;
    status: string | null;
    source: string | null;
    verifiedOn: string | null;
    expiresOn: string | null;
    responsiblePerson: string | null;
    flags: ReadinessFlag[];
  }[],
): FitRecord[] {
  return records.map((record) => ({
    category: record.category,
    label: record.label,
    recordedValue: record.recordedValue,
    status: record.status,
    source: record.source,
    verifiedOn: record.verifiedOn,
    expiresOn: record.expiresOn,
    responsiblePerson: record.responsiblePerson,
    flags: record.flags,
  }));
}

export async function pursuitView(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  today = utcToday(),
): Promise<PursuitView | null> {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) return null;
  const eligibility = await eligibilityForOpportunity(db, principal, opportunity.id);
  if (!eligibility) return null;
  const readiness = await listReadiness(db, principal, today);
  const fit: FitInput = {
    eligibilityLoaded: eligibility.loaded,
    lines: eligibility.lines.map((line) => ({
      text: line.text,
      sourceLabel: line.sourceLabel,
      disposition: line.disposition,
    })),
    missingCategories: readiness.missing.filter((category): category is ReadinessCategory => isReadinessCategory(category)),
    records: fitRecords(readiness.records),
  };
  const agency = opportunity.agency;
  const notice = opportunity.description;
  const deadline = opportunity.deadline;
  const gaps = captureGaps({ ...fit, agency, notice, deadline });
  const suggestion = suggestFromStored(fit);
  const [decisionRow] = await db
    .select({
      recommendation: pursuitDecisions.recommendation,
      reason: pursuitDecisions.reason,
      updatedAt: pursuitDecisions.updatedAt,
    })
    .from(pursuitDecisions)
    .innerJoin(opportunities, eq(pursuitDecisions.opportunityId, opportunities.id))
    .where(
      and(
        eq(pursuitDecisions.organizationId, principal.organizationId),
        eq(pursuitDecisions.opportunityId, opportunity.id),
        eq(opportunities.plane, principal.plane),
      ),
    )
    .limit(1);
  const [draftRow] = await db
    .select({
      model: pursuitDrafts.model,
      draft: pursuitDrafts.draft,
      error: pursuitDrafts.error,
      updatedAt: pursuitDrafts.updatedAt,
    })
    .from(pursuitDrafts)
    .innerJoin(opportunities, eq(pursuitDrafts.opportunityId, opportunities.id))
    .where(
      and(
        eq(pursuitDrafts.organizationId, principal.organizationId),
        eq(pursuitDrafts.opportunityId, opportunity.id),
        eq(opportunities.plane, principal.plane),
      ),
    )
    .limit(1);
  const decision = decisionRow && isRecommendation(decisionRow.recommendation)
    ? { recommendation: decisionRow.recommendation, reason: decisionRow.reason, updatedAt: asDate(decisionRow.updatedAt) }
    : null;
  return {
    opportunityId: opportunity.id,
    title: opportunity.title,
    solicitationNumber: opportunity.solicitationNumber,
    source: opportunity.source,
    sourceId: opportunity.sourceId,
    sourceUrl: opportunity.sourceUrl,
    agency,
    notice,
    deadline,
    deadlineRaw: opportunity.deadlineRaw,
    costSharing: eligibility.costSharing,
    fit,
    gaps,
    suggestion,
    decision,
    draft: draftRow ? { ...draftRow, updatedAt: asDate(draftRow.updatedAt) } : null,
  };
}

export async function savePursuitDecision(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  recommendation: string,
  reason: string,
): Promise<void> {
  assertRole(principal.role, "member");
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) throw new AppError("not-found", "That record is not in this catalog.", 404);
  if (!isRecommendation(recommendation)) throw new AppError("pursuit-invalid", "That recommendation is not recognized.", 400);
  const cleanReason = cleanText(reason, 2000);
  if (!cleanReason) throw new AppError("pursuit-reason", "Enter a reason for the recommendation.", 400);
  const now = new Date();
  await db
    .insert(pursuitDecisions)
    .values({
      organizationId: principal.organizationId,
      opportunityId: opportunity.id,
      recommendation,
      reason: cleanReason,
      updatedBy: principal.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [pursuitDecisions.organizationId, pursuitDecisions.opportunityId],
      set: { recommendation, reason: cleanReason, updatedBy: principal.userId, updatedAt: now },
    });
}

export async function draftPursuit(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  options: { fetchImpl?: FetchLike; apiKey?: string | null; today?: string } = {},
): Promise<"drafted" | "failed"> {
  assertRole(principal.role, "member");
  const view = await pursuitView(db, principal, opportunityId, options.today ?? utcToday());
  if (!view) throw new AppError("not-found", "That record is not in this catalog.", 404);
  const packet = storedPursuitPacket({
    title: view.title,
    solicitationNumber: view.solicitationNumber,
    source: view.source,
    sourceId: view.sourceId,
    sourceUrl: view.sourceUrl,
    agency: view.agency,
    notice: view.notice,
    deadline: view.deadline,
    deadlineRaw: view.deadlineRaw,
    costSharing: view.costSharing,
    fit: view.fit,
    suggestion: view.suggestion,
    gaps: view.gaps,
  });
  const result = await askStoredDraft(db, principal, { packet, fetchImpl: options.fetchImpl, apiKey: options.apiKey });
  const now = new Date();
  await db
    .insert(pursuitDrafts)
    .values({
      organizationId: principal.organizationId,
      opportunityId: view.opportunityId,
      model: result.model,
      draft: result.draft,
      error: result.error,
      updatedBy: principal.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [pursuitDrafts.organizationId, pursuitDrafts.opportunityId],
      set: { model: result.model, draft: result.draft, error: result.error, updatedBy: principal.userId, updatedAt: now },
    });
  return result.draft ? "drafted" : "failed";
}
