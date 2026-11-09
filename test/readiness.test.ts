import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ensurePrincipal } from "../lib/auth/principal";
import { AppError } from "../lib/auth/roles";
import { parseGrantsDetail, parseGrantsHit } from "../lib/connectors/grants-gov";
import { createTestDb } from "../lib/db/client";
import { eligibilityMarks, opportunities } from "../lib/db/schema";
import type { ParsedOpportunity } from "../lib/domain";
import { requirementsFromFacts } from "../lib/eligibility/model";
import { eligibilityForOpportunity, setEligibilityMark } from "../lib/eligibility/service";
import { saveParsedOpportunity } from "../lib/opportunities/store";
import { inviteMember } from "../lib/org/service";
import { readinessFlags } from "../lib/readiness/model";
import { listReadiness, saveReadinessRecord, type ReadinessInput } from "../lib/readiness/service";

const today = "2026-11-09";

function person(sub: string, email: string, name: string, plane: "production" | "preview" = "production") {
  return { plane, sub, email, name, simulated: false };
}

function blank(category: string, extra: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    category,
    label: "",
    recordedValue: "",
    status: "",
    source: "",
    verifiedOn: "",
    expiresOn: "",
    responsiblePerson: "",
    ...extra,
  };
}

describe("readiness flags", () => {
  it("flags every blank field and does not invent a status", () => {
    const flags = readinessFlags(
      {
        category: "legal_business",
        label: null,
        recordedValue: null,
        status: null,
        source: null,
        verifiedOn: null,
        expiresOn: null,
        responsiblePerson: null,
      },
      today,
    );
    expect(flags).toEqual([
      "label missing",
      "value missing",
      "status missing",
      "source missing",
      "verification date missing",
      "expiration missing",
      "responsible person missing",
    ]);
  });

  it("flags a past date as expired and a date inside 30 days as expiring", () => {
    const base = {
      category: "insurance" as const,
      label: "Policy",
      recordedValue: null,
      status: null,
      source: null,
      verifiedOn: null,
      expiresOn: "2026-11-01",
      responsiblePerson: null,
    };
    expect(readinessFlags(base, today)).toContain("expired");
    expect(readinessFlags({ ...base, expiresOn: "2026-12-09" }, today)).toContain("expiring");
    expect(readinessFlags({ ...base, expiresOn: "2026-12-10" }, today)).not.toContain("expiring");
    expect(readinessFlags({ ...base, expiresOn: "2026-12-10" }, today)).not.toContain("expired");
  });
});

describe("readiness records", () => {
  it("keeps blanks blank, isolates organizations, and blocks viewers", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("owner-1", "owner@example.com", "Owner"));
    const other = await ensurePrincipal(db, person("other-1", "other@example.com", "Other"));
    await inviteMember(db, owner, "viewer@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("viewer-1", "viewer@example.com", "Viewer"));
    expect(viewer.organizationId).toBe(owner.organizationId);
    expect(viewer.role).toBe("viewer");

    await saveReadinessRecord(db, owner, blank("legal_business"));
    const saved = await listReadiness(db, owner, today);
    expect(saved.records).toHaveLength(1);
    expect(saved.records[0]?.label).toBeNull();
    expect(saved.records[0]?.recordedValue).toBeNull();
    expect(saved.records[0]?.status).toBeNull();
    expect(saved.records[0]?.source).toBeNull();
    expect(saved.records[0]?.verifiedOn).toBeNull();
    expect(saved.records[0]?.expiresOn).toBeNull();
    expect(saved.records[0]?.responsiblePerson).toBeNull();
    expect(saved.records[0]?.flags).toContain("value missing");
    expect(saved.missing).not.toContain("legal_business");
    expect(saved.missing).toEqual(["registration", "license", "certification", "insurance", "bonding"]);

    const otherView = await listReadiness(db, other, today);
    expect(otherView.records).toHaveLength(0);
    expect(otherView.missing).toHaveLength(6);
    await expect(saveReadinessRecord(db, other, blank("legal_business", { label: "Stolen" }), saved.records[0]?.id)).rejects.toMatchObject({
      code: "not-found",
    });
    await expect(saveReadinessRecord(db, viewer, blank("insurance"))).rejects.toBeInstanceOf(AppError);

    await saveReadinessRecord(db, owner, blank("insurance", { label: "Policy", expiresOn: "2026-11-01" }));
    await saveReadinessRecord(db, owner, blank("bonding", { label: "Bond", expiresOn: "2026-12-01" }));
    const flagged = await listReadiness(db, owner, today);
    expect(flagged.records.find((record) => record.category === "insurance")?.flags).toContain("expired");
    expect(flagged.records.find((record) => record.category === "bonding")?.flags).toContain("expiring");
    expect(flagged.records.find((record) => record.category === "insurance")?.recordedValue).toBeNull();
    await expect(saveReadinessRecord(db, owner, blank("license", { status: "eligible" }))).rejects.toMatchObject({
      code: "readiness-invalid",
    });
    await expect(saveReadinessRecord(db, owner, blank("license", { expiresOn: "2026-02-31" }))).rejects.toMatchObject({
      code: "readiness-invalid",
    });
  });
});

describe("eligibility gate", () => {
  it("marks only source applicant types and does not infer them from readiness", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("owner-2", "owner2@example.com", "Owner"));
    const other = await ensurePrincipal(db, person("other-2", "other2@example.com", "Other"));
    await inviteMember(db, owner, "viewer2@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("viewer-2", "viewer2@example.com", "Viewer"));
    const hit = parseGrantsHit({
      id: "363546",
      number: "HRSA-27-072",
      title: "Women's Initiative for Screening and Health (WISH)",
      agency: "Health Resources and Services Administration",
      closeDate: "01/08/2027",
    });
    if (!hit) throw new Error("hit missing");
    const detail = parseGrantsDetail({
      errorcode: 0,
      data: {
        id: 363546,
        synopsis: {
          applicantTypes: [
            { id: "23", description: "Small businesses" },
            { id: "00", description: "State governments" },
          ],
          costSharing: false,
        },
      },
    });
    if (!detail) throw new Error("detail missing");
    const enriched: ParsedOpportunity = {
      ...hit,
      description: detail.description,
      coverage: { ...hit.coverage, description: true },
      sourceFacts: { ...hit.sourceFacts, ...detail.sourceFacts },
    };
    await saveParsedOpportunity(db, "production", enriched, new Date("2026-11-09T06:40:00Z"));
    await saveParsedOpportunity(db, "production", hit, new Date("2026-11-09T06:41:00Z"));
    const [row] = await db.select().from(opportunities).where(eq(opportunities.sourceId, "363546"));
    if (!row) throw new Error("row missing");
    expect(row.sourceFacts.applicantTypes).toEqual([
      { id: "23", description: "Small businesses" },
      { id: "00", description: "State governments" },
    ]);
    expect(requirementsFromFacts(row.sourceFacts).requirements.map((item) => item.text)).toEqual([
      "Small businesses",
      "State governments",
    ]);

    await saveReadinessRecord(db, owner, blank("legal_business", { label: "Entity", recordedValue: "Small businesses", status: "active" }));
    const before = await eligibilityForOpportunity(db, owner, row.id);
    expect(before?.loaded).toBe(true);
    expect(before?.costSharing).toBe(false);
    expect(before?.lines.map((line) => line.disposition)).toEqual([null, null]);

    await expect(setEligibilityMark(db, viewer, row.id, "grants.gov:applicant-type:23", "satisfied")).rejects.toBeInstanceOf(AppError);
    await expect(setEligibilityMark(db, owner, row.id, "grants.gov:applicant-type:99", "satisfied")).rejects.toMatchObject({
      code: "eligibility-invalid",
    });
    await expect(setEligibilityMark(db, owner, row.id, "grants.gov:applicant-type:23", "eligible")).rejects.toMatchObject({
      code: "eligibility-invalid",
    });
    await setEligibilityMark(db, owner, row.id, "grants.gov:applicant-type:23", "needs_verification");
    const marked = await eligibilityForOpportunity(db, owner, row.id);
    expect(marked?.lines[0]?.disposition).toBe("needs_verification");
    expect(marked?.lines[1]?.disposition).toBeNull();
    const isolated = await eligibilityForOpportunity(db, other, row.id);
    expect(isolated?.lines.map((line) => line.disposition)).toEqual([null, null]);
    await setEligibilityMark(db, other, row.id, "grants.gov:applicant-type:23", "satisfied");
    const still = await eligibilityForOpportunity(db, owner, row.id);
    expect(still?.lines[0]?.disposition).toBe("needs_verification");
    await setEligibilityMark(db, owner, row.id, "grants.gov:applicant-type:23", "");
    const cleared = await eligibilityForOpportunity(db, owner, row.id);
    expect(cleared?.lines[0]?.disposition).toBeNull();

    const bare = parseGrantsHit({ id: "9", title: "No eligibility list", number: "NONE-9", agency: "Example", closeDate: "03/01/2027" });
    if (!bare) throw new Error("bare missing");
    await saveParsedOpportunity(db, "production", bare, new Date("2026-11-09T06:42:00Z"));
    const [unloaded] = await db.select().from(opportunities).where(eq(opportunities.sourceId, "9"));
    if (!unloaded) throw new Error("unloaded missing");
    const emptyGate = await eligibilityForOpportunity(db, owner, unloaded.id);
    expect(emptyGate?.loaded).toBe(false);
    expect(emptyGate?.lines).toEqual([]);
    await db.insert(eligibilityMarks).values({
      organizationId: owner.organizationId,
      opportunityId: unloaded.id,
      sourceKey: "grants.gov:applicant-type:23",
      disposition: "satisfied",
      updatedBy: owner.userId,
    });
    const hidden = await eligibilityForOpportunity(db, owner, unloaded.id);
    expect(hidden?.lines).toEqual([]);

    const preview = await ensurePrincipal(db, person("preview-1", "preview@example.com", "Preview", "preview"));
    await expect(setEligibilityMark(db, preview, row.id, "grants.gov:applicant-type:23", "satisfied")).rejects.toMatchObject({
      code: "not-found",
    });
  });
});
