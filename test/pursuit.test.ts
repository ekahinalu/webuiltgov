import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ensurePrincipal } from "../lib/auth/principal";
import { AppError } from "../lib/auth/roles";
import { parseGrantsDetail, parseGrantsHit } from "../lib/connectors/grants-gov";
import { createTestDb } from "../lib/db/client";
import { aiAnswers, aiRequests, opportunities } from "../lib/db/schema";
import { setEligibilityMark } from "../lib/eligibility/service";
import { saveParsedOpportunity } from "../lib/opportunities/store";
import { inviteMember } from "../lib/org/service";
import { SUGGESTION_RULES, suggestFromStored, type FitInput, type FitLine, type FitRecord } from "../lib/pursuit/model";
import { draftPursuit, pursuitView, savePursuitDecision } from "../lib/pursuit/service";
import { READINESS_CATEGORIES, type ReadinessCategory } from "../lib/readiness/model";
import { listReadiness, saveReadinessRecord, type ReadinessInput } from "../lib/readiness/service";

const today = "2026-11-09";

function person(sub: string, email: string, name: string) {
  return { plane: "production" as const, sub, email, name, simulated: false };
}

function line(text: string, disposition: FitLine["disposition"]): FitLine {
  return { text, sourceLabel: "Grants.gov applicant type", disposition };
}

function record(category: ReadinessCategory, flags: FitRecord["flags"] = [], expiresOn = "2027-06-01"): FitRecord {
  return {
    category,
    label: category,
    recordedValue: "Recorded by the test",
    status: "active",
    source: "Test file",
    verifiedOn: "2026-01-15",
    expiresOn,
    responsiblePerson: "Test owner",
    flags,
  };
}

function fit(partial: Partial<FitInput>): FitInput {
  return { eligibilityLoaded: true, lines: [], missingCategories: [], records: [], ...partial };
}

function completeReadiness(expiresOn = "2027-06-01"): ReadinessInput[] {
  return READINESS_CATEGORIES.map((category) => ({
    category,
    label: category,
    recordedValue: "Recorded by the test",
    status: "active",
    source: "Test file",
    verifiedOn: "2026-01-15",
    expiresOn,
    responsiblePerson: "Test owner",
  }));
}

describe("pursuit suggestion", () => {
  it("uses stored marks and readiness and does not assign partner required or no-bid", () => {
    const lines = [line("Small businesses", "satisfied"), line("State governments", "not_applicable")];
    const records = READINESS_CATEGORIES.map((category) => record(category));
    expect(suggestFromStored(fit({ lines, records })).recommendation).toBe("strong_pursuit");
    expect(suggestFromStored(fit({ lines: [line("Small businesses", "unsatisfied")], records }))).toMatchObject({
      recommendation: "poor_fit",
      rule: SUGGESTION_RULES.unsatisfied,
    });
    expect(suggestFromStored(fit({ eligibilityLoaded: false, lines: [] }))).toMatchObject({
      recommendation: "needs_information",
      rule: SUGGESTION_RULES.notLoaded,
    });
    expect(suggestFromStored(fit({ lines: [] }))).toMatchObject({ rule: SUGGESTION_RULES.noneListed });
    expect(suggestFromStored(fit({ lines: [line("Small businesses", null)] }))).toMatchObject({ rule: SUGGESTION_RULES.unmarked });
    expect(suggestFromStored(fit({ lines: [line("Small businesses", "needs_verification")] }))).toMatchObject({ rule: SUGGESTION_RULES.unmarked });
    expect(suggestFromStored(fit({ lines, missingCategories: ["insurance"] }))).toMatchObject({ rule: SUGGESTION_RULES.readinessGaps });
    expect(suggestFromStored(fit({ lines, records: [record("insurance", ["value missing"])] }))).toMatchObject({
      rule: SUGGESTION_RULES.readinessGaps,
    });
    expect(suggestFromStored(fit({ lines, records: READINESS_CATEGORIES.map((category) => record(category, category === "insurance" ? ["expired"] : [])) }))).toMatchObject({
      recommendation: "high_risk",
      rule: SUGGESTION_RULES.expired,
    });
    expect(suggestFromStored(fit({ lines, records: READINESS_CATEGORIES.map((category) => record(category, category === "bonding" ? ["expiring"] : [])) }))).toMatchObject({
      recommendation: "potential",
      rule: SUGGESTION_RULES.potential,
    });
    expect(suggestFromStored(fit({ lines: [line("Small businesses", "potentially_correctable")], records }))).toMatchObject({
      recommendation: "potential",
    });
    expect(suggestFromStored(fit({ lines: [line("Small businesses", "not_applicable")], records })).recommendation).toBe("needs_information");
    for (const rule of Object.values(SUGGESTION_RULES)) {
      expect(rule.toLowerCase()).not.toContain("probability");
      expect(rule.toLowerCase()).not.toContain("competitor");
      expect(rule.toLowerCase()).not.toContain("award");
    }
    const suggestions = [
      suggestFromStored(fit({ lines, records })).recommendation,
      suggestFromStored(fit({ lines: [line("Small businesses", null)] })).recommendation,
      suggestFromStored(fit({ lines: [line("Small businesses", "unsatisfied")] })).recommendation,
    ];
    expect(suggestions).not.toContain("partner_required");
    expect(suggestions).not.toContain("no_bid");
  });
});

describe("pursuit recommendation", () => {
  it("keeps the capture note to stored fields and requires a reason to override", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("owner-p", "owner-p@example.com", "Owner"));
    const other = await ensurePrincipal(db, person("other-p", "other-p@example.com", "Other"));
    await inviteMember(db, owner, "viewer-p@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("viewer-p", "viewer-p@example.com", "Viewer"));
    const hit = parseGrantsHit({
      id: "363546",
      number: "HRSA-27-072",
      title: "Women's Initiative for Screening and Health (WISH)",
      agency: "Health Resources and Services Administration",
      closeDate: "01/08/2027",
    });
    const detail = parseGrantsDetail({
      errorcode: 0,
      data: {
        id: 363546,
        synopsis: {
          synopsisDesc: "The purpose of the stored notice is screening.",
          applicantTypes: [
            { id: "23", description: "Small businesses" },
            { id: "00", description: "State governments" },
          ],
          costSharing: false,
        },
      },
    });
    if (!hit || !detail) throw new Error("fixture missing");
    await saveParsedOpportunity(db, "production", {
      ...hit,
      description: detail.description,
      coverage: { ...hit.coverage, description: true },
      sourceFacts: { ...hit.sourceFacts, ...detail.sourceFacts },
    }, new Date("2026-11-09T07:10:00Z"));
    const [row] = await db.select().from(opportunities).where(eq(opportunities.sourceId, "363546"));
    if (!row) throw new Error("row missing");

    const open = await pursuitView(db, owner, row.id, today);
    expect(open?.agency).toBe("Health Resources and Services Administration");
    expect(open?.notice).toBe("The purpose of the stored notice is screening.");
    expect(open?.deadline).toBe("2027-01-08");
    expect(open?.costSharing).toBe(false);
    expect(open?.suggestion.rule).toBe(SUGGESTION_RULES.unmarked);
    expect(open?.gaps).toContain('Applicant type "Small businesses" is not marked.');
    expect(open?.gaps).toContain("No legal business record is stored.");
    expect(open?.decision).toBeNull();
    expect(JSON.stringify(open)).not.toContain("winProbability");

    await expect(savePursuitDecision(db, owner, row.id, "no_bid", " ")).rejects.toMatchObject({ code: "pursuit-reason" });
    await expect(savePursuitDecision(db, owner, row.id, "eligible", "Because.")).rejects.toMatchObject({ code: "pursuit-invalid" });
    await expect(savePursuitDecision(db, viewer, row.id, "no_bid", "Viewers cannot decide.")).rejects.toBeInstanceOf(AppError);
    expect((await pursuitView(db, owner, row.id, today))?.decision).toBeNull();

    await savePursuitDecision(db, owner, row.id, "no_bid", "We do not provide this service.");
    const saved = await pursuitView(db, owner, row.id, today);
    expect(saved?.decision?.recommendation).toBe("no_bid");
    expect(saved?.decision?.reason).toBe("We do not provide this service.");
    expect(saved?.suggestion.recommendation).toBe("needs_information");
    const isolated = await pursuitView(db, other, row.id, today);
    expect(isolated?.decision).toBeNull();
    expect(isolated?.suggestion.recommendation).toBe("needs_information");

    await setEligibilityMark(db, owner, row.id, "grants.gov:applicant-type:23", "unsatisfied");
    await setEligibilityMark(db, owner, row.id, "grants.gov:applicant-type:00", "satisfied");
    expect((await pursuitView(db, owner, row.id, today))?.suggestion.recommendation).toBe("poor_fit");

    await setEligibilityMark(db, owner, row.id, "grants.gov:applicant-type:23", "satisfied");
    for (const item of completeReadiness()) await saveReadinessRecord(db, owner, item);
    expect((await pursuitView(db, owner, row.id, today))?.suggestion).toMatchObject({
      recommendation: "strong_pursuit",
      rule: SUGGESTION_RULES.strong,
    });
    expect((await pursuitView(db, owner, row.id, today))?.gaps).toEqual([]);

    const listed = await listReadiness(db, owner, today);
    const insuranceId = listed.records.find((item) => item.category === "insurance")?.id;
    if (!insuranceId) throw new Error("insurance id missing");
    await saveReadinessRecord(db, owner, {
      category: "insurance",
      label: "insurance",
      recordedValue: "Recorded by the test",
      status: "active",
      source: "Test file",
      verifiedOn: "2026-01-15",
      expiresOn: "2026-11-01",
      responsiblePerson: "Test owner",
    }, insuranceId);
    expect((await pursuitView(db, owner, row.id, today))?.suggestion.recommendation).toBe("high_risk");
  });

  it("does not call xAI without a key and cites only the stored packet when a key is passed", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("owner-ai", "owner-ai@example.com", "Owner"));
    const other = await ensurePrincipal(db, person("other-ai", "other-ai@example.com", "Other"));
    await inviteMember(db, owner, "viewer-ai@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("viewer-ai", "viewer-ai@example.com", "Viewer"));
    const hit = parseGrantsHit({
      id: "50",
      number: "NOTICE-50",
      title: "Stored notice",
      agency: "Health Resources and Services Administration",
      closeDate: "02/02/2027",
    });
    if (!hit) throw new Error("hit missing");
    hit.description = "Stored description only.";
    hit.coverage = { ...hit.coverage, description: true };
    await saveParsedOpportunity(db, "production", hit, new Date("2026-11-09T07:20:00Z"));
    const [row] = await db.select().from(opportunities).where(eq(opportunities.sourceId, "50"));
    if (!row) throw new Error("row missing");

    let calls = 0;
    await expect(draftPursuit(db, owner, row.id, {
      apiKey: null,
      today,
      fetchImpl: async () => {
        calls += 1;
        return new Response("{}", { status: 200 });
      },
    })).rejects.toMatchObject({ code: "missing-key" });
    expect(calls).toBe(0);
    expect(await db.select().from(aiRequests)).toHaveLength(0);
    expect((await pursuitView(db, owner, row.id, today))?.draft).toBeNull();

    let body = "";
    let authorization = "";
    await draftPursuit(db, owner, row.id, {
      apiKey: "test-key",
      today,
      fetchImpl: async (input, init) => {
        calls += 1;
        expect(input).toBe("https://api.x.ai/v1/chat/completions");
        const headers = init?.headers as Record<string, string>;
        authorization = headers.authorization;
        body = String(init?.body);
        return Response.json({ choices: [{ message: { content: "The stored agency is Health Resources and Services Administration." } }] });
      },
    });
    expect(calls).toBe(1);
    expect(authorization).toBe("Bearer test-key");
    const parsed = JSON.parse(body) as { model: string; messages: { role: string; content: string }[] };
    expect(parsed.model).toBe("grok-4.7");
    expect(parsed.messages[0]?.content).toContain("Do not invent awards");
    expect(parsed.messages[0]?.content).toContain("win probability");
    const packet = JSON.parse(parsed.messages[1]?.content.replace("Stored records:\n", "") ?? "{}") as Record<string, unknown>;
    expect(packet.agency).toBe("Health Resources and Services Administration");
    expect(packet.noticeText).toBe("Stored description only.");
    expect(packet.deadline).toBe("2027-02-02");
    expect(packet.winProbability).toBeUndefined();
    expect(packet.competitors).toBeUndefined();
    expect(packet.awards).toBeUndefined();
    expect(packet.suggestion).toBe("needs_information");
    const drafted = await pursuitView(db, owner, row.id, today);
    expect(drafted?.draft?.draft).toBe("The stored agency is Health Resources and Services Administration.");
    expect(drafted?.draft?.model).toBe("grok-4.7");
    expect(await db.select().from(aiAnswers)).toHaveLength(0);
    expect((await pursuitView(db, other, row.id, today))?.draft).toBeNull();

    await draftPursuit(db, owner, row.id, {
      apiKey: "test-key",
      today,
      fetchImpl: async () => {
        throw new Error("socket failed for test-key");
      },
    });
    const failed = await pursuitView(db, owner, row.id, today);
    expect(failed?.draft?.error).toContain("[redacted]");
    expect(failed?.draft?.error).not.toContain("test-key");
    expect(failed?.suggestion.recommendation).toBe("needs_information");

    await expect(draftPursuit(db, viewer, row.id, {
      apiKey: "test-key",
      today,
      fetchImpl: async () => {
        calls += 1;
        return Response.json({});
      },
    })).rejects.toBeInstanceOf(AppError);
    expect(calls).toBe(1);
  });
});
