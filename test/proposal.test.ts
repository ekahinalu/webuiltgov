import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ensurePrincipal } from "../lib/auth/principal";
import { AppError } from "../lib/auth/roles";
import { parseGrantsDetail, parseGrantsHit } from "../lib/connectors/grants-gov";
import { createTestDb } from "../lib/db/client";
import { aiRequests, opportunities } from "../lib/db/schema";
import { saveParsedOpportunity } from "../lib/opportunities/store";
import { inviteMember } from "../lib/org/service";
import { proposalExportLines } from "../lib/proposals/model";
import { renderProposalPdf } from "../lib/proposals/pdf";
import {
  addVerifiedProject,
  draftProposal,
  proposalPdf,
  proposalView,
  saveDraftIntoSection,
  saveMatrixLine,
  saveProposalSection,
  setReadinessInclusion,
} from "../lib/proposals/service";
import { saveReadinessRecord } from "../lib/readiness/service";

function person(sub: string, email: string, name: string) {
  return { plane: "production" as const, sub, email, name, simulated: false };
}

describe("proposal export", () => {
  it("includes only saved text", () => {
    const lines = proposalExportLines({
      sections: { cover: "Cover text entered for this check.", understanding: null, technical_approach: null },
      readiness: [],
      projects: [],
    });
    const text = lines.join("\n");
    expect(text).toContain("Cover text entered for this check.");
    expect(text).not.toContain("Understanding of the project");
    expect(text).not.toContain("Small businesses");
    expect(text).not.toContain("HRSA-27-072");
    const pdf = renderProposalPdf(lines);
    expect(pdf.subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(pdf.toString("latin1")).toContain("Cover text entered for this check.");
    expect(renderProposalPdf([]).toString("latin1")).toContain("No saved proposal text.");
  });
});

describe("proposal workspace", () => {
  it("keeps empty sections empty and does not invent requirements or projects", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("prop-owner", "prop-owner@example.com", "Owner"));
    const other = await ensurePrincipal(db, person("prop-other", "prop-other@example.com", "Other"));
    await inviteMember(db, owner, "prop-viewer@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("prop-viewer", "prop-viewer@example.com", "Viewer"));
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
        },
      },
    });
    if (!hit || !detail) throw new Error("fixture missing");
    await saveParsedOpportunity(db, "production", {
      ...hit,
      description: detail.description,
      coverage: { ...hit.coverage, description: true },
      sourceFacts: { ...hit.sourceFacts, ...detail.sourceFacts },
    }, new Date("2026-11-09T07:40:00Z"));
    const [row] = await db.select().from(opportunities).where(eq(opportunities.sourceId, "363546"));
    if (!row) throw new Error("row missing");

    const opened = await proposalView(db, owner, row.id);
    expect(opened?.sections).toEqual({ cover: null, understanding: null, technical_approach: null });
    expect(opened?.matrix.map((line) => line.text)).toEqual(["Small businesses", "State governments"]);
    expect(opened?.matrix.every((line) => line.completion === null && line.section === null)).toBe(true);
    expect(opened?.projects).toEqual([]);
    expect(opened?.readiness).toEqual([]);

    await saveProposalSection(db, owner, row.id, "cover", "Cover text entered for this check.");
    await saveProposalSection(db, owner, row.id, "understanding", "   ");
    await expect(saveProposalSection(db, owner, row.id, "past_performance", "We built a courthouse.")).rejects.toMatchObject({
      code: "proposal-invalid",
    });
    await expect(saveProposalSection(db, viewer, row.id, "cover", "Viewer text")).rejects.toBeInstanceOf(AppError);
    expect((await proposalView(db, other, row.id))?.sections.cover).toBeNull();

    const coverOnly = await proposalPdf(db, owner, row.id);
    const coverText = coverOnly?.toString("latin1") ?? "";
    expect(coverText).toContain("Cover text entered for this check.");
    expect(coverText).not.toContain("Understanding of the project");
    expect(coverText).not.toContain("Small businesses");
    expect(coverText).not.toContain("HRSA-27-072");
    expect(coverText).not.toContain("WISH");
    expect(coverText).not.toContain("We built a courthouse");

    await saveReadinessRecord(db, owner, {
      category: "legal_business",
      label: "Legal name",
      recordedValue: "Harbor Desk",
      status: "",
      source: "",
      verifiedOn: "",
      expiresOn: "",
      responsiblePerson: "",
    });
    const withReadiness = await proposalView(db, owner, row.id);
    const readinessId = withReadiness?.readiness[0]?.id;
    if (!readinessId) throw new Error("readiness missing");
    await expect(setReadinessInclusion(db, other, row.id, readinessId, true)).rejects.toMatchObject({ code: "not-found" });
    const beforeInclude = (await proposalPdf(db, owner, row.id))?.toString("latin1") ?? "";
    expect(beforeInclude).not.toContain("Harbor Desk");
    await setReadinessInclusion(db, owner, row.id, readinessId, true);
    expect((await proposalPdf(db, owner, row.id))?.toString("latin1")).toContain("Harbor Desk");

    await addVerifiedProject(db, owner, row.id, { name: "Typed project", client: "", description: "", completedOn: "" });
    const projects = (await proposalView(db, owner, row.id))?.projects ?? [];
    expect(projects).toHaveLength(1);
    expect(projects[0]?.client).toBeNull();
    expect(projects[0]?.included).toBe(true);
    const withProject = (await proposalPdf(db, owner, row.id))?.toString("latin1") ?? "";
    expect(withProject).toContain("Typed project");
    expect(withProject.toLowerCase()).not.toContain("certification");

    await expect(saveMatrixLine(db, owner, row.id, "grants.gov:applicant-type:99", "cover", "complete")).rejects.toMatchObject({
      code: "proposal-invalid",
    });
    await saveMatrixLine(db, owner, row.id, "grants.gov:applicant-type:23", "understanding", "needs_review");
    const matrix = (await proposalView(db, owner, row.id))?.matrix ?? [];
    expect(matrix.find((line) => line.sourceKey.endsWith(":23"))).toMatchObject({
      section: "understanding",
      completion: "needs_review",
    });
    expect(matrix.find((line) => line.sourceKey.endsWith(":00"))?.completion).toBeNull();
    expect((await proposalPdf(db, owner, row.id))?.toString("latin1")).not.toContain("Needs review");

    let calls = 0;
    await expect(draftProposal(db, owner, row.id, {
      apiKey: null,
      fetchImpl: async () => {
        calls += 1;
        return Response.json({});
      },
    })).rejects.toMatchObject({ code: "missing-key" });
    expect(calls).toBe(0);
    expect(await db.select().from(aiRequests)).toHaveLength(0);

    await draftProposal(db, owner, row.id, {
      apiKey: "test-key",
      fetchImpl: async (input, init) => {
        calls += 1;
        expect(input).toBe("https://api.x.ai/v1/chat/completions");
        const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
        expect(body.messages[0]?.content).toContain("Do not invent projects");
        const packet = JSON.parse(body.messages[1]?.content.replace("Stored records:\n", "") ?? "{}") as Record<string, unknown>;
        expect(packet.noticeText).toBe("The purpose of the stored notice is screening.");
        expect(packet.licenses).toBeUndefined();
        expect(packet.certifications).toBeUndefined();
        expect(JSON.stringify(packet.savedSections)).toContain("Cover text entered for this check.");
        expect(JSON.stringify(packet.readiness)).toContain("Harbor Desk");
        return Response.json({ choices: [{ message: { content: "Draft from the stored notice only." } }] });
      },
    });
    expect(calls).toBe(1);
    const drafted = await proposalView(db, owner, row.id);
    expect(drafted?.draft?.draft).toBe("Draft from the stored notice only.");
    expect(drafted?.sections.understanding).toBeNull();
    expect((await proposalPdf(db, owner, row.id))?.toString("latin1")).not.toContain("Draft from the stored notice only.");
    await expect(saveDraftIntoSection(db, owner, row.id, "past_performance")).rejects.toMatchObject({ code: "proposal-invalid" });
    await saveDraftIntoSection(db, owner, row.id, "understanding");
    expect((await proposalView(db, owner, row.id))?.sections.understanding).toBe("Draft from the stored notice only.");
    expect((await proposalPdf(db, owner, row.id))?.toString("latin1")).toContain("Draft from the stored notice only.");
  });
});
