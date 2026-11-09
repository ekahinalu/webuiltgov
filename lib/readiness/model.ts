import { addIsoDays, isRealIsoDate } from "../dates";

export const READINESS_CATEGORIES = [
  "legal_business",
  "registration",
  "license",
  "certification",
  "insurance",
  "bonding",
] as const;

export type ReadinessCategory = (typeof READINESS_CATEGORIES)[number];

export const READINESS_STATUSES = ["active", "expired", "pending", "inactive"] as const;
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export const CATEGORY_LABEL: Record<ReadinessCategory, string> = {
  legal_business: "Legal business",
  registration: "Registrations",
  license: "Licenses",
  certification: "Certifications",
  insurance: "Insurance",
  bonding: "Bonding",
};

export const STATUS_LABEL: Record<ReadinessStatus, string> = {
  active: "Active",
  expired: "Expired",
  pending: "Pending",
  inactive: "Inactive",
};

export const EXPIRING_WITHIN_DAYS = 30;
export const READINESS_LIMIT = 80;

export type ReadinessFlag =
  | "label missing"
  | "value missing"
  | "status missing"
  | "source missing"
  | "verification date missing"
  | "expiration missing"
  | "expired"
  | "expiring"
  | "responsible person missing";

export type ReadinessSnapshot = {
  category: ReadinessCategory;
  label: string | null;
  recordedValue: string | null;
  status: ReadinessStatus | null;
  source: string | null;
  verifiedOn: string | null;
  expiresOn: string | null;
  responsiblePerson: string | null;
};

export function isReadinessCategory(value: unknown): value is ReadinessCategory {
  return typeof value === "string" && (READINESS_CATEGORIES as readonly string[]).includes(value);
}

export function isReadinessStatus(value: unknown): value is ReadinessStatus {
  return typeof value === "string" && (READINESS_STATUSES as readonly string[]).includes(value);
}

export function readinessFlags(record: ReadinessSnapshot, today: string): ReadinessFlag[] {
  const flags: ReadinessFlag[] = [];
  if (!record.label) flags.push("label missing");
  if (!record.recordedValue) flags.push("value missing");
  if (!record.status) flags.push("status missing");
  if (!record.source) flags.push("source missing");
  if (!record.verifiedOn) flags.push("verification date missing");
  if (!record.expiresOn) flags.push("expiration missing");
  else if (record.expiresOn < today) flags.push("expired");
  else if (record.expiresOn <= addIsoDays(today, EXPIRING_WITHIN_DAYS)) flags.push("expiring");
  if (!record.responsiblePerson) flags.push("responsible person missing");
  return flags;
}

export function missingCategories(records: { category: ReadinessCategory }[]): ReadinessCategory[] {
  const present = new Set(records.map((record) => record.category));
  return READINESS_CATEGORIES.filter((category) => !present.has(category));
}
