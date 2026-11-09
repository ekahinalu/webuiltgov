import { isRealIsoDate } from "../dates";
import { cleanText } from "../text";

export const TEXT_SECTIONS = ["cover", "understanding", "technical_approach"] as const;
export type TextSection = (typeof TEXT_SECTIONS)[number];

export const PROPOSAL_SECTIONS = [...TEXT_SECTIONS, "past_performance"] as const;
export type ProposalSection = (typeof PROPOSAL_SECTIONS)[number];

export const SECTION_LABEL: Record<ProposalSection, string> = {
  cover: "Cover",
  understanding: "Understanding of the project",
  technical_approach: "Technical approach",
  past_performance: "Past performance",
};

export const COMPLETIONS = ["complete", "incomplete", "missing", "needs_review", "not_applicable"] as const;
export type Completion = (typeof COMPLETIONS)[number];

export const COMPLETION_LABEL: Record<Completion, string> = {
  complete: "Complete",
  incomplete: "Incomplete",
  missing: "Missing",
  needs_review: "Needs review",
  not_applicable: "Not applicable",
};

export const PROPOSAL_DRAFT_INSTRUCTIONS =
  "You draft proposal language from stored WeBuiltGov records supplied in the user message. Use only those fields. If a value is null or a section is empty, say it was not saved. Do not invent projects, licenses, certifications, or awards. Do not write past performance. The draft is model text until a person saves it into a section.";

export function isTextSection(value: unknown): value is TextSection {
  return typeof value === "string" && (TEXT_SECTIONS as readonly string[]).includes(value);
}

export function isProposalSection(value: unknown): value is ProposalSection {
  return typeof value === "string" && (PROPOSAL_SECTIONS as readonly string[]).includes(value);
}

export function isCompletion(value: unknown): value is Completion {
  return typeof value === "string" && (COMPLETIONS as readonly string[]).includes(value);
}

export function proposalText(value: string, max = 20000): string | null {
  const stripped = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n/g, "\n");
  const text = stripped.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length === 0) return null;
  return text.slice(0, max);
}

export function optionalDate(value: string): string | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return isRealIsoDate(trimmed) ? trimmed : "invalid";
}

export type SavedSections = Record<TextSection, string | null>;

export function emptySections(): SavedSections {
  return { cover: null, understanding: null, technical_approach: null };
}

export type ExportReadiness = { category: string; label: string | null; recordedValue: string | null };
export type ExportProject = { name: string; client: string | null; description: string | null; completedOn: string | null };

export function proposalExportLines(input: {
  sections: SavedSections;
  readiness: ExportReadiness[];
  projects: ExportProject[];
}): string[] {
  const saved = TEXT_SECTIONS.some((section) => input.sections[section]);
  const past = input.readiness.length > 0 || input.projects.length > 0;
  if (!saved && !past) return [];
  const lines: string[] = [];
  for (const section of TEXT_SECTIONS) {
    const body = input.sections[section];
    if (!body) continue;
    lines.push(SECTION_LABEL[section]);
    lines.push(body);
    lines.push("");
  }
  if (!past) return lines;
  lines.push(SECTION_LABEL.past_performance);
  for (const record of input.readiness) {
    lines.push(`Readiness record: ${record.category}`);
    if (record.label) lines.push(record.label);
    if (record.recordedValue) lines.push(record.recordedValue);
  }
  for (const project of input.projects) {
    lines.push(project.name);
    if (project.client) lines.push(project.client);
    if (project.description) lines.push(project.description);
    if (project.completedOn) lines.push(project.completedOn);
  }
  return lines;
}

export function projectName(value: string): string | null {
  return cleanText(value, 200);
}
