import { and, eq } from "drizzle-orm";
import { askStoredDraft } from "../ai/config";
import { AppError, assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import { asDate, isRealIsoDate } from "../dates";
import type { AppDatabase } from "../db/client";
import {
  opportunities,
  proposalDrafts,
  proposalInclusions,
  proposalMatrix,
  proposalProjects,
  proposalSections,
  readinessRecords,
  verifiedProjects,
} from "../db/schema";
import { requirementsFromFacts, type SourceRequirement } from "../eligibility/model";
import { getOpportunity } from "../opportunities/detail";
import { CATEGORY_LABEL, isReadinessCategory, type ReadinessCategory } from "../readiness/model";
import { listReadiness, type ReadinessRow } from "../readiness/service";
import { cleanText } from "../text";
import { renderProposalPdf } from "./pdf";
import {
  PROPOSAL_DRAFT_INSTRUCTIONS,
  emptySections,
  isCompletion,
  isProposalSection,
  isTextSection,
  optionalDate,
  projectName,
  proposalExportLines,
  proposalText,
  type Completion,
  type ExportProject,
  type ProposalSection,
  type SavedSections,
  type TextSection,
} from "./model";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type MatrixLine = SourceRequirement & {
  section: ProposalSection | null;
  completion: Completion | null;
};

export type IncludedReadiness = {
  id: string;
  category: ReadinessCategory;
  label: string | null;
  recordedValue: string | null;
};

export type VerifiedProject = {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  completedOn: string | null;
  included: boolean;
};

export type ProposalDraft = {
  model: string;
  draft: string | null;
  error: string | null;
  updatedAt: Date;
};

export type ProposalView = {
  opportunityId: string;
  title: string;
  solicitationNumber: string | null;
  sections: SavedSections;
  readiness: ReadinessRow[];
  includedReadinessIds: string[];
  projects: VerifiedProject[];
  matrixLoaded: boolean;
  matrix: MatrixLine[];
  draft: ProposalDraft | null;
};

function dateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const iso = value.slice(0, 10);
    return isRealIsoDate(iso) ? iso : null;
  }
  return null;
}

async function requireOpportunity(db: AppDatabase, principal: Principal, opportunityId: string) {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) throw new AppError("not-found", "That record is not in this catalog.", 404);
  return opportunity;
}

export async function proposalView(db: AppDatabase, principal: Principal, opportunityId: string): Promise<ProposalView | null> {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) return null;
  const scope = and(
    eq(opportunities.id, opportunity.id),
    eq(opportunities.plane, principal.plane),
  );
  const sectionRows = await db
    .select({ section: proposalSections.section, body: proposalSections.body })
    .from(proposalSections)
    .innerJoin(opportunities, eq(proposalSections.opportunityId, opportunities.id))
    .where(and(eq(proposalSections.organizationId, principal.organizationId), scope));
  const sections = emptySections();
  for (const row of sectionRows) {
    if (isTextSection(row.section)) sections[row.section] = row.body;
  }
  const inclusionRows = await db
    .select({ readinessId: proposalInclusions.readinessId })
    .from(proposalInclusions)
    .innerJoin(opportunities, eq(proposalInclusions.opportunityId, opportunities.id))
    .where(and(eq(proposalInclusions.organizationId, principal.organizationId), scope));
  const projectRows = await db
    .select()
    .from(verifiedProjects)
    .where(eq(verifiedProjects.organizationId, principal.organizationId));
  const includedProjects = await db
    .select({ projectId: proposalProjects.projectId })
    .from(proposalProjects)
    .innerJoin(opportunities, eq(proposalProjects.opportunityId, opportunities.id))
    .where(and(eq(proposalProjects.organizationId, principal.organizationId), scope));
  const includedProjectIds = new Set(includedProjects.map((row) => row.projectId));
  const matrixRows = await db
    .select({
      sourceKey: proposalMatrix.sourceKey,
      section: proposalMatrix.section,
      completion: proposalMatrix.completion,
    })
    .from(proposalMatrix)
    .innerJoin(opportunities, eq(proposalMatrix.opportunityId, opportunities.id))
    .where(and(eq(proposalMatrix.organizationId, principal.organizationId), scope));
  const marks = new Map(matrixRows.map((row) => [row.sourceKey, row]));
  const parsed = requirementsFromFacts(opportunity.sourceFacts);
  const [draftRow] = await db
    .select({
      model: proposalDrafts.model,
      draft: proposalDrafts.draft,
      error: proposalDrafts.error,
      updatedAt: proposalDrafts.updatedAt,
    })
    .from(proposalDrafts)
    .innerJoin(opportunities, eq(proposalDrafts.opportunityId, opportunities.id))
    .where(and(eq(proposalDrafts.organizationId, principal.organizationId), scope))
    .limit(1);
  const readiness = await listReadiness(db, principal, new Date().toISOString().slice(0, 10));
  return {
    opportunityId: opportunity.id,
    title: opportunity.title,
    solicitationNumber: opportunity.solicitationNumber,
    sections,
    readiness: readiness.records,
    includedReadinessIds: inclusionRows.map((row) => row.readinessId),
    projects: projectRows.map((row) => ({
      id: row.id,
      name: row.name,
      client: row.client,
      description: row.description,
      completedOn: dateOnly(row.completedOn),
      included: includedProjectIds.has(row.id),
    })),
    matrixLoaded: parsed.loaded,
    matrix: parsed.requirements.map((requirement) => {
      const saved = marks.get(requirement.sourceKey);
      return {
        ...requirement,
        section: saved && isProposalSection(saved.section) ? saved.section : null,
        completion: saved && isCompletion(saved.completion) ? saved.completion : null,
      };
    }),
    draft: draftRow
      ? { model: draftRow.model, draft: draftRow.draft, error: draftRow.error, updatedAt: asDate(draftRow.updatedAt) }
      : null,
  };
}

export async function saveProposalSection(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  section: string,
  body: string,
): Promise<void> {
  assertRole(principal.role, "member");
  if (!isTextSection(section)) throw new AppError("proposal-invalid", "That section cannot store freeform text.", 400);
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const text = proposalText(body);
  const scope = and(
    eq(proposalSections.organizationId, principal.organizationId),
    eq(proposalSections.opportunityId, opportunity.id),
    eq(proposalSections.section, section),
  );
  if (!text) {
    await db.delete(proposalSections).where(scope);
    return;
  }
  const now = new Date();
  await db
    .insert(proposalSections)
    .values({
      organizationId: principal.organizationId,
      opportunityId: opportunity.id,
      section,
      body: text,
      updatedBy: principal.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [proposalSections.organizationId, proposalSections.opportunityId, proposalSections.section],
      set: { body: text, updatedBy: principal.userId, updatedAt: now },
    });
}

export async function setReadinessInclusion(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  readinessId: string,
  include: boolean,
): Promise<void> {
  assertRole(principal.role, "member");
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const [record] = await db
    .select({ id: readinessRecords.id })
    .from(readinessRecords)
    .where(and(eq(readinessRecords.id, readinessId), eq(readinessRecords.organizationId, principal.organizationId)))
    .limit(1);
  if (!record) throw new AppError("not-found", "That readiness record is not in this organization.", 404);
  const scope = and(
    eq(proposalInclusions.organizationId, principal.organizationId),
    eq(proposalInclusions.opportunityId, opportunity.id),
    eq(proposalInclusions.readinessId, record.id),
  );
  if (!include) {
    await db.delete(proposalInclusions).where(scope);
    return;
  }
  await db.insert(proposalInclusions).values({
    organizationId: principal.organizationId,
    opportunityId: opportunity.id,
    readinessId: record.id,
  }).onConflictDoNothing();
}

export async function addVerifiedProject(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  input: { name: string; client: string; description: string; completedOn: string },
): Promise<void> {
  assertRole(principal.role, "member");
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const name = projectName(input.name);
  if (!name) throw new AppError("proposal-invalid", "Enter the project name that should be stored.", 400);
  const completedOn = optionalDate(input.completedOn);
  if (completedOn === "invalid") throw new AppError("proposal-invalid", "Completion date must be blank or a real calendar date.", 400);
  const existing = await db
    .select({ id: verifiedProjects.id })
    .from(verifiedProjects)
    .where(eq(verifiedProjects.organizationId, principal.organizationId));
  if (existing.length >= 50) throw new AppError("proposal-invalid", "This organization already has 50 verified projects.", 409);
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(verifiedProjects).values({
    id,
    organizationId: principal.organizationId,
    name,
    client: cleanText(input.client, 200),
    description: cleanText(input.description, 2000),
    completedOn,
    updatedBy: principal.userId,
    updatedAt: now,
  });
  await db.insert(proposalProjects).values({
    organizationId: principal.organizationId,
    opportunityId: opportunity.id,
    projectId: id,
  });
}

export async function setProjectInclusion(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  projectId: string,
  include: boolean,
): Promise<void> {
  assertRole(principal.role, "member");
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const [project] = await db
    .select({ id: verifiedProjects.id })
    .from(verifiedProjects)
    .where(and(eq(verifiedProjects.id, projectId), eq(verifiedProjects.organizationId, principal.organizationId)))
    .limit(1);
  if (!project) throw new AppError("not-found", "That project is not in this organization.", 404);
  const scope = and(
    eq(proposalProjects.organizationId, principal.organizationId),
    eq(proposalProjects.opportunityId, opportunity.id),
    eq(proposalProjects.projectId, project.id),
  );
  if (!include) {
    await db.delete(proposalProjects).where(scope);
    return;
  }
  await db.insert(proposalProjects).values({
    organizationId: principal.organizationId,
    opportunityId: opportunity.id,
    projectId: project.id,
  }).onConflictDoNothing();
}

export async function saveMatrixLine(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  sourceKey: string,
  section: string,
  completion: string,
): Promise<void> {
  assertRole(principal.role, "member");
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const requirements = requirementsFromFacts(opportunity.sourceFacts).requirements;
  if (!requirements.some((item) => item.sourceKey === sourceKey)) {
    throw new AppError("proposal-invalid", "That requirement is not on the stored notice.", 400);
  }
  const sectionValue = section.trim();
  const completionValue = completion.trim();
  if (sectionValue !== "" && !isProposalSection(sectionValue)) throw new AppError("proposal-invalid", "That section is not recognized.", 400);
  if (completionValue !== "" && !isCompletion(completionValue)) throw new AppError("proposal-invalid", "That completion status is not recognized.", 400);
  const scope = and(
    eq(proposalMatrix.organizationId, principal.organizationId),
    eq(proposalMatrix.opportunityId, opportunity.id),
    eq(proposalMatrix.sourceKey, sourceKey),
  );
  if (sectionValue === "" && completionValue === "") {
    await db.delete(proposalMatrix).where(scope);
    return;
  }
  const now = new Date();
  await db
    .insert(proposalMatrix)
    .values({
      organizationId: principal.organizationId,
      opportunityId: opportunity.id,
      sourceKey,
      section: sectionValue === "" ? null : sectionValue,
      completion: completionValue === "" ? null : completionValue,
      updatedBy: principal.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [proposalMatrix.organizationId, proposalMatrix.opportunityId, proposalMatrix.sourceKey],
      set: {
        section: sectionValue === "" ? null : sectionValue,
        completion: completionValue === "" ? null : completionValue,
        updatedBy: principal.userId,
        updatedAt: now,
      },
    });
}

export async function draftProposal(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  options: { fetchImpl?: FetchLike; apiKey?: string | null } = {},
): Promise<"drafted" | "failed"> {
  assertRole(principal.role, "member");
  const view = await proposalView(db, principal, opportunityId);
  if (!view) throw new AppError("not-found", "That record is not in this catalog.", 404);
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const notice = opportunity.description;
  const packet = {
    title: opportunity.title,
    agency: opportunity.agency,
    solicitationNumber: opportunity.solicitationNumber,
    deadline: opportunity.deadline,
    noticeText: notice && notice.length > 6000 ? notice.slice(0, 6000) : notice,
    noticeTruncated: Boolean(notice && notice.length > 6000),
    applicantTypes: opportunity.sourceFacts.applicantTypes ?? null,
    savedSections: view.sections,
    readiness: view.readiness.map((record) => ({
      category: record.category,
      label: record.label,
      recordedValue: record.recordedValue,
      status: record.status,
      source: record.source,
      verifiedOn: record.verifiedOn,
      expiresOn: record.expiresOn,
      responsiblePerson: record.responsiblePerson,
    })),
    verifiedProjects: view.projects.map((project) => ({
      name: project.name,
      client: project.client,
      description: project.description,
      completedOn: project.completedOn,
    })),
  };
  const result = await askStoredDraft(db, principal, {
    packet,
    fetchImpl: options.fetchImpl,
    apiKey: options.apiKey,
    instructions: PROPOSAL_DRAFT_INSTRUCTIONS,
  });
  const now = new Date();
  await db
    .insert(proposalDrafts)
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
      target: [proposalDrafts.organizationId, proposalDrafts.opportunityId],
      set: { model: result.model, draft: result.draft, error: result.error, updatedBy: principal.userId, updatedAt: now },
    });
  return result.draft ? "drafted" : "failed";
}

export async function saveDraftIntoSection(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  section: string,
): Promise<void> {
  assertRole(principal.role, "member");
  if (!isTextSection(section)) throw new AppError("proposal-invalid", "Past performance is not filled from model text.", 400);
  const view = await proposalView(db, principal, opportunityId);
  if (!view?.draft?.draft) throw new AppError("proposal-invalid", "There is no model draft to save.", 400);
  await saveProposalSection(db, principal, opportunityId, section, view.draft.draft);
}

export async function proposalPdf(db: AppDatabase, principal: Principal, opportunityId: string): Promise<Buffer | null> {
  const view = await proposalView(db, principal, opportunityId);
  if (!view) return null;
  const included = new Set(view.includedReadinessIds);
  const readiness = view.readiness
    .filter((record) => included.has(record.id))
    .map((record) => ({
      category: CATEGORY_LABEL[record.category],
      label: record.label,
      recordedValue: record.recordedValue,
    }));
  const projects: ExportProject[] = view.projects
    .filter((project) => project.included)
    .map((project) => ({
      name: project.name,
      client: project.client,
      description: project.description,
      completedOn: project.completedOn,
    }));
  const lines = proposalExportLines({
    sections: view.sections,
    readiness,
    projects,
  });
  return renderProposalPdf(lines);
}
