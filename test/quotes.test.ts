import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ensurePrincipal } from "../lib/auth/principal";
import { AppError } from "../lib/auth/roles";
import { bidWorkspace, openBid } from "../lib/bids/service";
import { parseGrantsHit } from "../lib/connectors/grants-gov";
import { createTestDb } from "../lib/db/client";
import { opportunities } from "../lib/db/schema";
import { saveParsedOpportunity } from "../lib/opportunities/store";
import { inviteMember } from "../lib/org/service";
import { compareQuotes, comparisonSummary } from "../lib/quotes/model";
import { addQuote, addVendor, quoteWorkspace } from "../lib/quotes/service";

function person(sub: string, email: string, name: string) {
  return { plane: "production" as const, sub, email, name, simulated: false };
}

describe("quote comparison", () => {
  it("orders entered amounts and does not invent a vendor", () => {
    const quotes = [
      { id: "b", vendorName: "Typed Electric", trade: null, amountCents: 20000, covers: "Panel work" },
      { id: "a", vendorName: "Typed Concrete", trade: "Concrete", amountCents: 5000, covers: "Slab" },
      { id: "c", vendorName: "Typed Electric", trade: null, amountCents: 5000, covers: "Footing" },
    ];
    expect(compareQuotes(quotes).map((quote) => [quote.vendorName, quote.covers])).toEqual([
      ["Typed Concrete", "Slab"],
      ["Typed Electric", "Footing"],
      ["Typed Electric", "Panel work"],
    ]);
    expect(comparisonSummary(quotes)).toBe("Lowest entered amount: $50.00, on 2 quotes.");
    expect(comparisonSummary([])).toBe("No quotes are entered for this bid.");
    expect(comparisonSummary([quotes[1]!])).toBe("One quote is entered.");
  });
});

describe("vendors and quotes", () => {
  it("keeps blank names and amounts out and isolates quotes to the organization", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("quote-owner", "quote-owner@example.com", "Quote Owner"));
    const other = await ensurePrincipal(db, person("quote-other", "quote-other@example.com", "Other"));
    await inviteMember(db, owner, "quote-viewer@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("quote-viewer", "quote-viewer@example.com", "Viewer"));
    const first = parseGrantsHit({
      id: "363546",
      number: "HRSA-27-072",
      title: "Women's Initiative for Screening and Health (WISH)",
      agency: "Health Resources and Services Administration",
      closeDate: "01/08/2027",
    });
    const second = parseGrantsHit({
      id: "363547",
      number: "HRSA-27-073",
      title: "A second stored notice",
      agency: "Health Resources and Services Administration",
      closeDate: "02/08/2027",
    });
    if (!first || !second) throw new Error("hit missing");
    await saveParsedOpportunity(db, "production", first, new Date("2026-11-09T07:45:00Z"));
    await saveParsedOpportunity(db, "production", second, new Date("2026-11-09T07:45:00Z"));
    const rows = await db.select().from(opportunities);
    const wish = rows.find((row) => row.sourceId === "363546");
    const otherNotice = rows.find((row) => row.sourceId === "363547");
    if (!wish || !otherNotice) throw new Error("rows missing");

    expect((await quoteWorkspace(db, owner, wish.id))?.vendors).toEqual([]);
    await expect(addVendor(db, owner, wish.id, { name: "Typed Electric", trade: "Electrical" })).rejects.toMatchObject({
      code: "quote-bid",
    });
    await openBid(db, owner, wish.id);
    await expect(addVendor(db, owner, wish.id, { name: "   ", trade: "Electrical" })).rejects.toMatchObject({ code: "vendor-name" });
    await expect(addVendor(db, viewer, wish.id, { name: "Viewer Vendor", trade: "" })).rejects.toBeInstanceOf(AppError);
    await addVendor(db, owner, wish.id, { name: "Typed Electric", trade: "" });
    await addVendor(db, owner, wish.id, { name: "Typed Concrete", trade: "Concrete" });
    const saved = await quoteWorkspace(db, owner, wish.id);
    expect(saved?.vendors.map((vendor) => [vendor.name, vendor.trade])).toEqual([
      ["Typed Concrete", "Concrete"],
      ["Typed Electric", null],
    ]);
    const electric = saved?.vendors.find((vendor) => vendor.name === "Typed Electric");
    const concrete = saved?.vendors.find((vendor) => vendor.name === "Typed Concrete");
    if (!electric || !concrete) throw new Error("vendors missing");

    await expect(addQuote(db, owner, wish.id, { vendorId: electric.id, amount: "", covers: "Panel work" })).rejects.toMatchObject({
      code: "quote-amount",
    });
    await expect(addQuote(db, owner, wish.id, { vendorId: electric.id, amount: "12.555", covers: "Panel work" })).rejects.toMatchObject({
      code: "quote-invalid",
    });
    await expect(addQuote(db, owner, wish.id, { vendorId: electric.id, amount: "200", covers: "  " })).rejects.toMatchObject({
      code: "quote-covers",
    });
    await expect(addQuote(db, owner, wish.id, { vendorId: "", amount: "200", covers: "Panel work" })).rejects.toMatchObject({
      code: "quote-vendor",
    });
    await openBid(db, other, wish.id);
    await expect(addQuote(db, other, wish.id, { vendorId: electric.id, amount: "10", covers: "Copied quote" })).rejects.toMatchObject({
      code: "quote-vendor",
    });
    expect((await quoteWorkspace(db, other, wish.id))?.quotes).toEqual([]);
    expect((await quoteWorkspace(db, other, wish.id))?.vendors).toEqual([]);

    await addQuote(db, owner, wish.id, { vendorId: electric.id, amount: "200", covers: "Panel work" });
    await addQuote(db, owner, wish.id, { vendorId: concrete.id, amount: "50", covers: "Slab" });
    await addQuote(db, owner, wish.id, { vendorId: electric.id, amount: "0", covers: "No charge entered as zero" });
    const compared = await quoteWorkspace(db, owner, wish.id);
    expect(compared?.quotes.map((quote) => [quote.vendorName, quote.amountCents, quote.covers])).toEqual([
      ["Typed Electric", 0, "No charge entered as zero"],
      ["Typed Concrete", 5000, "Slab"],
      ["Typed Electric", 20000, "Panel work"],
    ]);
    expect(compared?.summary).toBe("Lowest entered amount: $0.00.");
    expect((await bidWorkspace(db, owner, wish.id))?.bid?.amounts.labor.low).toBeNull();
    expect((await bidWorkspace(db, owner, wish.id))?.bid?.proposedPrice).toBeNull();

    await openBid(db, owner, otherNotice.id);
    const secondBid = await quoteWorkspace(db, owner, otherNotice.id);
    expect(secondBid?.vendors.map((vendor) => vendor.name)).toEqual(["Typed Concrete", "Typed Electric"]);
    expect(secondBid?.quotes).toEqual([]);
    expect((await quoteWorkspace(db, viewer, wish.id))?.quotes).toHaveLength(3);
    await expect(addQuote(db, viewer, wish.id, { vendorId: electric.id, amount: "1", covers: "Viewer quote" })).rejects.toBeInstanceOf(AppError);
  });
});
