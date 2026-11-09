import { and, asc, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import type { AppDatabase } from "../db/client";
import { opportunities, pipelineEntries } from "../db/schema";
import { GOVERNMENT_LEVELS, SOURCES, type GovernmentLevel, type Plane, type SourceName } from "../domain";
import { asDate } from "../dates";
import { escapeLike } from "../text";

export type SearchQuery = {
  q: string;
  level: "" | GovernmentLevel;
  agency: string;
  location: string;
  naics: string;
  deadlineFrom: string;
  deadlineTo: string;
  source: "" | SourceName;
  page: number;
};

export type SearchHit = {
  id: string;
  title: string;
  agency: string | null;
  solicitationNumber: string | null;
  governmentLevel: string | null;
  location: string | null;
  naics: string | null;
  deadline: string | null;
  deadlineRaw: string | null;
  recordKind: string;
  source: string;
  sourceUrl: string | null;
  lastVerifiedAt: Date;
  pipelineStatus: string | null;
};

const PAGE_SIZE = 20;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function parseSearchParams(
  params: Record<string, string | string[] | undefined>,
): { ok: true; query: SearchQuery } | { ok: false; message: string } {
  const q = one(params.q).trim().slice(0, 200);
  const level = one(params.level).trim();
  const agency = one(params.agency).trim().slice(0, 200);
  const location = one(params.location).trim().slice(0, 200);
  const naics = one(params.naics).trim();
  const deadlineFrom = one(params.deadlineFrom).trim();
  const deadlineTo = one(params.deadlineTo).trim();
  const source = one(params.source).trim();
  const pageRaw = Number(one(params.page) || "1");
  if (level !== "" && !(GOVERNMENT_LEVELS as readonly string[]).includes(level)) {
    return { ok: false, message: "Government level is not a known filter." };
  }
  if (source !== "" && !(SOURCES as readonly string[]).includes(source)) {
    return { ok: false, message: "Source is not a known filter." };
  }
  if (naics !== "" && !/^\d{2,6}$/.test(naics)) {
    return { ok: false, message: "NAICS filter must be 2 to 6 digits." };
  }
  if ((deadlineFrom !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(deadlineFrom)) || (deadlineTo !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(deadlineTo))) {
    return { ok: false, message: "Deadline filters use YYYY-MM-DD." };
  }
  if (!Number.isInteger(pageRaw) || pageRaw < 1 || pageRaw > 50) {
    return { ok: false, message: "Page must be between 1 and 50." };
  }
  return {
    ok: true,
    query: {
      q,
      level: level as SearchQuery["level"],
      agency,
      location,
      naics,
      deadlineFrom,
      deadlineTo,
      source: source as SearchQuery["source"],
      page: pageRaw,
    },
  };
}

function like(column: SQL, value: string): SQL {
  return sql`${column} ilike ${`%${escapeLike(value)}%`} escape '\\'`;
}

export async function searchOpportunities(
  db: AppDatabase,
  plane: Plane,
  organizationId: string,
  query: SearchQuery,
): Promise<{ rows: SearchHit[]; total: number }> {
  const filters: SQL[] = [eq(opportunities.plane, plane)];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(sql`(
      ${opportunities.title} ilike ${pattern} escape '\\'
      or coalesce(${opportunities.description}, '') ilike ${pattern} escape '\\'
      or coalesce(${opportunities.solicitationNumber}, '') ilike ${pattern} escape '\\'
      or coalesce(${opportunities.agency}, '') ilike ${pattern} escape '\\'
      or coalesce(${opportunities.naics}, '') ilike ${pattern} escape '\\'
      or coalesce(${opportunities.location}, '') ilike ${pattern} escape '\\'
    )`);
  }
  if (query.level) filters.push(eq(opportunities.governmentLevel, query.level));
  if (query.agency) filters.push(like(sql`${opportunities.agency}`, query.agency));
  if (query.location) filters.push(like(sql`${opportunities.location}`, query.location));
  if (query.naics) {
    filters.push(sql`${opportunities.naics} ilike ${`${escapeLike(query.naics)}%`} escape '\\'`);
  }
  if (query.deadlineFrom) filters.push(sql`${opportunities.deadline} >= ${query.deadlineFrom}::date`);
  if (query.deadlineTo) filters.push(sql`${opportunities.deadline} <= ${query.deadlineTo}::date`);
  if (query.source) filters.push(eq(opportunities.source, query.source));
  const where = and(...filters);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(opportunities)
    .where(where);
  const total = Number(countRow?.total ?? 0);
  const selected = await db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      agency: opportunities.agency,
      solicitationNumber: opportunities.solicitationNumber,
      governmentLevel: opportunities.governmentLevel,
      location: opportunities.location,
      naics: opportunities.naics,
      deadline: opportunities.deadline,
      deadlineRaw: opportunities.deadlineRaw,
      recordKind: opportunities.recordKind,
      source: opportunities.source,
      sourceUrl: opportunities.sourceUrl,
      lastVerifiedAt: opportunities.lastVerifiedAt,
      pipelineStatus: pipelineEntries.status,
    })
    .from(opportunities)
    .leftJoin(
      pipelineEntries,
      and(eq(pipelineEntries.opportunityId, opportunities.id), eq(pipelineEntries.organizationId, organizationId)),
    )
    .where(where)
    .orderBy(sql`${opportunities.deadline} asc nulls last`, asc(opportunities.title))
    .limit(PAGE_SIZE)
    .offset((query.page - 1) * PAGE_SIZE);

  return {
    total,
    rows: selected.map((row) => ({
      ...row,
      lastVerifiedAt: asDate(row.lastVerifiedAt),
    })),
  };
}

export function searchHref(query: SearchQuery, page = query.page): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.level) params.set("level", query.level);
  if (query.agency) params.set("agency", query.agency);
  if (query.location) params.set("location", query.location);
  if (query.naics) params.set("naics", query.naics);
  if (query.deadlineFrom) params.set("deadlineFrom", query.deadlineFrom);
  if (query.deadlineTo) params.set("deadlineTo", query.deadlineTo);
  if (query.source) params.set("source", query.source);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `/search?${text}` : "/search";
}

export async function listAgencies(db: AppDatabase, plane: Plane): Promise<string[]> {
  const rows = await db
    .selectDistinct({ agency: opportunities.agency })
    .from(opportunities)
    .where(and(eq(opportunities.plane, plane), isNotNull(opportunities.agency)))
    .limit(200);
  return rows.flatMap((row) => (row.agency ? [row.agency] : [])).sort((a, b) => a.localeCompare(b));
}

export { PAGE_SIZE };
