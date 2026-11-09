import { and, eq } from "drizzle-orm";
import { AppError, assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import { bidWorkspace } from "../bids/service";
import type { BidStage } from "../bids/model";
import { asDate } from "../dates";
import type { AppDatabase } from "../db/client";
import { bids, submissionRecords } from "../db/schema";
import { getOpportunity } from "../opportunities/detail";
import { proposalView } from "../proposals/service";
import { cleanText } from "../text";
import {
  parseSubmissionTime,
  requiredEntry,
  submissionChecklist,
  type ChecklistLine,
} from "./model";

export type SubmissionRecord = {
  confirmationNumber: string;
  destination: string;
  submittedAt: Date;
  enteredBy: string;
  enteredByName: string;
  recordedAt: Date;
};

export type InternalApproval = {
  userId: string;
  name: string;
  at: Date;
};

export type SubmissionWorkspace = {
  opportunityId: string;
  title: string;
  solicitationNumber: string | null;
  checklist: ChecklistLine[];
  matrixLoaded: boolean;
  priceState: "none" | "draft" | "approved";
  priceApprovedByName: string | null;
  priceApprovedAt: Date | null;
  bidStage: BidStage | null;
  approval: InternalApproval | null;
  submission: SubmissionRecord | null;
};

async function requireOpportunity(db: AppDatabase, principal: Principal, opportunityId: string) {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) throw new AppError("not-found", "That record is not in this catalog.", 404);
  return opportunity;
}

export async function submissionWorkspace(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
): Promise<SubmissionWorkspace | null> {
  const proposal = await proposalView(db, principal, opportunityId);
  if (!proposal) return null;
  const bid = await bidWorkspace(db, principal, opportunityId);
  const [row] = await db
    .select({
      internalApprovedBy: submissionRecords.internalApprovedBy,
      internalApprovedByName: submissionRecords.internalApprovedByName,
      internalApprovedAt: submissionRecords.internalApprovedAt,
      confirmationNumber: submissionRecords.confirmationNumber,
      destination: submissionRecords.destination,
      submittedAt: submissionRecords.submittedAt,
      enteredBy: submissionRecords.enteredBy,
      enteredByName: submissionRecords.enteredByName,
      recordedAt: submissionRecords.recordedAt,
    })
    .from(submissionRecords)
    .where(
      and(
        eq(submissionRecords.organizationId, principal.organizationId),
        eq(submissionRecords.opportunityId, proposal.opportunityId),
      ),
    )
    .limit(1);
  const pastPerformanceSaved = proposal.includedReadinessIds.length > 0 || proposal.projects.some((project) => project.included);
  const approval = row?.internalApprovedAt && row.internalApprovedBy && row.internalApprovedByName
    ? { userId: row.internalApprovedBy, name: row.internalApprovedByName, at: asDate(row.internalApprovedAt) }
    : null;
  const submission = row?.confirmationNumber && row.destination && row.submittedAt && row.enteredBy && row.enteredByName && row.recordedAt
    ? {
        confirmationNumber: row.confirmationNumber,
        destination: row.destination,
        submittedAt: asDate(row.submittedAt),
        enteredBy: row.enteredBy,
        enteredByName: row.enteredByName,
        recordedAt: asDate(row.recordedAt),
      }
    : null;
  return {
    opportunityId: proposal.opportunityId,
    title: proposal.title,
    solicitationNumber: proposal.solicitationNumber,
    checklist: submissionChecklist({
      sections: proposal.sections,
      pastPerformanceSaved,
      matrix: proposal.matrix.map((line) => ({
        sourceKey: line.sourceKey,
        text: line.text,
        section: line.section,
        completion: line.completion,
      })),
    }),
    matrixLoaded: proposal.matrixLoaded,
    priceState: bid?.bid?.priceState ?? "none",
    priceApprovedByName: bid?.bid?.approvedByName ?? null,
    priceApprovedAt: bid?.bid?.approvedAt ?? null,
    bidStage: bid?.bid?.stage ?? null,
    approval,
    submission,
  };
}

export async function recordInternalApproval(db: AppDatabase, principal: Principal, opportunityId: string): Promise<void> {
  assertRole(principal.role, "member");
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const name = cleanText(principal.name, 120) ?? "Member";
  const now = new Date();
  await db
    .insert(submissionRecords)
    .values({
      organizationId: principal.organizationId,
      opportunityId: opportunity.id,
      internalApprovedBy: principal.userId,
      internalApprovedByName: name,
      internalApprovedAt: now,
    })
    .onConflictDoUpdate({
      target: [submissionRecords.organizationId, submissionRecords.opportunityId],
      set: {
        internalApprovedBy: principal.userId,
        internalApprovedByName: name,
        internalApprovedAt: now,
      },
    });
}

export async function recordSubmission(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  fields: { confirmationNumber: string; destination: string; submittedAt: string },
): Promise<void> {
  assertRole(principal.role, "member");
  const confirmationNumber = requiredEntry(fields.confirmationNumber, 200);
  const destination = requiredEntry(fields.destination, 500);
  const submittedAt = parseSubmissionTime(fields.submittedAt);
  if (!confirmationNumber || !destination || submittedAt === null) {
    throw new AppError("submission-incomplete", "Enter a confirmation number, an official destination, and a time.", 400);
  }
  if (submittedAt === "invalid") {
    throw new AppError("submission-invalid", "Enter a time as a date and time.", 400);
  }
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const name = cleanText(principal.name, 120) ?? "Member";
  const now = new Date();
  await db
    .insert(submissionRecords)
    .values({
      organizationId: principal.organizationId,
      opportunityId: opportunity.id,
      confirmationNumber,
      destination,
      submittedAt,
      enteredBy: principal.userId,
      enteredByName: name,
      recordedAt: now,
    })
    .onConflictDoUpdate({
      target: [submissionRecords.organizationId, submissionRecords.opportunityId],
      set: {
        confirmationNumber,
        destination,
        submittedAt,
        enteredBy: principal.userId,
        enteredByName: name,
        recordedAt: now,
      },
    });
  await db
    .insert(bids)
    .values({
      organizationId: principal.organizationId,
      opportunityId: opportunity.id,
      stage: "submitted",
      updatedBy: principal.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [bids.organizationId, bids.opportunityId],
      set: { stage: "submitted", updatedBy: principal.userId, updatedAt: now },
    });
}
