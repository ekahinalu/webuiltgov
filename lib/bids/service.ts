import { and, eq } from "drizzle-orm";
import { AppError, assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import { asDate } from "../dates";
import type { AppDatabase } from "../db/client";
import { bids, opportunities } from "../db/schema";
import { getOpportunity } from "../opportunities/detail";
import { cleanText } from "../text";
import {
  amountsEqual,
  columnTotal,
  emptyEstimate,
  fieldName,
  isBidStage,
  parseMoney,
  readAmounts,
  type BidStage,
  type ColumnTotal,
  type EstimateAmounts,
  type MoneyColumn,
} from "./model";

export type BidRecord = {
  stage: BidStage;
  amounts: EstimateAmounts;
  proposedPrice: number | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  totals: Record<MoneyColumn, ColumnTotal>;
  priceState: "none" | "draft" | "approved";
};

export type BidWorkspace = {
  opportunityId: string;
  title: string;
  solicitationNumber: string | null;
  pipelineStatus: string | null;
  bid: BidRecord | null;
};

function asCents(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "bigint") {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : null;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : null;
  }
  return null;
}

function totalsFor(amounts: EstimateAmounts): Record<MoneyColumn, ColumnTotal> {
  return {
    low: columnTotal(amounts, "low"),
    expected: columnTotal(amounts, "expected"),
    high: columnTotal(amounts, "high"),
  };
}

function priceState(proposedPrice: number | null, approvedAt: Date | null): BidRecord["priceState"] {
  if (proposedPrice === null) return "none";
  return approvedAt ? "approved" : "draft";
}

async function loadBid(db: AppDatabase, principal: Principal, opportunityId: string) {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) return null;
  const [row] = await db
    .select({
      stage: bids.stage,
      laborLow: bids.laborLow,
      laborExpected: bids.laborExpected,
      laborHigh: bids.laborHigh,
      materialsLow: bids.materialsLow,
      materialsExpected: bids.materialsExpected,
      materialsHigh: bids.materialsHigh,
      equipmentLow: bids.equipmentLow,
      equipmentExpected: bids.equipmentExpected,
      equipmentHigh: bids.equipmentHigh,
      subcontractorsLow: bids.subcontractorsLow,
      subcontractorsExpected: bids.subcontractorsExpected,
      subcontractorsHigh: bids.subcontractorsHigh,
      overheadLow: bids.overheadLow,
      overheadExpected: bids.overheadExpected,
      overheadHigh: bids.overheadHigh,
      contingencyLow: bids.contingencyLow,
      contingencyExpected: bids.contingencyExpected,
      contingencyHigh: bids.contingencyHigh,
      profitLow: bids.profitLow,
      profitExpected: bids.profitExpected,
      profitHigh: bids.profitHigh,
      proposedPrice: bids.proposedPrice,
      approvedBy: bids.approvedBy,
      approvedByName: bids.approvedByName,
      approvedAt: bids.approvedAt,
    })
    .from(bids)
    .innerJoin(opportunities, eq(bids.opportunityId, opportunities.id))
    .where(
      and(
        eq(bids.organizationId, principal.organizationId),
        eq(bids.opportunityId, opportunity.id),
        eq(opportunities.plane, principal.plane),
      ),
    )
    .limit(1);
  return { opportunity, row: row ?? null };
}

function toRecord(row: NonNullable<Awaited<ReturnType<typeof loadBid>>>["row"]): BidRecord | null {
  if (!row || !isBidStage(row.stage)) return null;
  const amounts = emptyEstimate();
  const source = row as unknown as Record<string, unknown>;
  for (const line of Object.keys(amounts) as (keyof EstimateAmounts)[]) {
    amounts[line] = {
      low: asCents(source[fieldName(line, "low")]),
      expected: asCents(source[fieldName(line, "expected")]),
      high: asCents(source[fieldName(line, "high")]),
    };
  }
  const proposedPrice = asCents(row.proposedPrice);
  const approvedAt = row.approvedAt ? asDate(row.approvedAt) : null;
  return {
    stage: row.stage,
    amounts,
    proposedPrice,
    approvedBy: row.approvedBy,
    approvedByName: row.approvedByName,
    approvedAt,
    totals: totalsFor(amounts),
    priceState: priceState(proposedPrice, approvedAt),
  };
}

export async function bidWorkspace(db: AppDatabase, principal: Principal, opportunityId: string): Promise<BidWorkspace | null> {
  const loaded = await loadBid(db, principal, opportunityId);
  if (!loaded) return null;
  return {
    opportunityId: loaded.opportunity.id,
    title: loaded.opportunity.title,
    solicitationNumber: loaded.opportunity.solicitationNumber,
    pipelineStatus: loaded.opportunity.pipelineStatus,
    bid: toRecord(loaded.row),
  };
}

export async function openBid(db: AppDatabase, principal: Principal, opportunityId: string): Promise<void> {
  assertRole(principal.role, "member");
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) throw new AppError("not-found", "That record is not in this catalog.", 404);
  await db
    .insert(bids)
    .values({
      organizationId: principal.organizationId,
      opportunityId: opportunity.id,
      stage: "identified",
      updatedBy: principal.userId,
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
}

export async function setBidStage(db: AppDatabase, principal: Principal, opportunityId: string, stage: string): Promise<void> {
  assertRole(principal.role, "member");
  if (!isBidStage(stage)) throw new AppError("bid-invalid", "That bid stage is not recognized.", 400);
  const loaded = await loadBid(db, principal, opportunityId);
  if (!loaded?.row) throw new AppError("not-found", "Open a bid before setting its stage.", 404);
  await db
    .update(bids)
    .set({ stage, updatedBy: principal.userId, updatedAt: new Date() })
    .where(and(eq(bids.organizationId, principal.organizationId), eq(bids.opportunityId, loaded.opportunity.id)));
}

export async function saveBidEstimate(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  fields: Record<string, string>,
): Promise<void> {
  assertRole(principal.role, "member");
  const loaded = await loadBid(db, principal, opportunityId);
  if (!loaded?.row) throw new AppError("not-found", "Open a bid before entering an estimate.", 404);
  const amounts = readAmounts(fields);
  if (amounts === "invalid") throw new AppError("bid-invalid", "Enter blank amounts or dollars with up to two decimals.", 400);
  const proposed = parseMoney(fields.proposedPrice ?? "");
  if (proposed === "invalid") throw new AppError("bid-invalid", "Enter blank amounts or dollars with up to two decimals.", 400);
  const current = toRecord(loaded.row);
  const changed = !current || !amountsEqual(current.amounts, amounts) || current.proposedPrice !== proposed;
  await db
    .update(bids)
    .set({
      laborLow: amounts.labor.low,
      laborExpected: amounts.labor.expected,
      laborHigh: amounts.labor.high,
      materialsLow: amounts.materials.low,
      materialsExpected: amounts.materials.expected,
      materialsHigh: amounts.materials.high,
      equipmentLow: amounts.equipment.low,
      equipmentExpected: amounts.equipment.expected,
      equipmentHigh: amounts.equipment.high,
      subcontractorsLow: amounts.subcontractors.low,
      subcontractorsExpected: amounts.subcontractors.expected,
      subcontractorsHigh: amounts.subcontractors.high,
      overheadLow: amounts.overhead.low,
      overheadExpected: amounts.overhead.expected,
      overheadHigh: amounts.overhead.high,
      contingencyLow: amounts.contingency.low,
      contingencyExpected: amounts.contingency.expected,
      contingencyHigh: amounts.contingency.high,
      profitLow: amounts.profit.low,
      profitExpected: amounts.profit.expected,
      profitHigh: amounts.profit.high,
      proposedPrice: proposed,
      approvedBy: changed ? null : loaded.row.approvedBy,
      approvedByName: changed ? null : loaded.row.approvedByName,
      approvedAt: changed ? null : loaded.row.approvedAt,
      updatedBy: principal.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(bids.organizationId, principal.organizationId), eq(bids.opportunityId, loaded.opportunity.id)));
}

export async function approveBidPrice(db: AppDatabase, principal: Principal, opportunityId: string): Promise<void> {
  assertRole(principal.role, "member");
  const loaded = await loadBid(db, principal, opportunityId);
  if (!loaded?.row) throw new AppError("not-found", "Open a bid before approving a price.", 404);
  const current = toRecord(loaded.row);
  if (!current || current.proposedPrice === null) throw new AppError("bid-price", "Enter a proposed price before approving it.", 400);
  const name = cleanText(principal.name, 120) ?? "Member";
  await db
    .update(bids)
    .set({
      approvedBy: principal.userId,
      approvedByName: name,
      approvedAt: new Date(),
      updatedBy: principal.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(bids.organizationId, principal.organizationId), eq(bids.opportunityId, loaded.opportunity.id)));
}
