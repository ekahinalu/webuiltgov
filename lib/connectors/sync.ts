import { and, desc, eq, lt } from "drizzle-orm";
import { assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import type { AppDatabase } from "../db/client";
import { connectorRuns } from "../db/schema";
import { SOURCE_LABEL, STALE_AFTER_MS, SYNC_COOLDOWN_MS, type Plane, type SourceName } from "../domain";
import { asDate } from "../dates";
import { saveParsedOpportunity } from "../opportunities/store";
import {
  fetchGrantsDetail,
  fetchGrantsSearch,
  parseGrantsDetail,
  parseGrantsSearch,
  type FetchLike,
} from "./grants-gov";
import { fetchSamDescription, fetchSamSearch, parseSamSearch } from "./sam-gov";

export type SyncResult =
  | { ok: true; code: "synced" | "sync-skipped"; fetched: number; upserted: number }
  | { ok: false; code: "sync-denied" | "sync-cooldown" | "sync-busy" | "sync-failed" };

const RUNNING_TIMEOUT_MS = 2 * 60 * 1000;

export async function syncConnector(
  db: AppDatabase,
  principal: Principal,
  source: SourceName,
  options: { fetchImpl?: FetchLike; now?: Date; samKey?: string | null } = {},
): Promise<SyncResult> {
  if (principal.role !== "owner" && principal.role !== "admin") return { ok: false, code: "sync-denied" };
  assertRole(principal.role, "admin");
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  await db
    .update(connectorRuns)
    .set({ status: "error", error: "Sync timed out.", finishedAt: now })
    .where(
      and(
        eq(connectorRuns.plane, principal.plane),
        eq(connectorRuns.source, source),
        eq(connectorRuns.status, "running"),
        lt(connectorRuns.startedAt, new Date(now.getTime() - RUNNING_TIMEOUT_MS)),
      ),
    );
  const [latest] = await db
    .select()
    .from(connectorRuns)
    .where(and(eq(connectorRuns.plane, principal.plane), eq(connectorRuns.source, source)))
    .orderBy(desc(connectorRuns.startedAt))
    .limit(1);
  if (latest?.status === "running") return { ok: false, code: "sync-busy" };
  if (latest && now.getTime() - asDate(latest.startedAt).getTime() < SYNC_COOLDOWN_MS) {
    return { ok: false, code: "sync-cooldown" };
  }

  const runId = crypto.randomUUID();
  await db.insert(connectorRuns).values({
    id: runId,
    plane: principal.plane,
    source,
    status: "running",
    startedAt: now,
  });

  try {
    if (source === "sam.gov") {
      const samKey = options.samKey === undefined ? process.env.SAM_GOV_API_KEY?.trim() ?? "" : options.samKey?.trim() ?? "";
      if (samKey === "") {
        await finish(db, runId, {
          status: "skipped",
          error: "SAM_GOV_API_KEY is not set. SAM.gov contract opportunity sync is paused.",
          fetched: 0,
          upserted: 0,
        });
        return { ok: true, code: "sync-skipped", fetched: 0, upserted: 0 };
      }
      const payload = await fetchSamSearch(fetchImpl, samKey, now);
      const parsed = parseSamSearch(payload);
      if ("error" in parsed) throw new Error(parsed.error);
      let upserted = 0;
      const described = parsed.records.slice(0, 5);
      await Promise.all(
        described.map(async (record) => {
          const descriptionUrl = record.sourceFacts.descriptionUrl;
          if (!descriptionUrl || record.description) return;
          try {
            const text = await fetchSamDescription(fetchImpl, descriptionUrl, samKey);
            if (text) {
              record.description = text;
              record.coverage = { ...record.coverage, description: true };
            }
          } catch {
            // The listing is still stored. The description stays empty.
          }
        }),
      );
      for (const record of parsed.records) {
        await saveParsedOpportunity(db, principal.plane, record, now);
        upserted += 1;
      }
      await finish(db, runId, { status: "success", error: null, fetched: parsed.records.length, upserted });
      return { ok: true, code: "synced", fetched: parsed.records.length, upserted };
    }

    const payload = await fetchGrantsSearch(fetchImpl);
    const parsed = parseGrantsSearch(payload);
    if ("error" in parsed) throw new Error(parsed.error);
    await Promise.all(
      parsed.records.slice(0, 5).map(async (record) => {
        try {
          const detail = parseGrantsDetail(await fetchGrantsDetail(fetchImpl, record.sourceId));
          if (!detail || detail.sourceId !== record.sourceId) return;
          record.description = detail.description;
          record.coverage = { ...record.coverage, description: true };
          if (detail.agency) record.agency = detail.agency;
          if (detail.deadline) {
            record.deadline = detail.deadline;
            record.deadlineRaw = detail.deadlineRaw;
          }
          record.sourceFacts = { ...record.sourceFacts, ...detail.sourceFacts };
        } catch {
          // Keep the search hit when a detail request fails.
        }
      }),
    );
    let upserted = 0;
    for (const record of parsed.records) {
      await saveParsedOpportunity(db, principal.plane, record, now);
      upserted += 1;
    }
    await finish(db, runId, { status: "success", error: null, fetched: parsed.records.length, upserted });
    return { ok: true, code: "synced", fetched: parsed.records.length, upserted };
  } catch (error) {
    const message = (error instanceof Error ? error.message : "Sync failed.").slice(0, 500);
    await finish(db, runId, { status: "error", error: message, fetched: 0, upserted: 0 });
    return { ok: false, code: "sync-failed" };
  }
}

async function finish(
  db: AppDatabase,
  runId: string,
  result: { status: "success" | "error" | "skipped"; error: string | null; fetched: number; upserted: number },
) {
  await db
    .update(connectorRuns)
    .set({
      status: result.status,
      error: result.error,
      fetchedCount: result.fetched,
      upsertedCount: result.upserted,
      finishedAt: new Date(),
    })
    .where(eq(connectorRuns.id, runId));
}

export type ConnectorHealth = {
  source: SourceName;
  label: string;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastStatus: string | null;
  lastError: string | null;
  fetchedCount: number | null;
  upsertedCount: number | null;
  stale: boolean;
};

export async function connectorHealth(db: AppDatabase, plane: Plane, now = new Date()): Promise<ConnectorHealth[]> {
  const sources: SourceName[] = ["grants.gov", "sam.gov"];
  const rows: ConnectorHealth[] = [];
  for (const source of sources) {
    const [latest] = await db
      .select()
      .from(connectorRuns)
      .where(and(eq(connectorRuns.plane, plane), eq(connectorRuns.source, source)))
      .orderBy(desc(connectorRuns.startedAt))
      .limit(1);
    const [success] = await db
      .select()
      .from(connectorRuns)
      .where(and(eq(connectorRuns.plane, plane), eq(connectorRuns.source, source), eq(connectorRuns.status, "success")))
      .orderBy(desc(connectorRuns.startedAt))
      .limit(1);
    const lastSuccessAt = success ? asDate(success.finishedAt ?? success.startedAt) : null;
    rows.push({
      source,
      label: SOURCE_LABEL[source],
      lastAttemptAt: latest ? asDate(latest.startedAt) : null,
      lastSuccessAt,
      lastStatus: latest?.status ?? null,
      lastError: latest?.error ?? null,
      fetchedCount: latest?.fetchedCount ?? null,
      upsertedCount: latest?.upsertedCount ?? null,
      stale: !lastSuccessAt || now.getTime() - lastSuccessAt.getTime() > STALE_AFTER_MS,
    });
  }
  return rows;
}

export function samKeyConfigured(explicit?: string | null): boolean {
  const value = explicit === undefined ? process.env.SAM_GOV_API_KEY : explicit;
  return (value?.trim() ?? "") !== "";
}
