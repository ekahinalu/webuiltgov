import { isRealIsoDate } from "../dates";
import {
  COMPLETION_LABEL,
  PROPOSAL_SECTIONS,
  SECTION_LABEL,
  type Completion,
  type ProposalSection,
  type SavedSections,
} from "../proposals/model";
import { cleanText } from "../text";

export type ChecklistState = "saved" | "empty";

export type ChecklistLine = {
  key: string;
  kind: "section" | "matrix";
  label: string;
  state: ChecklistState;
  detail: string | null;
};

export type MatrixChecklistLine = {
  sourceKey: string;
  text: string;
  section: ProposalSection | null;
  completion: Completion | null;
};

export function submissionChecklist(input: {
  sections: SavedSections;
  pastPerformanceSaved: boolean;
  matrix: MatrixChecklistLine[];
}): ChecklistLine[] {
  const lines: ChecklistLine[] = PROPOSAL_SECTIONS.map((section) => {
    const saved = section === "past_performance" ? input.pastPerformanceSaved : input.sections[section] !== null;
    return {
      key: section,
      kind: "section" as const,
      label: SECTION_LABEL[section],
      state: saved ? "saved" as const : "empty" as const,
      detail: null,
    };
  });
  for (const line of input.matrix) {
    const saved = line.section !== null || line.completion !== null;
    const parts: string[] = [];
    if (line.completion) parts.push(COMPLETION_LABEL[line.completion]);
    if (line.section) parts.push(SECTION_LABEL[line.section]);
    lines.push({
      key: line.sourceKey,
      kind: "matrix",
      label: line.text,
      state: saved ? "saved" : "empty",
      detail: parts.length > 0 ? parts.join(". ") : null,
    });
  }
  return lines;
}

export function parseSubmissionTime(value: string): Date | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(trimmed);
  if (!match) return "invalid";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  if (!isRealIsoDate(iso) || hour > 23 || minute > 59 || second > 59) return "invalid";
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed);
  if (hasZone) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
  }
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

export function requiredEntry(value: string, max: number): string | null {
  return cleanText(value, max);
}

export function priceChecklistText(state: "none" | "draft" | "approved"): string {
  if (state === "draft") return "The proposed price is still a draft.";
  if (state === "approved") return "The proposed price is approved.";
  return "No proposed price is stored.";
}
