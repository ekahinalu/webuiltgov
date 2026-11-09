import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ensurePrincipal } from "../lib/auth/principal";
import { AppError } from "../lib/auth/roles";
import { approveBidPrice, bidWorkspace, openBid, saveBidEstimate, setBidStage } from "../lib/bids/service";
import { parseGrantsDetail, parseGrantsHit } from "../lib/connectors/grants-gov";
import { createTestDb } from "../lib/db/client";
import { opportunities } from "../lib/db/schema";
import { saveParsedOpportunity } from "../lib/opportunities/store";
import { inviteMember } from "../lib/org/service";
import { proposalView, saveMatrixLine, saveProposalSection, setReadinessInclusion } from "../lib/proposals/service";
import { saveReadinessRecord } from "../lib/readiness/service";
import { parseSubmissionTime, priceChecklistText, submissionChecklist } from "../lib/submissions/model";
import { recordInternalApproval, recordSubmission, submissionWorkspace } from "../lib/submissions/service";

function person(sub: string, email: string, name: string) {
  return { plane: "production" as const, sub, email, name, simulated: false };
}

describe("submission checklist", () => {
  it("marks only stored sections and matrix lines, and reports a draft price", () => {
    const lines = submissionChecklist({
      sections: { cover: "Cover text", understanding: null, technical_approach: null },
      pastPerformanceSaved: false,
      matrix: [
        { sourceKey: "grants.gov:applicant-type:23", text: "Small businesses", section: null, completion: null },
        { sourceKey: "grants.gov:applicant-type:00", text: "State governments", section: "cover", completion: "needs_review" },
      ],
    });
    expect(lines.map((line) => [line.label, line.state])).toEqual([
      ["Cover", "saved"],
      ["Understanding of the project", "empty"],
      ["Technical approach", "empty"],
      ["Past performance", "empty"],
      ["Small businesses", "empty"],
      ["State governments", "saved"],
    ]);
    expect(lines.find((line) => line.label === "State governments")?.detail).toBe("Needs review. Cover");
    expect(priceChecklistText("draft")).toBe("The proposed price is still a draft.");
    expect(priceChecklistText("none")).toBe("No proposed price is stored.");
    expect(parseSubmissionTime("")).toBeNull();
    expect(parseSubmissionTime("2026-11-09")).toBe("invalid");
    expect(parseSubmissionTime("2026-11-09T07:40")).toEqual(new Date("2026-11-09T07:40:00.000Z"));
  });
});

describe("submission record", () => {
  it("keeps internal approval from marking the bid submitted and rejects a blank submission", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("sub-owner", "sub-owner@example.com", "Sub Owner"));
    const other = await ensurePrincipal(db, person("sub-other", "sub-other@example.com", "Other"));
    await inviteMember(db, owner, "sub-viewer@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("sub-viewer", "sub-viewer@example.com", "Viewer"));
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
          applicantTypes: [{ id: "23", description: "Small businesses" }],
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

    const opened = await submissionWorkspace(db, owner, row.id);
    expect(opened?.checklist.filter((line) => line.kind === "section").every((line) => line.state === "empty")).toBe(true);
    expect(opened?.checklist.filter((line) => line.kind === "matrix").map((line) => line.label)).toEqual(["Small businesses"]);
    expect(opened?.priceState).toBe("none");
    expect(opened?.bidStage).toBeNull();
    expect(opened?.submission).toBeNull();
    expect(opened?.approval).toBeNull();

    await recordInternalApproval(db, owner, row.id);
    const approved = await submissionWorkspace(db, owner, row.id);
    expect(approved?.approval?.name).toBe("Sub Owner");
    expect(approved?.approval?.userId).toBe(owner.userId);
    expect(approved?.approval?.at).toBeInstanceOf(Date);
    expect(approved?.bidStage).toBeNull();
    expect(approved?.submission).toBeNull();
    expect((await bidWorkspace(db, owner, row.id))?.bid).toBeNull();

    await expect(recordSubmission(db, owner, row.id, {
      confirmationNumber: " ",
      destination: "Typed destination",
      submittedAt: "2026-11-09T07:40",
    })).rejects.toMatchObject({ code: "submission-incomplete" });
    await expect(recordSubmission(db, owner, row.id, {
      confirmationNumber: "CHECK-001",
      destination: "",
      submittedAt: "2026-11-09T07:40",
    })).rejects.toMatchObject({ code: "submission-incomplete" });
    await expect(recordSubmission(db, owner, row.id, {
      confirmationNumber: "CHECK-001",
      destination: "Typed destination",
      submittedAt: "",
    })).rejects.toMatchObject({ code: "submission-incomplete" });
    await expect(recordSubmission(db, owner, row.id, {
      confirmationNumber: "CHECK-001",
      destination: "Typed destination",
      submittedAt: "2026-02-31T07:40",
    })).rejects.toMatchObject({ code: "submission-invalid" });
    expect((await bidWorkspace(db, owner, row.id))?.bid).toBeNull();
    expect((await submissionWorkspace(db, owner, row.id))?.submission).toBeNull();

    await openBid(db, owner, row.id);
    await saveBidEstimate(db, owner, row.id, { laborLow: "100", proposedPrice: "250" });
    expect((await submissionWorkspace(db, owner, row.id))?.priceState).toBe("draft");
    await saveProposalSection(db, owner, row.id, "cover", "Cover text entered for this check.");
    await saveMatrixLine(db, owner, row.id, "grants.gov:applicant-type:23", "", "needs_review");
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
    expect((await submissionWorkspace(db, owner, row.id))?.checklist.find((line) => line.label === "Past performance")?.state).toBe("empty");
    const proposal = await proposalView(db, owner, row.id);
    const savedReadiness = proposal?.readiness[0]?.id;
    if (!savedReadiness) throw new Error("readiness missing");
    await setReadinessInclusion(db, owner, row.id, savedReadiness, true);

    await expect(recordInternalApproval(db, viewer, row.id)).rejects.toBeInstanceOf(AppError);
    await expect(recordSubmission(db, viewer, row.id, {
      confirmationNumber: "CHECK-001",
      destination: "Typed destination",
      submittedAt: "2026-11-09T07:40",
    })).rejects.toBeInstanceOf(AppError);
    expect((await bidWorkspace(db, owner, row.id))?.bid?.stage).toBe("identified");

    await recordSubmission(db, owner, row.id, {
      confirmationNumber: "CHECK-001",
      destination: "Typed destination",
      submittedAt: "2026-11-09T07:40",
    });
    const submitted = await submissionWorkspace(db, owner, row.id);
    expect(submitted?.submission?.confirmationNumber).toBe("CHECK-001");
    expect(submitted?.submission?.destination).toBe("Typed destination");
    expect(submitted?.submission?.submittedAt).toEqual(new Date("2026-11-09T07:40:00.000Z"));
    expect(submitted?.submission?.enteredBy).toBe(owner.userId);
    expect(submitted?.submission?.enteredByName).toBe("Sub Owner");
    expect(submitted?.bidStage).toBe("submitted");
    expect(submitted?.priceState).toBe("draft");
    expect(submitted?.checklist.find((line) => line.label === "Cover")?.state).toBe("saved");
    expect(submitted?.checklist.find((line) => line.label === "Understanding of the project")?.state).toBe("empty");
    expect(submitted?.checklist.find((line) => line.label === "Past performance")?.state).toBe("saved");
    expect(submitted?.checklist.find((line) => line.label === "Small businesses")?.state).toBe("saved");
    expect((await bidWorkspace(db, owner, row.id))?.bid?.amounts.labor.low).toBe(10000);
    expect((await bidWorkspace(db, owner, row.id))?.bid?.proposedPrice).toBe(25000);

    await approveBidPrice(db, owner, row.id);
    expect((await submissionWorkspace(db, owner, row.id))?.priceState).toBe("approved");
    expect((await bidWorkspace(db, owner, row.id))?.bid?.stage).toBe("submitted");
    await setBidStage(db, owner, row.id, "closed");
    await expect(setBidStage(db, owner, row.id, "submitted")).rejects.toMatchObject({ code: "submission-only" });
    expect((await submissionWorkspace(db, owner, row.id))?.submission?.confirmationNumber).toBe("CHECK-001");

    const hidden = await submissionWorkspace(db, other, row.id);
    expect(hidden?.submission).toBeNull();
    expect(hidden?.approval).toBeNull();
    expect(hidden?.bidStage).toBeNull();
    expect(hidden?.checklist.find((line) => line.label === "Cover")?.state).toBe("empty");
  });
});
