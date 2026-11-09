import type { Disposition } from "../eligibility/model";
import { CATEGORY_LABEL, READINESS_CATEGORIES, type ReadinessCategory, type ReadinessFlag } from "../readiness/model";

export const RECOMMENDATIONS = [
  "strong_pursuit",
  "potential",
  "needs_information",
  "partner_required",
  "high_risk",
  "poor_fit",
  "no_bid",
] as const;

export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  strong_pursuit: "Strong pursuit",
  potential: "Potential",
  needs_information: "Needs information",
  partner_required: "Partner required",
  high_risk: "High risk",
  poor_fit: "Poor fit",
  no_bid: "No-bid",
};

export const SUGGESTION_RULES = {
  unsatisfied: "At least one stored eligibility mark is unsatisfied.",
  notLoaded: "Applicant types are not stored on this record.",
  noneListed: "The stored detail listed no applicant types.",
  unmarked: "At least one applicant type is unmarked or marked needs verification.",
  readinessGaps: "Stored readiness has a missing category or a blank field.",
  expired: "A stored readiness record has an expiration date in the past.",
  potential: "A stored mark is potentially correctable, or a stored record expires within 30 days.",
  strong:
    "Every stored applicant type is satisfied or not applicable, at least one is satisfied, and stored readiness has no missing or expiring fields.",
  fallback: "The stored fields do not support a stronger suggestion.",
} as const;

const BLANK_FLAGS = new Set<ReadinessFlag>([
  "label missing",
  "value missing",
  "status missing",
  "source missing",
  "verification date missing",
  "expiration missing",
  "responsible person missing",
]);

export type Suggestion = {
  recommendation: Recommendation;
  rule: string;
};

export type FitLine = {
  text: string;
  sourceLabel: string;
  disposition: Disposition | null;
};

export type FitRecord = {
  category: ReadinessCategory;
  label: string | null;
  recordedValue: string | null;
  status: string | null;
  source: string | null;
  verifiedOn: string | null;
  expiresOn: string | null;
  responsiblePerson: string | null;
  flags: ReadinessFlag[];
};

export type FitInput = {
  eligibilityLoaded: boolean;
  lines: FitLine[];
  missingCategories: ReadinessCategory[];
  records: FitRecord[];
};

export function isRecommendation(value: unknown): value is Recommendation {
  return typeof value === "string" && (RECOMMENDATIONS as readonly string[]).includes(value);
}

export function suggestFromStored(input: FitInput): Suggestion {
  if (input.lines.some((line) => line.disposition === "unsatisfied")) {
    return { recommendation: "poor_fit", rule: SUGGESTION_RULES.unsatisfied };
  }
  if (!input.eligibilityLoaded) return { recommendation: "needs_information", rule: SUGGESTION_RULES.notLoaded };
  if (input.lines.length === 0) return { recommendation: "needs_information", rule: SUGGESTION_RULES.noneListed };
  if (input.lines.some((line) => line.disposition === null || line.disposition === "needs_verification")) {
    return { recommendation: "needs_information", rule: SUGGESTION_RULES.unmarked };
  }
  const blank = input.records.some((record) => record.flags.some((flag) => BLANK_FLAGS.has(flag)));
  if (input.missingCategories.length > 0 || blank) {
    return { recommendation: "needs_information", rule: SUGGESTION_RULES.readinessGaps };
  }
  if (input.records.some((record) => record.flags.includes("expired"))) {
    return { recommendation: "high_risk", rule: SUGGESTION_RULES.expired };
  }
  if (input.lines.some((line) => line.disposition === "potentially_correctable") || input.records.some((record) => record.flags.includes("expiring"))) {
    return { recommendation: "potential", rule: SUGGESTION_RULES.potential };
  }
  const satisfied = input.lines.some((line) => line.disposition === "satisfied");
  const covered = input.lines.every((line) => line.disposition === "satisfied" || line.disposition === "not_applicable");
  const coveredCategories = READINESS_CATEGORIES.every((category) => input.records.some((record) => record.category === category));
  if (satisfied && covered && coveredCategories) return { recommendation: "strong_pursuit", rule: SUGGESTION_RULES.strong };
  return { recommendation: "needs_information", rule: SUGGESTION_RULES.fallback };
}

export function captureGaps(input: FitInput & { agency: string | null; notice: string | null; deadline: string | null }): string[] {
  const gaps: string[] = [];
  if (!input.agency) gaps.push("Agency was not stored.");
  if (!input.notice) gaps.push("The notice text was not stored.");
  if (!input.deadline) gaps.push("Deadline was not stored.");
  if (!input.eligibilityLoaded) gaps.push("Applicant types are not stored on this record.");
  else if (input.lines.length === 0) gaps.push("The stored detail listed no applicant types.");
  for (const line of input.lines) {
    if (line.disposition === null) gaps.push(`Applicant type "${line.text}" is not marked.`);
    else if (line.disposition === "unsatisfied") gaps.push(`Applicant type "${line.text}" is marked unsatisfied.`);
    else if (line.disposition === "needs_verification") gaps.push(`Applicant type "${line.text}" is marked needs verification.`);
    else if (line.disposition === "potentially_correctable") gaps.push(`Applicant type "${line.text}" is marked potentially correctable.`);
  }
  for (const category of input.missingCategories) gaps.push(`No ${CATEGORY_LABEL[category].toLowerCase()} record is stored.`);
  for (const record of input.records) {
    if (record.flags.length === 0) continue;
    const name = record.label?.trim() ? record.label : "record";
    gaps.push(`${CATEGORY_LABEL[record.category]} ${name}: ${record.flags.join(", ")}.`);
  }
  return gaps;
}

const NOTICE_PACKET_LIMIT = 6000;

export function storedPursuitPacket(input: {
  title: string;
  solicitationNumber: string | null;
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  agency: string | null;
  notice: string | null;
  deadline: string | null;
  deadlineRaw: string | null;
  costSharing: boolean | null;
  fit: FitInput;
  suggestion: Suggestion;
  gaps: string[];
}): Record<string, unknown> {
  const notice = input.notice ?? null;
  const truncated = notice !== null && notice.length > NOTICE_PACKET_LIMIT;
  return {
    title: input.title,
    solicitationNumber: input.solicitationNumber,
    source: input.source,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    agency: input.agency,
    noticeText: truncated ? notice.slice(0, NOTICE_PACKET_LIMIT) : notice,
    noticeTruncated: truncated,
    noticeStoredLength: notice?.length ?? 0,
    deadline: input.deadline,
    deadlineRaw: input.deadlineRaw,
    costSharing: input.costSharing,
    eligibilityLoaded: input.fit.eligibilityLoaded,
    eligibility: input.fit.lines.map((line) => ({
      text: line.text,
      sourceLabel: line.sourceLabel,
      disposition: line.disposition,
    })),
    readinessMissing: input.fit.missingCategories,
    readiness: input.fit.records,
    gaps: input.gaps,
    suggestion: input.suggestion.recommendation,
    suggestionRule: input.suggestion.rule,
  };
}
