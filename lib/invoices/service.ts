import { and, eq } from "drizzle-orm";
import { AppError, assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import { asDate, isRealIsoDate } from "../dates";
import type { AppDatabase } from "../db/client";
import { awards, invoices, payments } from "../db/schema";
import { getOpportunity } from "../opportunities/detail";
import { cleanText } from "../text";
import {
  INVOICE_LIMIT,
  PAYMENT_LIMIT,
  invoiceAmount,
  invoiceIsPaid,
  invoiceNumber,
  paymentDate,
  sumCents,
} from "./model";

export type PaymentRecord = {
  id: string;
  amountCents: number;
  paidOn: string;
  enteredByName: string;
};

export type InvoiceRecord = {
  id: string;
  number: string;
  amountCents: number;
  paid: boolean;
  payments: PaymentRecord[];
};

export type InvoiceWorkspace = {
  opportunityId: string;
  title: string;
  solicitationNumber: string | null;
  awardedCents: number | null;
  invoicedCents: number | null;
  collectedCents: number | null;
  invoices: InvoiceRecord[];
};

function dateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = value.toISOString().slice(0, 10);
    return isRealIsoDate(iso) ? iso : null;
  }
  if (typeof value === "string") {
    const iso = value.slice(0, 10);
    return isRealIsoDate(iso) ? iso : null;
  }
  return null;
}

async function requireOpportunity(db: AppDatabase, principal: Principal, opportunityId: string) {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) throw new AppError("not-found", "That record is not in this catalog.", 404);
  return opportunity;
}

export async function invoiceWorkspace(db: AppDatabase, principal: Principal, opportunityId: string): Promise<InvoiceWorkspace | null> {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) return null;
  const [award] = await db
    .select({ amountCents: awards.amountCents })
    .from(awards)
    .where(and(eq(awards.organizationId, principal.organizationId), eq(awards.opportunityId, opportunity.id)))
    .limit(1);
  const invoiceRows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      amountCents: invoices.amountCents,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, principal.organizationId), eq(invoices.opportunityId, opportunity.id)));
  const paymentRows = invoiceRows.length === 0
    ? []
    : await db
        .select({
          id: payments.id,
          invoiceId: payments.invoiceId,
          amountCents: payments.amountCents,
          paidOn: payments.paidOn,
          enteredByName: payments.enteredByName,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .innerJoin(invoices, and(eq(payments.invoiceId, invoices.id), eq(payments.organizationId, invoices.organizationId)))
        .where(and(eq(payments.organizationId, principal.organizationId), eq(invoices.opportunityId, opportunity.id)));
  const listed = invoiceRows
    .map((invoice) => {
      const invoicePayments = paymentRows
        .filter((payment) => payment.invoiceId === invoice.id)
        .map((payment) => ({
          id: payment.id,
          amountCents: payment.amountCents,
          paidOn: dateOnly(payment.paidOn) ?? "",
          enteredByName: payment.enteredByName,
          createdAt: asDate(payment.createdAt).getTime(),
        }))
        .sort((left, right) => left.paidOn.localeCompare(right.paidOn) || left.createdAt - right.createdAt);
      return {
        id: invoice.id,
        number: invoice.number,
        amountCents: invoice.amountCents,
        paid: invoiceIsPaid(invoice.amountCents, invoicePayments.map((payment) => payment.amountCents)),
        payments: invoicePayments.map(({ createdAt: _createdAt, ...payment }) => payment),
        createdAt: asDate(invoice.createdAt).getTime(),
      };
    })
    .sort((left, right) => left.createdAt - right.createdAt || left.number.localeCompare(right.number));
  const paymentCents = listed.flatMap((invoice) => invoice.payments.map((payment) => payment.amountCents));
  return {
    opportunityId: opportunity.id,
    title: opportunity.title,
    solicitationNumber: opportunity.solicitationNumber,
    awardedCents: award ? award.amountCents : null,
    invoicedCents: sumCents(listed.map((invoice) => invoice.amountCents)),
    collectedCents: sumCents(paymentCents),
    invoices: listed.map(({ createdAt: _createdAt, ...invoice }) => invoice),
  };
}

export async function addInvoice(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  fields: { number: string; amount: string },
): Promise<void> {
  assertRole(principal.role, "member");
  const number = invoiceNumber(fields.number);
  const amount = invoiceAmount(fields.amount);
  if (!number || amount === null) throw new AppError("invoice-incomplete", "Enter an invoice number and an amount.", 400);
  if (amount === "invalid") throw new AppError("invoice-invalid", "Enter an amount in dollars with up to two decimals.", 400);
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const [award] = await db
    .select({ amountCents: awards.amountCents })
    .from(awards)
    .where(and(eq(awards.organizationId, principal.organizationId), eq(awards.opportunityId, opportunity.id)))
    .limit(1);
  if (!award) throw new AppError("invoice-award", "Save an award before adding an invoice.", 400);
  if (amount > award.amountCents) throw new AppError("invoice-over", "That amount is above the awarded amount already stored.", 400);
  const existing = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.organizationId, principal.organizationId), eq(invoices.opportunityId, opportunity.id)));
  if (existing.length >= INVOICE_LIMIT) throw new AppError("invoice-limit", "This award already has 80 invoices.", 400);
  await db.insert(invoices).values({
    id: crypto.randomUUID(),
    organizationId: principal.organizationId,
    opportunityId: opportunity.id,
    number,
    amountCents: amount,
    enteredBy: principal.userId,
    enteredByName: cleanText(principal.name, 120) ?? "Member",
    createdAt: new Date(),
  });
}

export async function addPayment(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  fields: { invoiceId: string; amount: string; paidOn: string },
): Promise<void> {
  assertRole(principal.role, "member");
  const amount = invoiceAmount(fields.amount);
  const paidOn = paymentDate(fields.paidOn);
  if (amount === null || paidOn === null) throw new AppError("payment-incomplete", "Enter a payment amount and a date.", 400);
  if (amount === "invalid" || paidOn === "invalid") {
    throw new AppError("payment-invalid", "Enter a dollar amount and a real payment date.", 400);
  }
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const invoiceId = cleanText(fields.invoiceId, 80);
  if (!invoiceId) throw new AppError("not-found", "That invoice is not in this organization.", 404);
  const [invoice] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(
      eq(invoices.organizationId, principal.organizationId),
      eq(invoices.opportunityId, opportunity.id),
      eq(invoices.id, invoiceId),
    ))
    .limit(1);
  if (!invoice) throw new AppError("not-found", "That invoice is not in this organization.", 404);
  const existing = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.organizationId, principal.organizationId), eq(payments.invoiceId, invoice.id)));
  if (existing.length >= PAYMENT_LIMIT) throw new AppError("payment-limit", "That invoice already has 80 payments.", 400);
  await db.insert(payments).values({
    id: crypto.randomUUID(),
    organizationId: principal.organizationId,
    invoiceId: invoice.id,
    amountCents: amount,
    paidOn,
    enteredBy: principal.userId,
    enteredByName: cleanText(principal.name, 120) ?? "Member",
    createdAt: new Date(),
  });
}
