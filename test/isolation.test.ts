import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ensurePrincipal } from "../lib/auth/principal";
import { addFulfillmentItem, awardWorkspace, saveAward, setFulfillmentComplete } from "../lib/awards/service";
import { approveBidPrice, bidWorkspace, openBid, saveBidEstimate } from "../lib/bids/service";
import { parseGrantsDetail, parseGrantsHit } from "../lib/connectors/grants-gov";
import { createTestDb } from "../lib/db/client";
import {
  awards,
  fulfillmentItems,
  invoices,
  opportunities,
  payments,
  proposalDrafts,
  proposalSections,
  quotes,
  submissionRecords,
  vendors,
} from "../lib/db/schema";
import { addInvoice, addPayment, invoiceWorkspace } from "../lib/invoices/service";
import { saveParsedOpportunity } from "../lib/opportunities/store";
import {
  addVerifiedProject,
  draftProposal,
  proposalPdf,
  proposalView,
  saveDraftIntoSection,
  saveMatrixLine,
  saveProposalSection,
  setProjectInclusion,
  setReadinessInclusion,
} from "../lib/proposals/service";
import { addQuote, addVendor, quoteWorkspace } from "../lib/quotes/service";
import { saveReadinessRecord } from "../lib/readiness/service";
import { recordInternalApproval, recordSubmission, submissionWorkspace } from "../lib/submissions/service";

function person(sub: string, email: string, name: string) {
  return { plane: "production" as const, sub, email, name, simulated: false };
}

const OWNER_TEXT = [
  "Owner award letter",
  "Owner notice to proceed",
  "Owner monthly report",
  "INV-OWNER-77",
  "Owner Electric",
  "Owner panel work",
  "Owner cover sentence.",
  "Owner model draft sentence.",
  "Owner Harbor Desk",
  "Owner typed project",
  "CONFIRM-OWNER-77",
  "Owner typed destination",
  "Isolation Owner",
];

describe("organization isolation", () => {
  it("keeps award, invoice, payment, quote, proposal, and submission records inside one organization", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("iso-owner", "iso-owner@example.com", "Isolation Owner"));
    const other = await ensurePrincipal(db, person("iso-other", "iso-other@example.com", "Outside Org"));
    expect(other.organizationId).not.toBe(owner.organizationId);

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
    }, new Date("2026-11-09T08:10:00Z"));
    const [notice] = await db.select().from(opportunities).where(eq(opportunities.sourceId, "363546"));
    if (!notice) throw new Error("notice missing");

    await openBid(db, owner, notice.id);
    await saveBidEstimate(db, owner, notice.id, { laborLow: "100", proposedPrice: "250" });
    await approveBidPrice(db, owner, notice.id);
    await saveProposalSection(db, owner, notice.id, "cover", "Owner cover sentence.");
    await saveReadinessRecord(db, owner, {
      category: "legal_business",
      label: "Legal name",
      recordedValue: "Owner Harbor Desk",
      status: "",
      source: "",
      verifiedOn: "",
      expiresOn: "",
      responsiblePerson: "",
    });
    const readinessId = (await proposalView(db, owner, notice.id))?.readiness[0]?.id;
    if (!readinessId) throw new Error("readiness missing");
    await setReadinessInclusion(db, owner, notice.id, readinessId, true);
    await addVerifiedProject(db, owner, notice.id, {
      name: "Owner typed project",
      client: "Owner client",
      description: "Owner project description",
      completedOn: "",
    });
    const projectId = (await proposalView(db, owner, notice.id))?.projects[0]?.id;
    if (!projectId) throw new Error("project missing");
    await saveMatrixLine(db, owner, notice.id, "grants.gov:applicant-type:23", "cover", "needs_review");
    await draftProposal(db, owner, notice.id, {
      apiKey: "test-key",
      fetchImpl: async () => Response.json({ choices: [{ message: { content: "Owner model draft sentence." } }] }),
    });
    await saveDraftIntoSection(db, owner, notice.id, "understanding");
    await recordInternalApproval(db, owner, notice.id);
    await recordSubmission(db, owner, notice.id, {
      confirmationNumber: "CONFIRM-OWNER-77",
      destination: "Owner typed destination",
      submittedAt: "2026-11-09T08:10",
    });
    await saveAward(db, owner, notice.id, { amount: "2500", awardedOn: "2026-11-01", source: "Owner award letter" });
    await addFulfillmentItem(db, owner, notice.id, { kind: "milestone", name: "Owner notice to proceed", dueOn: "" });
    await addFulfillmentItem(db, owner, notice.id, { kind: "obligation", name: "Owner monthly report", dueOn: "2026-12-01" });
    const milestoneId = (await awardWorkspace(db, owner, notice.id))?.milestones[0]?.id;
    if (!milestoneId) throw new Error("milestone missing");
    await addInvoice(db, owner, notice.id, { number: "INV-OWNER-77", amount: "100" });
    const invoiceId = (await invoiceWorkspace(db, owner, notice.id))?.invoices[0]?.id;
    if (!invoiceId) throw new Error("invoice missing");
    await addPayment(db, owner, notice.id, { invoiceId, amount: "123.45", paidOn: "2026-11-02" });
    await addVendor(db, owner, notice.id, { name: "Owner Electric", trade: "Electrical" });
    const vendorId = (await quoteWorkspace(db, owner, notice.id))?.vendors[0]?.id;
    if (!vendorId) throw new Error("vendor missing");
    await addQuote(db, owner, notice.id, { vendorId, amount: "222", covers: "Owner panel work" });

    const hiddenAward = await awardWorkspace(db, other, notice.id);
    expect(hiddenAward?.award).toBeNull();
    expect(hiddenAward?.milestones).toEqual([]);
    expect(hiddenAward?.obligations).toEqual([]);
    expect(JSON.stringify(hiddenAward)).not.toContain("Owner award letter");

    const hiddenInvoices = await invoiceWorkspace(db, other, notice.id);
    expect(hiddenInvoices?.awardedCents).toBeNull();
    expect(hiddenInvoices?.invoicedCents).toBeNull();
    expect(hiddenInvoices?.collectedCents).toBeNull();
    expect(hiddenInvoices?.invoices).toEqual([]);

    const hiddenSubmission = await submissionWorkspace(db, other, notice.id);
    expect(hiddenSubmission?.submission).toBeNull();
    expect(hiddenSubmission?.approval).toBeNull();
    expect(hiddenSubmission?.bidStage).toBeNull();
    expect(hiddenSubmission?.priceState).toBe("none");
    expect(hiddenSubmission?.priceApprovedByName).toBeNull();
    expect(hiddenSubmission?.checklist.find((line) => line.label === "Cover")?.state).toBe("empty");
    expect(hiddenSubmission?.checklist.find((line) => line.label === "Understanding of the project")?.state).toBe("empty");
    expect(hiddenSubmission?.checklist.find((line) => line.label === "Past performance")?.state).toBe("empty");
    expect(hiddenSubmission?.checklist.find((line) => line.label === "Small businesses")?.state).toBe("empty");
    expect(JSON.stringify(hiddenSubmission)).not.toContain("CONFIRM-OWNER-77");
    expect(JSON.stringify(hiddenSubmission)).not.toContain("Isolation Owner");

    await openBid(db, other, notice.id);
    const hiddenQuotes = await quoteWorkspace(db, other, notice.id);
    expect(hiddenQuotes?.vendors).toEqual([]);
    expect(hiddenQuotes?.quotes).toEqual([]);
    expect(hiddenQuotes?.summary).toBe("No quotes are entered for this bid.");

    const hiddenProposal = await proposalView(db, other, notice.id);
    expect(hiddenProposal?.sections).toEqual({ cover: null, understanding: null, technical_approach: null });
    expect(hiddenProposal?.readiness).toEqual([]);
    expect(hiddenProposal?.includedReadinessIds).toEqual([]);
    expect(hiddenProposal?.projects).toEqual([]);
    expect(hiddenProposal?.draft).toBeNull();
    expect(hiddenProposal?.matrix.find((line) => line.sourceKey.endsWith(":23"))).toMatchObject({
      section: null,
      completion: null,
    });
    const hiddenPdf = (await proposalPdf(db, other, notice.id))?.toString("latin1") ?? "";
    for (const secret of OWNER_TEXT) expect(hiddenPdf).not.toContain(secret);

    await expect(setFulfillmentComplete(db, other, notice.id, milestoneId, true)).rejects.toMatchObject({ code: "not-found" });
    await expect(addFulfillmentItem(db, other, notice.id, { kind: "milestone", name: "Outside milestone", dueOn: "" })).rejects.toMatchObject({
      code: "item-award",
    });
    await expect(addInvoice(db, other, notice.id, { number: "INV-OUTSIDE", amount: "1" })).rejects.toMatchObject({ code: "invoice-award" });
    await expect(addPayment(db, other, notice.id, { invoiceId, amount: "1", paidOn: "2026-11-03" })).rejects.toMatchObject({ code: "not-found" });
    await expect(addQuote(db, other, notice.id, { vendorId, amount: "3", covers: "Outside copied quote" })).rejects.toMatchObject({
      code: "quote-vendor",
    });
    await expect(setReadinessInclusion(db, other, notice.id, readinessId, true)).rejects.toMatchObject({ code: "not-found" });
    await expect(setProjectInclusion(db, other, notice.id, projectId, true)).rejects.toMatchObject({ code: "not-found" });

    await saveAward(db, other, notice.id, { amount: "10", awardedOn: "2026-11-04", source: "Outside award letter" });
    await addFulfillmentItem(db, other, notice.id, { kind: "milestone", name: "Outside milestone", dueOn: "" });
    await addInvoice(db, other, notice.id, { number: "INV-OUTSIDE", amount: "1" });
    await addVendor(db, other, notice.id, { name: "Outside Vendor", trade: "Concrete" });
    const outsideVendorId = (await quoteWorkspace(db, other, notice.id))?.vendors[0]?.id;
    if (!outsideVendorId) throw new Error("outside vendor missing");
    await addQuote(db, other, notice.id, { vendorId: outsideVendorId, amount: "3", covers: "Outside slab" });
    await saveProposalSection(db, other, notice.id, "cover", "Outside cover sentence.");
    await addVerifiedProject(db, other, notice.id, { name: "Outside typed project", client: "", description: "", completedOn: "" });
    await saveMatrixLine(db, other, notice.id, "grants.gov:applicant-type:23", "understanding", "not_applicable");
    await recordInternalApproval(db, other, notice.id);
    await recordSubmission(db, other, notice.id, {
      confirmationNumber: "CONFIRM-OUTSIDE",
      destination: "Outside destination",
      submittedAt: "2026-11-09T09:00",
    });

    const ownerAward = await awardWorkspace(db, owner, notice.id);
    expect(ownerAward?.award?.amountCents).toBe(250000);
    expect(ownerAward?.award?.source).toBe("Owner award letter");
    expect(ownerAward?.award?.enteredByName).toBe("Isolation Owner");
    expect(ownerAward?.milestones.map((item) => item.name)).toEqual(["Owner notice to proceed"]);
    expect(ownerAward?.milestones[0]?.completed).toBe(false);
    expect(ownerAward?.obligations.map((item) => item.name)).toEqual(["Owner monthly report"]);
    const outsideAward = await awardWorkspace(db, other, notice.id);
    expect(outsideAward?.award?.amountCents).toBe(1000);
    expect(outsideAward?.award?.source).toBe("Outside award letter");
    expect(outsideAward?.milestones.map((item) => item.name)).toEqual(["Outside milestone"]);
    expect(outsideAward?.obligations).toEqual([]);
    expect(JSON.stringify(outsideAward)).not.toContain("Owner notice to proceed");

    const ownerInvoices = await invoiceWorkspace(db, owner, notice.id);
    expect(ownerInvoices?.awardedCents).toBe(250000);
    expect(ownerInvoices?.invoicedCents).toBe(10000);
    expect(ownerInvoices?.collectedCents).toBe(12345);
    expect(ownerInvoices?.invoices.map((invoice) => invoice.number)).toEqual(["INV-OWNER-77"]);
    expect(ownerInvoices?.invoices[0]?.payments.map((payment) => payment.amountCents)).toEqual([12345]);
    const outsideInvoices = await invoiceWorkspace(db, other, notice.id);
    expect(outsideInvoices?.awardedCents).toBe(1000);
    expect(outsideInvoices?.invoicedCents).toBe(100);
    expect(outsideInvoices?.collectedCents).toBeNull();
    expect(outsideInvoices?.invoices.map((invoice) => invoice.number)).toEqual(["INV-OUTSIDE"]);
    expect(outsideInvoices?.invoices[0]?.payments).toEqual([]);

    const ownerQuotes = await quoteWorkspace(db, owner, notice.id);
    expect(ownerQuotes?.vendors.map((vendor) => vendor.name)).toEqual(["Owner Electric"]);
    expect(ownerQuotes?.quotes.map((quote) => [quote.vendorName, quote.amountCents, quote.covers])).toEqual([
      ["Owner Electric", 22200, "Owner panel work"],
    ]);
    const outsideQuotes = await quoteWorkspace(db, other, notice.id);
    expect(outsideQuotes?.vendors.map((vendor) => vendor.name)).toEqual(["Outside Vendor"]);
    expect(outsideQuotes?.quotes.map((quote) => [quote.vendorName, quote.covers])).toEqual([["Outside Vendor", "Outside slab"]]);
    expect(JSON.stringify(outsideQuotes)).not.toContain("Owner Electric");

    const ownerProposal = await proposalView(db, owner, notice.id);
    expect(ownerProposal?.sections.cover).toBe("Owner cover sentence.");
    expect(ownerProposal?.sections.understanding).toBe("Owner model draft sentence.");
    expect(ownerProposal?.readiness.map((record) => record.recordedValue)).toEqual(["Owner Harbor Desk"]);
    expect(ownerProposal?.projects.map((project) => project.name)).toEqual(["Owner typed project"]);
    expect(ownerProposal?.matrix.find((line) => line.sourceKey.endsWith(":23"))?.completion).toBe("needs_review");
    expect(ownerProposal?.draft?.draft).toBe("Owner model draft sentence.");
    const ownerPdf = (await proposalPdf(db, owner, notice.id))?.toString("latin1") ?? "";
    expect(ownerPdf).toContain("Owner cover sentence.");
    expect(ownerPdf).toContain("Owner Harbor Desk");
    expect(ownerPdf).toContain("Owner typed project");
    const outsideProposal = await proposalView(db, other, notice.id);
    expect(outsideProposal?.sections.cover).toBe("Outside cover sentence.");
    expect(outsideProposal?.sections.understanding).toBeNull();
    expect(outsideProposal?.readiness).toEqual([]);
    expect(outsideProposal?.projects.map((project) => project.name)).toEqual(["Outside typed project"]);
    expect(outsideProposal?.matrix.find((line) => line.sourceKey.endsWith(":23"))?.completion).toBe("not_applicable");
    expect(outsideProposal?.draft).toBeNull();
    const outsidePdf = (await proposalPdf(db, other, notice.id))?.toString("latin1") ?? "";
    expect(outsidePdf).toContain("Outside cover sentence.");
    expect(outsidePdf).toContain("Outside typed project");
    for (const secret of ["Owner cover sentence.", "Owner Harbor Desk", "Owner typed project", "Owner model draft sentence."]) {
      expect(outsidePdf).not.toContain(secret);
    }
    expect(JSON.stringify(ownerProposal?.projects)).not.toContain("Outside typed project");

    const ownerSubmission = await submissionWorkspace(db, owner, notice.id);
    expect(ownerSubmission?.submission?.confirmationNumber).toBe("CONFIRM-OWNER-77");
    expect(ownerSubmission?.submission?.destination).toBe("Owner typed destination");
    expect(ownerSubmission?.submission?.enteredByName).toBe("Isolation Owner");
    expect(ownerSubmission?.approval?.name).toBe("Isolation Owner");
    expect(ownerSubmission?.bidStage).toBe("submitted");
    expect(ownerSubmission?.priceState).toBe("approved");
    expect(ownerSubmission?.priceApprovedByName).toBe("Isolation Owner");
    expect((await bidWorkspace(db, owner, notice.id))?.bid?.proposedPrice).toBe(25000);
    const outsideSubmission = await submissionWorkspace(db, other, notice.id);
    expect(outsideSubmission?.submission?.confirmationNumber).toBe("CONFIRM-OUTSIDE");
    expect(outsideSubmission?.submission?.destination).toBe("Outside destination");
    expect(outsideSubmission?.approval?.name).toBe("Outside Org");
    expect(outsideSubmission?.priceState).toBe("none");
    expect(outsideSubmission?.priceApprovedByName).toBeNull();
    expect(outsideSubmission?.checklist.find((line) => line.label === "Cover")?.state).toBe("saved");
    expect(outsideSubmission?.checklist.find((line) => line.label === "Understanding of the project")?.state).toBe("empty");
    expect(outsideSubmission?.checklist.find((line) => line.label === "Past performance")?.state).toBe("saved");
    expect(JSON.stringify(outsideSubmission)).not.toContain("CONFIRM-OWNER-77");
    expect(JSON.stringify(outsideSubmission)).not.toContain("Owner typed destination");
    expect(JSON.stringify(outsideSubmission)).not.toContain("Isolation Owner");

    const awardRows = await db.select().from(awards);
    expect(awardRows.filter((item) => item.source === "Owner award letter").map((item) => item.organizationId)).toEqual([owner.organizationId]);
    expect(awardRows.filter((item) => item.source === "Outside award letter").map((item) => item.organizationId)).toEqual([other.organizationId]);
    const itemRows = await db.select().from(fulfillmentItems);
    expect(itemRows.filter((item) => item.name.startsWith("Owner")).every((item) => item.organizationId === owner.organizationId)).toBe(true);
    expect(itemRows.filter((item) => item.name.startsWith("Outside")).every((item) => item.organizationId === other.organizationId)).toBe(true);
    const invoiceRows = await db.select().from(invoices);
    expect(invoiceRows.find((item) => item.number === "INV-OWNER-77")?.organizationId).toBe(owner.organizationId);
    expect(invoiceRows.find((item) => item.number === "INV-OUTSIDE")?.organizationId).toBe(other.organizationId);
    const paymentRows = await db.select().from(payments);
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0]?.organizationId).toBe(owner.organizationId);
    expect(paymentRows[0]?.invoiceId).toBe(invoiceId);
    expect(paymentRows[0]?.amountCents).toBe(12345);
    const vendorRows = await db.select().from(vendors);
    expect(vendorRows.find((item) => item.name === "Owner Electric")?.organizationId).toBe(owner.organizationId);
    expect(vendorRows.find((item) => item.name === "Outside Vendor")?.organizationId).toBe(other.organizationId);
    const quoteRows = await db.select().from(quotes);
    expect(quoteRows.filter((item) => item.covers === "Owner panel work").map((item) => item.organizationId)).toEqual([owner.organizationId]);
    expect(quoteRows.filter((item) => item.covers === "Outside slab").map((item) => item.organizationId)).toEqual([other.organizationId]);
    const sectionRows = await db.select().from(proposalSections);
    expect(sectionRows.filter((item) => item.body === "Owner cover sentence.").map((item) => item.organizationId)).toEqual([owner.organizationId]);
    expect(sectionRows.filter((item) => item.body === "Outside cover sentence.").map((item) => item.organizationId)).toEqual([other.organizationId]);
    const draftRows = await db.select().from(proposalDrafts);
    expect(draftRows).toHaveLength(1);
    expect(draftRows[0]?.organizationId).toBe(owner.organizationId);
    expect(draftRows[0]?.draft).toBe("Owner model draft sentence.");
    const submissionRows = await db.select().from(submissionRecords);
    expect(submissionRows.find((item) => item.confirmationNumber === "CONFIRM-OWNER-77")?.organizationId).toBe(owner.organizationId);
    expect(submissionRows.find((item) => item.confirmationNumber === "CONFIRM-OUTSIDE")?.organizationId).toBe(other.organizationId);
  });
});
