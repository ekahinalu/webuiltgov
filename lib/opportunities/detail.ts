import { and, eq } from "drizzle-orm";
import type { Principal } from "../auth/principal";
import type { AppDatabase } from "../db/client";
import { opportunities, pipelineEntries } from "../db/schema";
import { isUuid, type SourceFacts } from "../domain";
import { asDate } from "../dates";
import { asRecord } from "../json";

export type OpportunityDetail = {
  id: string;
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  agency: string | null;
  solicitationNumber: string | null;
  title: string;
  description: string | null;
  governmentLevel: string | null;
  location: string | null;
  naics: string | null;
  deadline: string | null;
  deadlineRaw: string | null;
  lastVerifiedAt: Date;
  recordKind: string;
  sourceFacts: SourceFacts;
  pipelineStatus: string | null;
};

export async function getOpportunity(
  db: AppDatabase,
  principal: Principal,
  id: string,
): Promise<OpportunityDetail | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({
      id: opportunities.id,
      source: opportunities.source,
      sourceId: opportunities.sourceId,
      sourceUrl: opportunities.sourceUrl,
      agency: opportunities.agency,
      solicitationNumber: opportunities.solicitationNumber,
      title: opportunities.title,
      description: opportunities.description,
      governmentLevel: opportunities.governmentLevel,
      location: opportunities.location,
      naics: opportunities.naics,
      deadline: opportunities.deadline,
      deadlineRaw: opportunities.deadlineRaw,
      lastVerifiedAt: opportunities.lastVerifiedAt,
      recordKind: opportunities.recordKind,
      sourceFacts: opportunities.sourceFacts,
      pipelineStatus: pipelineEntries.status,
    })
    .from(opportunities)
    .leftJoin(
      pipelineEntries,
      and(eq(pipelineEntries.opportunityId, opportunities.id), eq(pipelineEntries.organizationId, principal.organizationId)),
    )
    .where(and(eq(opportunities.id, id), eq(opportunities.plane, principal.plane)))
    .limit(1);
  if (!row) return null;
  const facts = asRecord(row.sourceFacts) ?? {};
  return { ...row, lastVerifiedAt: asDate(row.lastVerifiedAt), sourceFacts: facts as SourceFacts };
}
