import { and, eq } from "drizzle-orm";
import { AppError, assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import { asDate, isRealIsoDate } from "../dates";
import type { AppDatabase } from "../db/client";
import { organizations, readinessRecords } from "../db/schema";
import { cleanText } from "../text";
import {
  isReadinessCategory,
  isReadinessStatus,
  missingCategories,
  readinessFlags,
  READINESS_LIMIT,
  type ReadinessCategory,
  type ReadinessFlag,
  type ReadinessStatus,
} from "./model";

export type ReadinessInput = {
  category: string;
  label: string;
  recordedValue: string;
  status: string;
  source: string;
  verifiedOn: string;
  expiresOn: string;
  responsiblePerson: string;
};

export type ReadinessRow = {
  id: string;
  category: ReadinessCategory;
  label: string | null;
  recordedValue: string | null;
  status: ReadinessStatus | null;
  source: string | null;
  verifiedOn: string | null;
  expiresOn: string | null;
  responsiblePerson: string | null;
  updatedAt: Date;
  flags: ReadinessFlag[];
};

function dateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const iso = value.slice(0, 10);
    return isRealIsoDate(iso) ? iso : null;
  }
  return null;
}

function normalize(input: ReadinessInput) {
  if (!isReadinessCategory(input.category)) {
    throw new AppError("readiness-invalid", "Choose a readiness category.", 400);
  }
  const status = input.status.trim();
  if (status !== "" && !isReadinessStatus(status)) {
    throw new AppError("readiness-invalid", "That status is not recognized.", 400);
  }
  const verifiedOn = input.verifiedOn.trim();
  const expiresOn = input.expiresOn.trim();
  if ((verifiedOn !== "" && !isRealIsoDate(verifiedOn)) || (expiresOn !== "" && !isRealIsoDate(expiresOn))) {
    throw new AppError("readiness-invalid", "Dates must be blank or a real calendar date.", 400);
  }
  return {
    category: input.category,
    label: cleanText(input.label, 200),
    recordedValue: cleanText(input.recordedValue, 2000),
    status: status === "" ? null : status,
    source: cleanText(input.source, 200),
    verifiedOn: verifiedOn === "" ? null : verifiedOn,
    expiresOn: expiresOn === "" ? null : expiresOn,
    responsiblePerson: cleanText(input.responsiblePerson, 120),
  };
}

export async function listReadiness(
  db: AppDatabase,
  principal: Principal,
  today: string,
): Promise<{ records: ReadinessRow[]; missing: ReadinessCategory[] }> {
  const rows = await db
    .select({
      id: readinessRecords.id,
      category: readinessRecords.category,
      label: readinessRecords.label,
      recordedValue: readinessRecords.recordedValue,
      status: readinessRecords.status,
      source: readinessRecords.source,
      verifiedOn: readinessRecords.verifiedOn,
      expiresOn: readinessRecords.expiresOn,
      responsiblePerson: readinessRecords.responsiblePerson,
      updatedAt: readinessRecords.updatedAt,
    })
    .from(readinessRecords)
    .innerJoin(organizations, eq(readinessRecords.organizationId, organizations.id))
    .where(and(eq(readinessRecords.organizationId, principal.organizationId), eq(organizations.plane, principal.plane)))
    .orderBy(readinessRecords.category, readinessRecords.updatedAt);
  const records: ReadinessRow[] = [];
  for (const row of rows) {
    if (!isReadinessCategory(row.category)) continue;
    const status = isReadinessStatus(row.status) ? row.status : null;
    const snapshot = {
      category: row.category,
      label: row.label,
      recordedValue: row.recordedValue,
      status,
      source: row.source,
      verifiedOn: dateOnly(row.verifiedOn),
      expiresOn: dateOnly(row.expiresOn),
      responsiblePerson: row.responsiblePerson,
    };
    records.push({ ...snapshot, id: row.id, updatedAt: asDate(row.updatedAt), flags: readinessFlags(snapshot, today) });
  }
  return { records, missing: missingCategories(records) };
}

export async function saveReadinessRecord(
  db: AppDatabase,
  principal: Principal,
  input: ReadinessInput,
  id?: string,
): Promise<void> {
  assertRole(principal.role, "member");
  const value = normalize(input);
  const now = new Date();
  if (!id) {
    const existing = await db
      .select({ id: readinessRecords.id })
      .from(readinessRecords)
      .where(eq(readinessRecords.organizationId, principal.organizationId));
    if (existing.length >= READINESS_LIMIT) {
      throw new AppError("readiness-limit", "This organization already has 80 readiness records.", 409);
    }
    await db.insert(readinessRecords).values({
      id: crypto.randomUUID(),
      organizationId: principal.organizationId,
      ...value,
      updatedBy: principal.userId,
      updatedAt: now,
    });
    return;
  }
  const updated = await db
    .update(readinessRecords)
    .set({ ...value, updatedBy: principal.userId, updatedAt: now })
    .where(and(eq(readinessRecords.id, id), eq(readinessRecords.organizationId, principal.organizationId)))
    .returning({ id: readinessRecords.id });
  if (updated.length === 0) throw new AppError("not-found", "That readiness record is not in this organization.", 404);
}

export async function removeReadinessRecord(db: AppDatabase, principal: Principal, id: string): Promise<void> {
  assertRole(principal.role, "member");
  const removed = await db
    .delete(readinessRecords)
    .where(and(eq(readinessRecords.id, id), eq(readinessRecords.organizationId, principal.organizationId)))
    .returning({ id: readinessRecords.id });
  if (removed.length === 0) throw new AppError("not-found", "That readiness record is not in this organization.", 404);
}
