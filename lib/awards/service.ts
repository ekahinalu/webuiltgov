import { and, eq } from "drizzle-orm";
import { AppError, assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import { asDate, isRealIsoDate } from "../dates";
import type { AppDatabase } from "../db/client";
import { awards, fulfillmentItems, fulfillmentProjects } from "../db/schema";
import { getOpportunity } from "../opportunities/detail";
import { cleanText } from "../text";
import {
  ITEM_LIMIT,
  awardAmount,
  awardDate,
  awardSource,
  isItemKind,
  itemDue,
  itemName,
  type ItemKind,
} from "./model";

export type AwardRecord = {
  amountCents: number;
  awardedOn: string;
  source: string;
  enteredBy: string | null;
  enteredByName: string;
  recordedAt: Date;
};

export type FulfillmentItem = {
  id: string;
  kind: ItemKind;
  name: string;
  dueOn: string | null;
  completed: boolean;
  completedByName: string | null;
  completedAt: Date | null;
};

export type AwardWorkspace = {
  opportunityId: string;
  title: string;
  solicitationNumber: string | null;
  award: AwardRecord | null;
  milestones: FulfillmentItem[];
  obligations: FulfillmentItem[];
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

export async function awardWorkspace(db: AppDatabase, principal: Principal, opportunityId: string): Promise<AwardWorkspace | null> {
  const opportunity = await getOpportunity(db, principal, opportunityId);
  if (!opportunity) return null;
  const [award] = await db
    .select({
      amountCents: awards.amountCents,
      awardedOn: awards.awardedOn,
      source: awards.source,
      enteredBy: awards.enteredBy,
      enteredByName: awards.enteredByName,
      recordedAt: awards.recordedAt,
    })
    .from(awards)
    .where(and(eq(awards.organizationId, principal.organizationId), eq(awards.opportunityId, opportunity.id)))
    .limit(1);
  const awardedOn = award ? dateOnly(award.awardedOn) : null;
  const itemRows = award
    ? await db
        .select({
          id: fulfillmentItems.id,
          kind: fulfillmentItems.kind,
          name: fulfillmentItems.name,
          dueOn: fulfillmentItems.dueOn,
          completed: fulfillmentItems.completed,
          completedByName: fulfillmentItems.completedByName,
          completedAt: fulfillmentItems.completedAt,
          createdAt: fulfillmentItems.createdAt,
        })
        .from(fulfillmentItems)
        .where(and(eq(fulfillmentItems.organizationId, principal.organizationId), eq(fulfillmentItems.opportunityId, opportunity.id)))
    : [];
  const items: FulfillmentItem[] = itemRows.flatMap((row) => {
    if (!isItemKind(row.kind)) return [];
    return [{
      id: row.id,
      kind: row.kind,
      name: row.name,
      dueOn: dateOnly(row.dueOn),
      completed: row.completed,
      completedByName: row.completedByName,
      completedAt: row.completedAt ? asDate(row.completedAt) : null,
      createdAt: asDate(row.createdAt).getTime(),
    }];
  }).sort((left, right) => left.createdAt - right.createdAt || left.name.localeCompare(right.name))
    .map(({ createdAt: _createdAt, ...item }) => item);
  return {
    opportunityId: opportunity.id,
    title: opportunity.title,
    solicitationNumber: opportunity.solicitationNumber,
    award: award && awardedOn
      ? {
          amountCents: award.amountCents,
          awardedOn,
          source: award.source,
          enteredBy: award.enteredBy,
          enteredByName: award.enteredByName,
          recordedAt: asDate(award.recordedAt),
        }
      : null,
    milestones: items.filter((item) => item.kind === "milestone"),
    obligations: items.filter((item) => item.kind === "obligation"),
  };
}

export async function saveAward(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  fields: { amount: string; awardedOn: string; source: string },
): Promise<"created" | "updated"> {
  assertRole(principal.role, "member");
  const amount = awardAmount(fields.amount);
  const awardedOn = awardDate(fields.awardedOn);
  const source = awardSource(fields.source);
  if (amount === null || awardedOn === null || !source) {
    throw new AppError("award-incomplete", "Enter an awarded amount, an award date, and a source.", 400);
  }
  if (amount === "invalid" || awardedOn === "invalid") {
    throw new AppError("award-invalid", "Enter a dollar amount and a real award date.", 400);
  }
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const name = cleanText(principal.name, 120) ?? "Member";
  const now = new Date();
  const [existing] = await db
    .select({ opportunityId: awards.opportunityId })
    .from(awards)
    .where(and(eq(awards.organizationId, principal.organizationId), eq(awards.opportunityId, opportunity.id)))
    .limit(1);
  if (!existing) {
    await db.insert(awards).values({
      organizationId: principal.organizationId,
      opportunityId: opportunity.id,
      amountCents: amount,
      awardedOn,
      source,
      enteredBy: principal.userId,
      enteredByName: name,
      recordedAt: now,
    });
    await db.insert(fulfillmentProjects).values({
      organizationId: principal.organizationId,
      opportunityId: opportunity.id,
    });
    return "created";
  }
  await db
    .update(awards)
    .set({
      amountCents: amount,
      awardedOn,
      source,
      enteredBy: principal.userId,
      enteredByName: name,
      recordedAt: now,
    })
    .where(and(eq(awards.organizationId, principal.organizationId), eq(awards.opportunityId, opportunity.id)));
  return "updated";
}

export async function addFulfillmentItem(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  fields: { kind: string; name: string; dueOn: string },
): Promise<void> {
  assertRole(principal.role, "member");
  if (!isItemKind(fields.kind)) throw new AppError("item-invalid", "That fulfillment item is not recognized.", 400);
  const name = itemName(fields.name);
  if (!name) throw new AppError("item-name", "Enter a name for the milestone or obligation.", 400);
  const dueOn = itemDue(fields.dueOn);
  if (dueOn === "invalid") throw new AppError("item-date", "That due date is not a real date.", 400);
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const [project] = await db
    .select({ opportunityId: fulfillmentProjects.opportunityId })
    .from(fulfillmentProjects)
    .where(and(eq(fulfillmentProjects.organizationId, principal.organizationId), eq(fulfillmentProjects.opportunityId, opportunity.id)))
    .limit(1);
  if (!project) throw new AppError("item-award", "Save an award before adding fulfillment work.", 400);
  const existing = await db
    .select({ id: fulfillmentItems.id })
    .from(fulfillmentItems)
    .where(and(eq(fulfillmentItems.organizationId, principal.organizationId), eq(fulfillmentItems.opportunityId, opportunity.id)));
  if (existing.length >= ITEM_LIMIT) throw new AppError("item-limit", "This project already has 80 milestones and obligations.", 400);
  await db.insert(fulfillmentItems).values({
    id: crypto.randomUUID(),
    organizationId: principal.organizationId,
    opportunityId: opportunity.id,
    kind: fields.kind,
    name,
    dueOn,
    completed: false,
    completedBy: null,
    completedByName: null,
    completedAt: null,
    createdBy: principal.userId,
    createdAt: new Date(),
  });
}

export async function setFulfillmentComplete(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  itemId: string,
  completed: boolean,
): Promise<void> {
  assertRole(principal.role, "member");
  const opportunity = await requireOpportunity(db, principal, opportunityId);
  const id = cleanText(itemId, 80);
  if (!id) throw new AppError("not-found", "That fulfillment item is not in this project.", 404);
  const [item] = await db
    .select({ id: fulfillmentItems.id, completed: fulfillmentItems.completed })
    .from(fulfillmentItems)
    .where(and(
      eq(fulfillmentItems.organizationId, principal.organizationId),
      eq(fulfillmentItems.opportunityId, opportunity.id),
      eq(fulfillmentItems.id, id),
    ))
    .limit(1);
  if (!item) throw new AppError("not-found", "That fulfillment item is not in this project.", 404);
  if (completed && !item.completed) {
    await db
      .update(fulfillmentItems)
      .set({
        completed: true,
        completedBy: principal.userId,
        completedByName: cleanText(principal.name, 120) ?? "Member",
        completedAt: new Date(),
      })
      .where(eq(fulfillmentItems.id, item.id));
    return;
  }
  if (!completed && item.completed) {
    await db
      .update(fulfillmentItems)
      .set({ completed: false, completedBy: null, completedByName: null, completedAt: null })
      .where(eq(fulfillmentItems.id, item.id));
  }
}
