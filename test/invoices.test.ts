import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ensurePrincipal } from "../lib/auth/principal";
import { AppError } from "../lib/auth/roles";
import { saveAward } from "../lib/awards/service";
import { parseGrantsHit } from "../lib/connectors/grants-gov";
import { createTestDb } from "../lib/db/client";
import { invoices, opportunities, payments } from "../lib/db/schema";
import { invoiceIsPaid, sumCents } from "../lib/invoices/model";
import { addInvoice, addPayment, invoiceWorkspace } from "../lib/invoices/service";
import { saveParsedOpportunity } from "../lib/opportunities/store";
import { inviteMember } from "../lib/org/service";

function person(sub: string, email: string, name: string) {
  return { plane: "production" as const, sub, email, name, simulated: false };
}

describe("invoice totals", () => {
  it("keeps awarded, invoiced, and collected amounts apart and starts unpaid", () => {
    expect(invoiceIsPaid(0, [])).toBe(false);
    expect(invoiceIsPaid(10000, [4000])).toBe(false);
    expect(invoiceIsPaid(10000, [4000, 6000])).toBe(true);
    expect(sumCents([])).toBeNull();
    expect(sumCents([250000, 100000])).toBe(350000);
  });
});

describe("invoices and payments", () => {
  it("rejects a blank invoice and marks paid only when payments cover the amount", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("inv-owner", "inv-owner@example.com", "Invoice Owner"));
    const other = await ensurePrincipal(db, person("inv-other", "inv-other@example.com", "Other"));
    await inviteMember(db, owner, "inv-viewer@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("inv-viewer", "inv-viewer@example.com", "Viewer"));
    const hit = parseGrantsHit({
      id: "363546",
      number: "HRSA-27-072",
      title: "Women's Initiative for Screening and Health (WISH)",
      agency: "Health Resources and Services Administration",
      closeDate: "01/08/2027",
    });
    if (!hit) throw new Error("hit missing");
    await saveParsedOpportunity(db, "production", hit, new Date("2026-11-09T07:55:00Z"));
    const [row] = await db.select().from(opportunities).where(eq(opportunities.sourceId, "363546"));
    if (!row) throw new Error("row missing");

    const before = await invoiceWorkspace(db, owner, row.id);
    expect(before?.awardedCents).toBeNull();
    expect(before?.invoicedCents).toBeNull();
    expect(before?.collectedCents).toBeNull();
    expect(before).not.toHaveProperty("profit");
    await expect(addInvoice(db, owner, row.id, { number: "INV-1", amount: "100" })).rejects.toMatchObject({ code: "invoice-award" });
    expect(await db.select().from(invoices)).toEqual([]);

    await saveAward(db, owner, row.id, { amount: "2500", awardedOn: "2026-11-01", source: "Typed award letter" });
    await expect(addInvoice(db, owner, row.id, { number: "  ", amount: "1000" })).rejects.toMatchObject({ code: "invoice-incomplete" });
    await expect(addInvoice(db, owner, row.id, { number: "INV-1", amount: "" })).rejects.toMatchObject({ code: "invoice-incomplete" });
    await expect(addInvoice(db, owner, row.id, { number: "INV-1", amount: "12.555" })).rejects.toMatchObject({ code: "invoice-invalid" });
    await expect(addInvoice(db, owner, row.id, { number: "INV-1", amount: "2500.01" })).rejects.toMatchObject({ code: "invoice-over" });
    expect(await db.select().from(invoices)).toEqual([]);

    await expect(addInvoice(db, viewer, row.id, { number: "INV-1", amount: "1000" })).rejects.toBeInstanceOf(AppError);
    await addInvoice(db, owner, row.id, { number: "INV-1", amount: "1000" });
    const unpaid = await invoiceWorkspace(db, owner, row.id);
    expect(unpaid?.awardedCents).toBe(250000);
    expect(unpaid?.invoicedCents).toBe(100000);
    expect(unpaid?.collectedCents).toBeNull();
    expect(unpaid?.invoices[0]?.paid).toBe(false);
    expect(unpaid?.invoices[0]?.number).toBe("INV-1");
    const invoiceId = unpaid?.invoices[0]?.id;
    if (!invoiceId) throw new Error("invoice missing");

    await expect(addPayment(db, owner, row.id, { invoiceId, amount: "", paidOn: "2026-11-02" })).rejects.toMatchObject({
      code: "payment-incomplete",
    });
    await expect(addPayment(db, owner, row.id, { invoiceId, amount: "400", paidOn: "" })).rejects.toMatchObject({
      code: "payment-incomplete",
    });
    await expect(addPayment(db, owner, row.id, { invoiceId, amount: "400", paidOn: "2026-02-31" })).rejects.toMatchObject({
      code: "payment-invalid",
    });
    expect(await db.select().from(payments)).toEqual([]);
    expect((await invoiceWorkspace(db, owner, row.id))?.invoices[0]?.paid).toBe(false);

    await addPayment(db, owner, row.id, { invoiceId, amount: "400", paidOn: "2026-11-02" });
    const partial = await invoiceWorkspace(db, owner, row.id);
    expect(partial?.invoices[0]?.paid).toBe(false);
    expect(partial?.collectedCents).toBe(40000);
    expect(partial?.invoicedCents).toBe(100000);
    expect(partial?.awardedCents).toBe(250000);

    await expect(addPayment(db, other, row.id, { invoiceId, amount: "600", paidOn: "2026-11-03" })).rejects.toMatchObject({
      code: "not-found",
    });
    await expect(addPayment(db, viewer, row.id, { invoiceId, amount: "600", paidOn: "2026-11-03" })).rejects.toBeInstanceOf(AppError);
    await addPayment(db, owner, row.id, { invoiceId, amount: "600", paidOn: "2026-11-03" });
    const paid = await invoiceWorkspace(db, owner, row.id);
    expect(paid?.invoices[0]?.paid).toBe(true);
    expect(paid?.invoices[0]?.payments.map((payment) => payment.amountCents)).toEqual([40000, 60000]);
    expect(paid?.collectedCents).toBe(100000);
    expect(paid?.invoicedCents).toBe(100000);
    expect(paid?.awardedCents).toBe(250000);
    expect(paid).not.toHaveProperty("profit");

    const hidden = await invoiceWorkspace(db, other, row.id);
    expect(hidden?.awardedCents).toBeNull();
    expect(hidden?.invoicedCents).toBeNull();
    expect(hidden?.invoices).toEqual([]);
  });
});
