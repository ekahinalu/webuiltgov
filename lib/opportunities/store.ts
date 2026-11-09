import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../db/client";
import { opportunities } from "../db/schema";
import type { ParsedOpportunity, Plane, SourceFacts } from "../domain";
import { asRecord } from "../json";

function factsOf(value: unknown): SourceFacts {
  const record = asRecord(value);
  if (!record) return {};
  return record as SourceFacts;
}

function mergeFacts(existing: unknown, incoming: SourceFacts): SourceFacts {
  const next: SourceFacts = { ...factsOf(existing) };
  for (const [key, item] of Object.entries(incoming)) {
    if (item !== undefined) (next as Record<string, unknown>)[key] = item;
  }
  return next;
}

export async function saveParsedOpportunity(
  db: AppDatabase,
  plane: Plane,
  record: ParsedOpportunity,
  verifiedAt: Date,
): Promise<"inserted" | "updated"> {
  const [existing] = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.plane, plane),
        eq(opportunities.source, record.source),
        eq(opportunities.sourceId, record.sourceId),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(opportunities).values({
      id: crypto.randomUUID(),
      plane,
      source: record.source,
      sourceId: record.sourceId,
      sourceUrl: record.sourceUrl,
      agency: record.agency,
      solicitationNumber: record.solicitationNumber,
      title: record.title,
      description: record.coverage.description ? record.description : null,
      governmentLevel: record.governmentLevel,
      location: record.coverage.location ? record.location : null,
      naics: record.coverage.naics ? record.naics : null,
      deadline: record.deadline,
      deadlineRaw: record.deadlineRaw,
      lastVerifiedAt: verifiedAt,
      recordKind: record.recordKind,
      sourceFacts: record.sourceFacts,
      updatedAt: verifiedAt,
    });
    return "inserted";
  }

  await db
    .update(opportunities)
    .set({
      sourceUrl: record.sourceUrl,
      agency: record.agency,
      solicitationNumber: record.solicitationNumber,
      title: record.title,
      description: record.coverage.description ? record.description : existing.description,
      governmentLevel: record.governmentLevel,
      location: record.coverage.location ? record.location : existing.location,
      naics: record.coverage.naics ? record.naics : existing.naics,
      deadline: record.deadline,
      deadlineRaw: record.deadlineRaw,
      lastVerifiedAt: verifiedAt,
      recordKind: record.recordKind,
      sourceFacts: mergeFacts(existing.sourceFacts, record.sourceFacts),
      updatedAt: verifiedAt,
    })
    .where(eq(opportunities.id, existing.id));
  return "updated";
}
