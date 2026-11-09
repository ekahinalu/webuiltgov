import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { marketingText } from "../lib/marketing/home";
import { searchHref } from "../lib/opportunities/search";

const REQUIRED = [
  "Grants.gov",
  "funding opportunit",
  "readiness",
  "eligibility",
  "pursuit",
  "stored",
  "estimate",
  "approves it",
  "PDF",
  "confirmation",
  "vendor",
  "quote",
  "award",
  "invoice",
  "payment",
  "webuiltgov.com",
  "not connected",
  "does not require sign-in",
];

const FORBIDDEN = [
  "sam.gov",
  "grok",
  "win probability",
  "contract solicitation",
  "automatic submission",
  "automatically submit",
  "xai",
];

describe("public marketing home", () => {
  it("describes only the capabilities in this branch", () => {
    const text = marketingText();
    const lower = text.toLowerCase();
    for (const phrase of REQUIRED) expect(lower).toContain(phrase.toLowerCase());
    for (const phrase of FORBIDDEN) expect(lower).not.toContain(phrase);
    expect(text).toContain("webuiltgov.com is the intended domain and is not connected yet.");
  });

  it("does not ask the home page for a principal", () => {
    const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("getPagePrincipal");
    expect(source).not.toContain("SignedOut");
  });

  it("keeps opportunity search on its own route", () => {
    expect(searchHref({ q: "water", level: "", agency: "", location: "", naics: "", deadlineFrom: "", deadlineTo: "", source: "", page: 1 })).toBe("/search?q=water");
  });
});
