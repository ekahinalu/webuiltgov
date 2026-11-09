import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ensurePrincipal } from "../lib/auth/principal";
import { AppError } from "../lib/auth/roles";
import { parseGrantsDetail, parseGrantsHit, parseGrantsSearch } from "../lib/connectors/grants-gov";
import { syncConnector } from "../lib/connectors/sync";
import { createTestDb } from "../lib/db/client";
import { opportunities } from "../lib/db/schema";
import type { ParsedOpportunity } from "../lib/domain";
import { saveParsedOpportunity } from "../lib/opportunities/store";
import { parseSearchParams, searchOpportunities } from "../lib/opportunities/search";
import { setPipeline } from "../lib/opportunities/pipeline";
import { inviteMember } from "../lib/org/service";
import { askModel } from "../lib/ai/config";

const verifiedAt = new Date("2026-11-09T06:20:00Z");

async function readJson(name: string) {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as unknown;
}

function person(sub: string, email: string, name = "Test Person") {
  return { plane: "production" as const, sub, email, name, simulated: false };
}

describe("dedup and search", () => {
  it("keeps one row per source id and does not wipe a fetched description", async () => {
    const db = await createTestDb();
    const search = parseGrantsSearch(await readJson("grants-search.json"));
    if (!("records" in search)) throw new Error(search.error);
    const detail = parseGrantsDetail(await readJson("grants-detail.json"));
    if (!detail) throw new Error("detail missing");
    const [first] = search.records;
    if (!first) throw new Error("hit missing");
    await saveParsedOpportunity(db, "production", first, verifiedAt);
    const enriched: ParsedOpportunity = {
      ...first,
      description: detail.description,
      coverage: { ...first.coverage, description: true },
    };
    expect(await saveParsedOpportunity(db, "production", enriched, verifiedAt)).toBe("updated");
    expect(await saveParsedOpportunity(db, "production", first, verifiedAt)).toBe("updated");
    const rows = await db.select().from(opportunities);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.description?.startsWith("The purpose")).toBe(true);
    expect(rows[0]?.naics).toBeNull();
    expect(rows[0]?.location).toBeNull();
  });

  it("filters by level, agency, NAICS, deadline, and literal percent signs", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("user:1", "owner@example.com", "Owner"));
    const federal: ParsedOpportunity = {
      ...(parseGrantsHit({
        id: "1",
        number: "ABC-1",
        title: "100% design clinic",
        agency: "Health Resources and Services Administration",
        closeDate: "02/01/2027",
      }) as ParsedOpportunity),
      naics: "621111",
      location: "Salt Lake City, UT",
      coverage: { description: false, naics: true, location: true },
    };
    const other: ParsedOpportunity = {
      ...(parseGrantsHit({
        id: "2",
        number: "ZZZ-2",
        title: "Bridge painting",
        agency: "Department of Transportation",
        closeDate: "03/01/2027",
      }) as ParsedOpportunity),
      governmentLevel: "state",
      naics: "237310",
      location: "Denver, CO",
      coverage: { description: false, naics: true, location: true },
      sourceFacts: {},
    };
    await saveParsedOpportunity(db, "production", federal, verifiedAt);
    await saveParsedOpportunity(db, "production", other, verifiedAt);
    const base = { q: "", level: "" as const, agency: "", location: "", naics: "", deadlineFrom: "", deadlineTo: "", source: "" as const, page: 1 };
    const text = await searchOpportunities(db, "production", owner.organizationId, { ...base, q: "100%" });
    expect(text.rows.map((row) => row.title)).toEqual(["100% design clinic"]);
    const underscore = await searchOpportunities(db, "production", owner.organizationId, { ...base, q: "_" });
    expect(underscore.total).toBe(0);
    const quote = parseSearchParams({ q: "a'b" });
    expect(quote.ok).toBe(true);
    if (quote.ok) {
      const quoted = await searchOpportunities(db, "production", owner.organizationId, quote.query);
      expect(quoted.total).toBe(0);
    }
    const level = await searchOpportunities(db, "production", owner.organizationId, { ...base, level: "state" });
    expect(level.rows).toHaveLength(1);
    expect(level.rows[0]?.title).toBe("Bridge painting");
    const agency = await searchOpportunities(db, "production", owner.organizationId, { ...base, agency: "Health Resources" });
    expect(agency.rows).toHaveLength(1);
    const naics = await searchOpportunities(db, "production", owner.organizationId, { ...base, naics: "621" });
    expect(naics.rows).toHaveLength(1);
    const deadline = await searchOpportunities(db, "production", owner.organizationId, {
      ...base,
      deadlineFrom: "2027-02-15",
      deadlineTo: "2027-04-01",
    });
    expect(deadline.rows.map((row) => row.title)).toEqual(["Bridge painting"]);
    const location = await searchOpportunities(db, "production", owner.organizationId, { ...base, location: "Salt Lake" });
    expect(location.rows).toHaveLength(1);
  });

  it("does not show another plane's catalog", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("user:1", "owner@example.com"));
    const hit = parseGrantsHit({ id: "9", title: "Preview only", number: "P-9", closeDate: "01/01/2027" });
    if (!hit) throw new Error("hit missing");
    await saveParsedOpportunity(db, "preview", hit, verifiedAt);
    const rows = await searchOpportunities(db, "production", owner.organizationId, {
      q: "Preview",
      level: "",
      agency: "",
      location: "",
      naics: "",
      deadlineFrom: "",
      deadlineTo: "",
      source: "",
      page: 1,
    });
    expect(rows.total).toBe(0);
  });
});

describe("auth and tenant pipeline", () => {
  it("bootstraps an owner, accepts an invite, and isolates pipeline status", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("user:11", "owner@example.com", "Ada"));
    const again = await ensurePrincipal(db, person("user:11", "owner@example.com", "Ada"));
    expect(again.organizationId).toBe(owner.organizationId);
    expect(again.role).toBe("owner");
    await inviteMember(db, owner, "viewer@example.com", "viewer");
    const invited = await ensurePrincipal(db, person("user:22", "viewer@example.com", "Bea"));
    expect(invited.organizationId).toBe(owner.organizationId);
    expect(invited.role).toBe("viewer");
    expect(invited.memberships).toHaveLength(1);
    const outsider = await ensurePrincipal(db, person("user:33", "outsider@example.com", "Cy"));
    expect(outsider.organizationId).not.toBe(owner.organizationId);

    const hit = parseGrantsHit({
      id: "363546",
      title: "Women's Initiative for Screening and Health (WISH)",
      number: "HRSA-27-072",
      agency: "Health Resources and Services Administration",
      closeDate: "01/08/2027",
    });
    if (!hit) throw new Error("hit missing");
    await saveParsedOpportunity(db, "production", hit, verifiedAt);
    const [row] = await db.select().from(opportunities).where(eq(opportunities.sourceId, "363546"));
    if (!row) throw new Error("row missing");
    await setPipeline(db, owner, row.id, "pursuing");
    await expect(setPipeline(db, invited, row.id, "passed")).rejects.toBeInstanceOf(AppError);
    const ownerView = await searchOpportunities(db, "production", owner.organizationId, emptyQuery());
    const outsiderView = await searchOpportunities(db, "production", outsider.organizationId, emptyQuery());
    expect(ownerView.rows[0]?.pipelineStatus).toBe("pursuing");
    expect(outsiderView.rows[0]?.pipelineStatus).toBeNull();
    await setPipeline(db, outsider, row.id, "reviewing");
    const ownerAgain = await searchOpportunities(db, "production", owner.organizationId, emptyQuery());
    const outsiderAgain = await searchOpportunities(db, "production", outsider.organizationId, emptyQuery());
    expect(ownerAgain.rows[0]?.pipelineStatus).toBe("pursuing");
    expect(outsiderAgain.rows[0]?.pipelineStatus).toBe("reviewing");
  });
});

describe("connector sync", () => {
  it("stores Grants.gov hits from a fake response and dedups the next sync", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("user:1", "owner@example.com"));
    const searchBody = await readJson("grants-search.json");
    const detailBody = await readJson("grants-detail.json");
    const fetchImpl = async (input: string) => {
      const body = String(input).includes("fetchOpportunity") ? detailBody : searchBody;
      return Response.json(body);
    };
    const first = await syncConnector(db, owner, "grants.gov", { fetchImpl, now: verifiedAt });
    expect(first).toMatchObject({ ok: true, code: "synced", fetched: 2, upserted: 2 });
    const rows = await db.select().from(opportunities);
    expect(rows).toHaveLength(2);
    const wish = rows.find((row) => row.sourceId === "363546");
    expect(wish?.description?.startsWith("The purpose")).toBe(true);
    const second = await syncConnector(db, owner, "grants.gov", {
      fetchImpl,
      now: new Date(verifiedAt.getTime() + 60_000),
    });
    expect(second).toMatchObject({ ok: true, fetched: 2, upserted: 2 });
    expect(await db.select().from(opportunities)).toHaveLength(2);
  });

  it("pauses SAM.gov when SAM_GOV_API_KEY is missing and calls no network", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("user:1", "owner@example.com"));
    let called = false;
    const result = await syncConnector(db, owner, "sam.gov", {
      samKey: null,
      now: verifiedAt,
      fetchImpl: async () => {
        called = true;
        return Response.json({});
      },
    });
    expect(result).toMatchObject({ ok: true, code: "sync-skipped", upserted: 0 });
    expect(called).toBe(false);
    expect(await db.select().from(opportunities)).toHaveLength(0);
  });

  it("refuses a viewer sync", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("user:1", "owner@example.com"));
    await inviteMember(db, owner, "viewer@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("user:2", "viewer@example.com"));
    const result = await syncConnector(db, viewer, "grants.gov", { now: verifiedAt, fetchImpl: async () => Response.json({}) });
    expect(result).toEqual({ ok: false, code: "sync-denied" });
  });
});

describe("AI config", () => {
  it("does not call xAI when XAI_API_KEY is absent", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("user:1", "owner@example.com"));
    let called = false;
    await expect(
      askModel(db, owner, {
        prompt: "Summarize the deadline.",
        opportunityId: "",
        apiKey: null,
        fetchImpl: async () => {
          called = true;
          return Response.json({});
        },
      }),
    ).rejects.toMatchObject({ code: "missing-key" });
    expect(called).toBe(false);
  });

  it("stores a redacted error when the request fails", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("user:1", "owner@example.com"));
    await askModel(db, owner, {
      prompt: "What is the deadline?",
      opportunityId: "",
      apiKey: "super-secret-key",
      fetchImpl: async () => {
        throw new Error("connect failed super-secret-key");
      },
    });
    const { latestAnswer } = await import("../lib/ai/config");
    const answer = await latestAnswer(db, owner);
    expect(answer?.error).not.toContain("super-secret-key");
    expect(answer?.error).toContain("[redacted]");
  });
});

function emptyQuery() {
  return {
    q: "",
    level: "" as const,
    agency: "",
    location: "",
    naics: "",
    deadlineFrom: "",
    deadlineTo: "",
    source: "" as const,
    page: 1,
  };
}
