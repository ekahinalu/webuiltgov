export const PLANES = ["production", "preview"] as const;
export type Plane = (typeof PLANES)[number];

export const SOURCES = ["grants.gov", "sam.gov"] as const;
export type SourceName = (typeof SOURCES)[number];

export const RECORD_KINDS = ["grant_opportunity", "contract_notice", "award_notice"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const GOVERNMENT_LEVELS = ["federal", "state", "local", "tribal"] as const;
export type GovernmentLevel = (typeof GOVERNMENT_LEVELS)[number];

export type SourceFacts = {
  agencyCode?: string;
  openDate?: string;
  oppStatus?: string;
  docType?: string;
  cfdaNumbers?: string[];
  sourceUpdated?: string;
  governmentLevelBasis?: string;
  department?: string;
  organizationPath?: string;
  subTier?: string;
  noticeType?: string;
  descriptionUrl?: string;
  detailAttemptAt?: string;
};

export type FieldCoverage = {
  description: boolean;
  naics: boolean;
  location: boolean;
};

export type ParsedOpportunity = {
  source: SourceName;
  sourceId: string;
  sourceUrl: string | null;
  agency: string | null;
  solicitationNumber: string | null;
  title: string;
  description: string | null;
  governmentLevel: GovernmentLevel | null;
  location: string | null;
  naics: string | null;
  deadline: string | null;
  deadlineRaw: string | null;
  recordKind: RecordKind;
  sourceFacts: SourceFacts;
  coverage: FieldCoverage;
};

export const SOURCE_LABEL: Record<SourceName, string> = {
  "grants.gov": "Grants.gov",
  "sam.gov": "SAM.gov",
};

export const KIND_LABEL: Record<RecordKind, string> = {
  grant_opportunity: "Grant opportunity",
  contract_notice: "Contract notice",
  award_notice: "Award notice",
};

export const LEVEL_LABEL: Record<GovernmentLevel, string> = {
  federal: "Federal",
  state: "State",
  local: "Local",
  tribal: "Tribal",
};

export const PIPELINE_LABEL = {
  unreviewed: "Unreviewed",
  reviewing: "Reviewing",
  pursuing: "Pursuing",
  passed: "Passed",
} as const;

export const ROLE_LABEL = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
} as const;

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
export const SYNC_COOLDOWN_MS = 20 * 1000;
export const USER_AGENT = "WeBuiltGov/0.1 (government opportunity search)";

export function isPlane(value: unknown): value is Plane {
  return value === "production" || value === "preview";
}

export function isRecordKind(value: unknown): value is RecordKind {
  return typeof value === "string" && (RECORD_KINDS as readonly string[]).includes(value);
}

export function isGovernmentLevel(value: unknown): value is GovernmentLevel {
  return typeof value === "string" && (GOVERNMENT_LEVELS as readonly string[]).includes(value);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
