import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ensurePrincipal } from "../lib/auth/principal";
import { AppError } from "../lib/auth/roles";
import { columnTotal, describeTotal, emptyEstimate, parseMoney } from "../lib/bids/model";
import { approveBidPrice, bidWorkspace, openBid, saveBidEstimate, setBidStage } from "../lib/bids/service";
import { parseGrantsHit } from "../lib/connectors/grants-gov";
import { createTestDb } from "../lib/db/client";
import { opportunities } from "../lib/db/schema";
import { saveParsedOpportunity } from "../lib/opportunities/store";
import { setPipeline } from "../lib/opportunities/pipeline";
import { inviteMember } from "../lib/org/service";

function person(sub: string, email: string, name: string) {
  return { plane: "production" as const, sub, email, name, simulated: false };
}

describe("estimate totals", () => {
  it("sums only entered amounts and does not treat a blank as zero", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("1,000.50")).toBe(100050);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("-1")).toBe("invalid");
    expect(parseMoney("12.555")).toBe("invalid");
    const amounts = emptyEstimate();
    expect(describeTotal(columnTotal(amounts, "low"))).toBe("No amounts entered");
    amounts.labor.low = 10000;
    amounts.labor.expected = 1250;
    amounts.materials.low = 0;
    const low = columnTotal(amounts, "low");
    expect(low.totalCents).toBe(10000);
    expect(low.entered).toBe(2);
    expect(describeTotal(low)).toBe("$100.00 from 2 of 7 amounts");
    expect(describeTotal(columnTotal(amounts, "expected"))).toBe("$12.50 from 1 of 7 amounts");
    expect(describeTotal(columnTotal(amounts, "high"))).toBe("No amounts entered");
    for (const line of Object.keys(amounts) as (keyof typeof amounts)[]) {
      amounts[line] = { low: 100, expected: 200, high: 300 };
    }
    expect(describeTotal(columnTotal(amounts, "expected"))).toBe("$14.00");
  });
});

describe("bid workspace", () => {
  it("keeps a blank estimate blank, isolates organizations, and records who approved the price", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("bid-owner", "bid-owner@example.com", "Bid Owner"));
    const other = await ensurePrincipal(db, person("bid-other", "bid-other@example.com", "Other"));
    await inviteMember(db, owner, "bid-viewer@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("bid-viewer", "bid-viewer@example.com", "Viewer"));
    const hit = parseGrantsHit({
      id: "363546",
      number: "HRSA-27-072",
      title: "Women's Initiative for Screening and Health (WISH)",
      agency: "Health Resources and Services Administration",
      closeDate: "01/08/2027",
    });
    if (!hit) throw new Error("hit missing");
    await saveParsedOpportunity(db, "production", hit, new Date("2026-11-09T07:30:00Z"));
    const [row] = await db.select().from(opportunities).where(eq(opportunities.sourceId, "363546"));
    if (!row) throw new Error("row missing");
    await setPipeline(db, owner, row.id, "pursuing");

    expect((await bidWorkspace(db, owner, row.id))?.bid).toBeNull();
    expect((await bidWorkspace(db, owner, row.id))?.pipelineStatus).toBe("pursuing");
    await expect(openBid(db, viewer, row.id)).rejects.toBeInstanceOf(AppError);
    await openBid(db, owner, row.id);
    const opened = await bidWorkspace(db, owner, row.id);
    expect(opened?.bid?.stage).toBe("identified");
    expect(opened?.bid?.proposedPrice).toBeNull();
    expect(opened?.bid?.priceState).toBe("none");
    expect(opened?.bid?.totals.low.totalCents).toBeNull();
    expect(opened?.bid?.amounts.labor).toEqual({ low: null, expected: null, high: null });

    await saveBidEstimate(db, owner, row.id, { laborLow: "100", laborExpected: "12.50", materialsLow: "0" });
    await openBid(db, owner, row.id);
    const estimated = await bidWorkspace(db, owner, row.id);
    expect(estimated?.bid?.amounts.labor).toEqual({ low: 10000, expected: 1250, high: null });
    expect(estimated?.bid?.amounts.materials.low).toBe(0);
    expect(estimated?.bid?.amounts.equipment.high).toBeNull();
    expect(estimated?.bid?.totals.low.totalCents).toBe(10000);
    expect(estimated?.bid?.totals.high.totalCents).toBeNull();
    expect(estimated?.pipelineStatus).toBe("pursuing");

    await expect(saveBidEstimate(db, owner, row.id, { laborLow: "12.555" })).rejects.toMatchObject({ code: "bid-invalid" });
    await expect(approveBidPrice(db, owner, row.id)).rejects.toMatchObject({ code: "bid-price" });
    await expect(setBidStage(db, owner, row.id, "won")).rejects.toMatchObject({ code: "bid-invalid" });
    await setBidStage(db, owner, row.id, "estimating");
    await setBidStage(db, owner, row.id, "proposal_drafting");
    await setBidStage(db, owner, row.id, "submitted");
    expect((await bidWorkspace(db, owner, row.id))?.bid?.stage).toBe("submitted");
    expect((await bidWorkspace(db, owner, row.id))?.pipelineStatus).toBe("pursuing");

    await saveBidEstimate(db, owner, row.id, { laborLow: "100", laborExpected: "12.50", materialsLow: "0", proposedPrice: "250" });
    expect((await bidWorkspace(db, owner, row.id))?.bid?.priceState).toBe("draft");
    await expect(approveBidPrice(db, viewer, row.id)).rejects.toBeInstanceOf(AppError);
    await approveBidPrice(db, owner, row.id);
    const approved = await bidWorkspace(db, owner, row.id);
    expect(approved?.bid?.priceState).toBe("approved");
    expect(approved?.bid?.proposedPrice).toBe(25000);
    expect(approved?.bid?.approvedBy).toBe(owner.userId);
    expect(approved?.bid?.approvedByName).toBe("Bid Owner");
    expect(approved?.bid?.approvedAt).toBeInstanceOf(Date);

    const otherView = await bidWorkspace(db, other, row.id);
    expect(otherView?.bid).toBeNull();
    expect(otherView?.pipelineStatus).toBeNull();
    await openBid(db, other, row.id);
    expect((await bidWorkspace(db, other, row.id))?.bid?.amounts.labor.low).toBeNull();
    expect((await bidWorkspace(db, owner, row.id))?.bid?.priceState).toBe("approved");

    await saveBidEstimate(db, owner, row.id, { laborLow: "100", laborExpected: "12.50", materialsLow: "0", proposedPrice: "275" });
    const redrafted = await bidWorkspace(db, owner, row.id);
    expect(redrafted?.bid?.priceState).toBe("draft");
    expect(redrafted?.bid?.approvedBy).toBeNull();
    expect(redrafted?.bid?.proposedPrice).toBe(27500);
  });
});
