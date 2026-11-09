import { formatSamDay, parseSourceDate } from "../dates";
import type { ParsedOpportunity, RecordKind, SourceFacts } from "../domain";
import { USER_AGENT } from "../domain";
import { asRecord } from "../json";
import { cleanText, httpsUrl, redactSecret } from "../text";

const SEARCH_URL = "https://api.sam.gov/opportunities/v2/search";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function noticeKind(type: string | null): RecordKind | null {
  if (!type) return null;
  if (/award/i.test(type)) return "award_notice";
  return "contract_notice";
}

function naicsCode(value: unknown): string | null {
  const text = typeof value === "number" && Number.isInteger(value) ? String(value) : value;
  if (typeof text !== "string") return null;
  const code = text.trim();
  return /^\d{2,6}$/.test(code) ? code : null;
}

function placeText(value: unknown): string | null {
  const place = asRecord(value);
  if (!place) return null;
  const cityRecord = asRecord(place.city);
  const stateRecord = asRecord(place.state);
  const street = cleanText(place.streetAddress, 200);
  const city = cleanText(cityRecord?.name ?? place.city, 120);
  const state = cleanText(stateRecord?.code ?? stateRecord?.name ?? place.state, 80);
  const zip = cleanText(place.zip, 20);
  const stateZip = [state, zip].filter((part): part is string => Boolean(part)).join(" ");
  const parts = [street, city, stateZip].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

export function isSamDescriptionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "api.sam.gov" &&
      (url.pathname.startsWith("/prod/opportunities/") || url.pathname.startsWith("/opportunities/"))
    );
  } catch {
    return false;
  }
}

function samDescription(value: unknown): { text: string | null; url: string | null } {
  if (typeof value !== "string") return { text: null, url: null };
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") return { text: null, url: null };
  const url = httpsUrl(trimmed);
  if (url) return { text: null, url };
  return { text: cleanText(trimmed, 20000), url: null };
}

export function parseSamNotice(value: unknown): ParsedOpportunity | null {
  const notice = asRecord(value);
  if (!notice) return null;
  const sourceId = cleanText(notice.noticeId, 80);
  const title = cleanText(notice.title, 500);
  const noticeType = cleanText(notice.type, 80);
  const recordKind = noticeKind(noticeType);
  if (!sourceId || !title || !recordKind) return null;
  const deadline = parseSourceDate(notice.responseDeadLine);
  const posted = parseSourceDate(notice.postedDate);
  const subTier = cleanText(notice.subTier, 300);
  const department = cleanText(notice.department, 300);
  const description = samDescription(notice.description);
  const facts: SourceFacts = {
    governmentLevelBasis: "SAM.gov Contract Opportunities are federal notices.",
  };
  if (subTier) facts.subTier = subTier;
  if (department) facts.department = department;
  const organizationPath = cleanText(notice.fullParentPathName, 400);
  if (organizationPath) facts.organizationPath = organizationPath;
  if (noticeType) facts.noticeType = noticeType;
  if (posted.raw) facts.openDate = posted.raw;
  if (description.url) facts.descriptionUrl = description.url;
  const naics = naicsCode(notice.naicsCode);
  return {
    source: "sam.gov",
    sourceId,
    sourceUrl: httpsUrl(notice.uiLink),
    agency: subTier ?? department,
    solicitationNumber: cleanText(notice.solicitationNumber, 120),
    title,
    description: description.text,
    governmentLevel: "federal",
    location: placeText(notice.placeOfPerformance),
    naics,
    deadline: deadline.iso,
    deadlineRaw: deadline.raw,
    recordKind,
    sourceFacts: facts,
    coverage: {
      description: description.text !== null,
      naics: true,
      location: true,
    },
  };
}

export function parseSamSearch(payload: unknown): { records: ParsedOpportunity[] } | { error: string } {
  const root = asRecord(payload);
  if (!root) return { error: "SAM.gov returned an unexpected payload." };
  const nested = asRecord(root.data);
  const rows = Array.isArray(root.opportunitiesData)
    ? root.opportunitiesData
    : nested && Array.isArray(nested.opportunitiesData)
      ? nested.opportunitiesData
      : null;
  if (!rows) {
    const message =
      cleanText(asRecord(root.error)?.message, 200) ??
      cleanText(root.errorMessage, 200) ??
      cleanText(root.message, 200);
    return { error: message ?? "SAM.gov search did not include opportunities." };
  }
  const records: ParsedOpportunity[] = [];
  for (const row of rows) {
    const parsed = parseSamNotice(row);
    if (parsed) records.push(parsed);
  }
  return { records };
}

export function samSearchUrl(apiKey: string, now: Date): URL {
  const url = new URL(SEARCH_URL);
  const postedTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const postedFrom = new Date(postedTo.getTime() - 7 * 24 * 60 * 60 * 1000);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("postedFrom", formatSamDay(postedFrom));
  url.searchParams.set("postedTo", formatSamDay(postedTo));
  url.searchParams.set("limit", "25");
  url.searchParams.set("offset", "0");
  for (const type of ["o", "k", "p", "r", "s"]) url.searchParams.append("ptype", type);
  return url;
}

export async function fetchSamSearch(fetchImpl: FetchLike, apiKey: string, now: Date): Promise<unknown> {
  const url = samSearchUrl(apiKey, now);
  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(20000),
      redirect: "manual",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAM.gov request failed.";
    throw new Error(redactSecret(message, apiKey));
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`SAM.gov returned HTTP ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

export async function fetchSamDescription(
  fetchImpl: FetchLike,
  descriptionUrl: string,
  apiKey: string,
): Promise<string | null> {
  if (!isSamDescriptionUrl(descriptionUrl)) return null;
  const url = new URL(descriptionUrl);
  url.searchParams.set("api_key", apiKey);
  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      headers: { accept: "application/json, text/plain", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
      redirect: "manual",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAM.gov description request failed.";
    throw new Error(redactSecret(message, apiKey));
  }
  if (response.status < 200 || response.status >= 300) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = asRecord(await response.json());
    return cleanText(payload?.description ?? payload?.content, 20000);
  }
  if (contentType.includes("text/plain") || contentType === "") {
    return cleanText(await response.text(), 20000);
  }
  return null;
}
