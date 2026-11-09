import { parseSourceDate } from "../dates";
import type { ParsedOpportunity, SourceFacts } from "../domain";
import { USER_AGENT } from "../domain";
import { asRecord, stringList } from "../json";
import { cleanText } from "../text";

const SEARCH_URL = "https://api.grants.gov/v1/api/search2";
const DETAIL_URL = "https://api.grants.gov/v1/api/fetchOpportunity";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function grantsOpportunityUrl(id: string): string | null {
  if (!/^\d+$/.test(id)) return null;
  return `https://www.grants.gov/search-results-detail/${id}`;
}

function sourceId(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return String(value);
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^\d+$/.test(id) ? id : null;
}

function cfdaNumbers(value: unknown): string[] {
  const direct = stringList(value);
  if (direct.length > 0) return direct;
  if (!Array.isArray(value)) return [];
  const numbers: string[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const number = cleanText(record?.cfdaNumber ?? record?.cfda, 40);
    if (number) numbers.push(number);
  }
  return numbers;
}

export function parseGrantsHit(value: unknown): ParsedOpportunity | null {
  const hit = asRecord(value);
  if (!hit) return null;
  const id = sourceId(hit.id);
  const title = cleanText(hit.title, 500);
  if (!id || !title) return null;
  const close = parseSourceDate(hit.closeDate);
  const open = parseSourceDate(hit.openDate);
  const facts: SourceFacts = {
    governmentLevelBasis: "Grants.gov publishes federal assistance opportunities.",
  };
  const agencyCode = cleanText(hit.agencyCode, 80);
  const oppStatus = cleanText(hit.oppStatus, 40);
  const docType = cleanText(hit.docType, 40);
  const numbers = cfdaNumbers(hit.cfdaList);
  if (agencyCode) facts.agencyCode = agencyCode;
  if (open.raw) facts.openDate = open.raw;
  if (oppStatus) facts.oppStatus = oppStatus;
  if (docType) facts.docType = docType;
  if (numbers.length > 0) facts.cfdaNumbers = numbers;
  return {
    source: "grants.gov",
    sourceId: id,
    sourceUrl: grantsOpportunityUrl(id),
    agency: cleanText(hit.agency, 300),
    solicitationNumber: cleanText(hit.number, 120),
    title,
    description: null,
    governmentLevel: "federal",
    location: null,
    naics: null,
    deadline: close.iso,
    deadlineRaw: close.raw,
    recordKind: "grant_opportunity",
    sourceFacts: facts,
    coverage: { description: false, naics: false, location: false },
  };
}

export function parseGrantsSearch(payload: unknown): { records: ParsedOpportunity[] } | { error: string } {
  const root = asRecord(payload);
  if (!root) return { error: "Grants.gov returned an unexpected payload." };
  if (typeof root.errorcode === "number" && root.errorcode !== 0) {
    return { error: cleanText(root.msg, 200) ?? "Grants.gov search failed." };
  }
  const data = asRecord(root.data);
  if (!data || !Array.isArray(data.oppHits)) {
    return { error: "Grants.gov search did not include opportunities." };
  }
  const records: ParsedOpportunity[] = [];
  for (const hit of data.oppHits) {
    const parsed = parseGrantsHit(hit);
    if (parsed) records.push(parsed);
  }
  return { records };
}

export function parseGrantsDetail(payload: unknown): {
  sourceId: string;
  description: string | null;
  agency: string | null;
  deadline: string | null;
  deadlineRaw: string | null;
  sourceFacts: SourceFacts;
} | null {
  const root = asRecord(payload);
  if (!root) return null;
  if (typeof root.errorcode === "number" && root.errorcode !== 0) return null;
  const data = asRecord(root.data) ?? root;
  const id = sourceId(data.id);
  if (!id) return null;
  const synopsis = asRecord(data.synopsis);
  const agencyDetails = asRecord(data.agencyDetails);
  const topAgency = asRecord(data.topAgencyDetails);
  const deadline = parseSourceDate(synopsis?.responseDateStr ?? data.originalDueDate ?? synopsis?.responseDate);
  const numbers = cfdaNumbers(data.cfdas);
  const facts: SourceFacts = {};
  const agencyCode = cleanText(agencyDetails?.agencyCode ?? synopsis?.agencyCode ?? data.owningAgencyCode, 80);
  const department = cleanText(topAgency?.agencyName, 300);
  if (department) facts.department = department;
  const sourceUpdated = cleanText(synopsis?.lastUpdatedDate, 80);
  const docType = cleanText(data.docType, 40);
  if (agencyCode) facts.agencyCode = agencyCode;
  if (sourceUpdated) facts.sourceUpdated = sourceUpdated;
  if (docType) facts.docType = docType;
  if (numbers.length > 0) facts.cfdaNumbers = numbers;
  return {
    sourceId: id,
    description: cleanText(synopsis?.synopsisDesc, 20000),
    agency: cleanText(agencyDetails?.agencyName, 300),
    deadline: deadline.iso,
    deadlineRaw: deadline.raw,
    sourceFacts: facts,
  };
}

export async function fetchGrantsSearch(fetchImpl: FetchLike): Promise<unknown> {
  const response = await fetchImpl(SEARCH_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({
      rows: 100,
      oppStatuses: "posted",
      sortBy: "openDate|desc",
      startRecordNum: 0,
    }),
    signal: AbortSignal.timeout(20000),
    redirect: "manual",
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Grants.gov returned HTTP ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

export async function fetchGrantsDetail(fetchImpl: FetchLike, opportunityId: string): Promise<unknown> {
  const response = await fetchImpl(DETAIL_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({ opportunityId: Number(opportunityId) }),
    signal: AbortSignal.timeout(15000),
    redirect: "manual",
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Grants.gov detail returned HTTP ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}
