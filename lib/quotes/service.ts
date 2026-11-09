import { and, eq } from "drizzle-orm";
import { AppError, assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import { bidWorkspace } from "../bids/service";
import type { AppDatabase } from "../db/client";
import { quotes, vendors } from "../db/schema";
import { getOpportunity } from "../opportunities/detail";
import { cleanText } from "../text";
import {
  QUOTE_LIMIT,
  VENDOR_LIMIT,
  compareQuotes,
  comparisonSummary,
  quoteAmount,
  quoteCovers,
  vendorName,
  vendorTrade,
  type QuoteComparison,
} from "./model";

export type VendorRecord = {
  id: string;
  name: string;
  trade: string | null;
};

export type QuoteWorkspace = {
  opportunityId: string;
  bidOpen: boolean;
  vendors: VendorRecord[];
  quotes: QuoteComparison[];
  summary: string;
};

async function requireOpenBid(db: AppDatabase, principal: Principal, opportunityId: string) {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) throw new AppError("not-found", "That record is not in this catalog.", 404);
  const workspace = await bidWorkspace(db, principal, opportunity.id);
  if (!workspace?.bid) throw new AppError("quote-bid", "Open a bid before adding a vendor or quote.", 400);
  return opportunity;
}

export async function quoteWorkspace(db: AppDatabase, principal: Principal, opportunityId: string): Promise<QuoteWorkspace | null> {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) return null;
  const workspace = await bidWorkspace(db, principal, opportunity.id);
  if (!workspace?.bid) {
    return { opportunityId: opportunity.id, bidOpen: false, vendors: [], quotes: [], summary: "No quotes are entered for this bid." };
  }
  const vendorRows = await db
    .select({ id: vendors.id, name: vendors.name, trade: vendors.trade })
    .from(vendors)
    .where(eq(vendors.organizationId, principal.organizationId));
  const quoteRows = await db
    .select({
      id: quotes.id,
      vendorName: vendors.name,
      trade: vendors.trade,
      amountCents: quotes.amountCents,
      covers: quotes.covers,
    })
    .from(quotes)
    .innerJoin(vendors, and(eq(quotes.vendorId, vendors.id), eq(quotes.organizationId, vendors.organizationId)))
    .where(and(eq(quotes.organizationId, principal.organizationId), eq(quotes.opportunityId, opportunity.id)));
  const compared = compareQuotes(quoteRows.map((row) => ({
    id: row.id,
    vendorName: row.vendorName,
    trade: row.trade,
    amountCents: row.amountCents,
    covers: row.covers,
  })));
  const listed = vendorRows
    .map((row) => ({ id: row.id, name: row.name, trade: row.trade }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  return {
    opportunityId: opportunity.id,
    bidOpen: true,
    vendors: listed,
    quotes: compared,
    summary: comparisonSummary(compared),
  };
}

export async function addVendor(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  fields: { name: string; trade: string },
): Promise<void> {
  assertRole(principal.role, "member");
  const name = vendorName(fields.name);
  if (!name) throw new AppError("vendor-name", "Enter a vendor name.", 400);
  await requireOpenBid(db, principal, opportunityId);
  const existing = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.organizationId, principal.organizationId));
  if (existing.length >= VENDOR_LIMIT) throw new AppError("vendor-limit", "This organization already has 80 vendors.", 400);
  await db.insert(vendors).values({
    id: crypto.randomUUID(),
    organizationId: principal.organizationId,
    name,
    trade: vendorTrade(fields.trade),
    createdBy: principal.userId,
    createdAt: new Date(),
  });
}

export async function addQuote(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  fields: { vendorId: string; amount: string; covers: string },
): Promise<void> {
  assertRole(principal.role, "member");
  const amount = quoteAmount(fields.amount);
  if (amount === null) throw new AppError("quote-amount", "Enter a quote amount.", 400);
  if (amount === "invalid") throw new AppError("quote-invalid", "Enter a quote amount in dollars with up to two decimals.", 400);
  const covers = quoteCovers(fields.covers);
  if (!covers) throw new AppError("quote-covers", "Enter what the quote covers.", 400);
  const opportunity = await requireOpenBid(db, principal, opportunityId);
  const vendorId = cleanText(fields.vendorId, 80);
  if (!vendorId) throw new AppError("quote-vendor", "Choose a vendor saved in this organization.", 400);
  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(and(eq(vendors.organizationId, principal.organizationId), eq(vendors.id, vendorId)))
    .limit(1);
  if (!vendor) throw new AppError("quote-vendor", "Choose a vendor saved in this organization.", 400);
  const existing = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(and(eq(quotes.organizationId, principal.organizationId), eq(quotes.opportunityId, opportunity.id)));
  if (existing.length >= QUOTE_LIMIT) throw new AppError("quote-limit", "This bid already has 80 quotes.", 400);
  await db.insert(quotes).values({
    id: crypto.randomUUID(),
    organizationId: principal.organizationId,
    opportunityId: opportunity.id,
    vendorId: vendor.id,
    amountCents: amount,
    covers,
    createdBy: principal.userId,
    createdAt: new Date(),
  });
}
