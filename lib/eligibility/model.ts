import type { SourceFacts } from "../domain";

export const DISPOSITIONS = [
  "satisfied",
  "unsatisfied",
  "potentially_correctable",
  "needs_verification",
  "not_applicable",
] as const;

export type Disposition = (typeof DISPOSITIONS)[number];

export const DISPOSITION_LABEL: Record<Disposition, string> = {
  satisfied: "Satisfied",
  unsatisfied: "Unsatisfied",
  potentially_correctable: "Potentially correctable",
  needs_verification: "Needs verification",
  not_applicable: "Not applicable",
};

export type SourceRequirement = {
  sourceKey: string;
  text: string;
  sourceLabel: string;
};

export function isDisposition(value: unknown): value is Disposition {
  return typeof value === "string" && (DISPOSITIONS as readonly string[]).includes(value);
}

export function requirementsFromFacts(facts: SourceFacts): { loaded: boolean; requirements: SourceRequirement[] } {
  if (!Array.isArray(facts.applicantTypes)) return { loaded: false, requirements: [] };
  const requirements: SourceRequirement[] = [];
  const seen = new Set<string>();
  for (const item of facts.applicantTypes) {
    if (!item || typeof item.id !== "string" || typeof item.description !== "string") continue;
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(item.id)) continue;
    const text = item.description.trim();
    if (text === "" || seen.has(item.id)) continue;
    seen.add(item.id);
    requirements.push({
      sourceKey: `grants.gov:applicant-type:${item.id}`,
      text,
      sourceLabel: "Grants.gov applicant type",
    });
  }
  return { loaded: true, requirements };
}
