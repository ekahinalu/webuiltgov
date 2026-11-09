import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseGrantsDetail, parseGrantsSearch } from "../lib/connectors/grants-gov";
import { parseSamNotice, parseSamSearch } from "../lib/connectors/sam-gov";
import { crossSite } from "../lib/http";
import { decodeHtml } from "../lib/text";

async function readJson(name: string) {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as unknown;
}

describe("Grants.gov parsing", () => {
  it("maps a real search payload without inventing NAICS or location", async () => {
    const parsed = parseGrantsSearch(await readJson("grants-search.json"));
    expect("records" in parsed).toBe(true);
    if (!("records" in parsed)) return;
    expect(parsed.records).toHaveLength(2);
    const [first, second] = parsed.records;
    expect(first?.source).toBe("grants.gov");
    expect(first?.sourceId).toBe("363546");
    expect(first?.solicitationNumber).toBe("HRSA-27-072");
    expect(first?.agency).toBe("Health Resources and Services Administration");
    expect(first?.governmentLevel).toBe("federal");
    expect(first?.naics).toBeNull();
    expect(first?.location).toBeNull();
    expect(first?.description).toBeNull();
    expect(first?.coverage).toEqual({ description: false, naics: false, location: false });
    expect(first?.deadline).toBe("2027-01-08");
    expect(first?.recordKind).toBe("grant_opportunity");
    expect(first?.sourceUrl).toBe("https://www.grants.gov/search-results-detail/363546");
    expect(first?.sourceFacts.cfdaNumbers).toEqual(["93.110"]);
    expect(second?.title).toBe("Strengthening Moldova's Energy and Trade Security");
  });

  it("uses agencyDetails instead of the synopsis contact block", () => {
    const detail = parseGrantsDetail({
      errorcode: 0,
      data: {
        id: 364214,
        agencyDetails: { agencyName: "Animal and Plant Health Inspection Service", agencyCode: "USDA-APHIS" },
        synopsis: { agencyName: "Donna L Shultz\nGrantor", agencyCode: "USDA-APHIS", synopsisDesc: "<p>Preparedness funding.</p>" },
      },
    });
    expect(detail?.agency).toBe("Animal and Plant Health Inspection Service");
    expect(detail?.agency).not.toContain("Shultz");
  });

  it("strips HTML from a real detail payload", async () => {
    const detail = parseGrantsDetail(await readJson("grants-detail.json"));
    expect(detail?.sourceId).toBe("363546");
    expect(detail?.description?.startsWith("The purpose of Women's Initiative")).toBe(true);
    expect(detail?.description).not.toContain("<p>");
    expect(detail?.deadline).toBe("2027-01-08");
    expect(detail?.agency).toBe("Health Resources and Services Administration");
    expect(detail?.sourceFacts.department).toBe("Department of Health and Human Services");
    expect(detail?.sourceFacts.cfdaNumbers).toEqual(["93.110"]);
    expect(detail?.sourceFacts.sourceUpdated).toBe("Nov 06, 2026 08:59:45 AM EST");
  });
});

describe("SAM.gov parsing", () => {
  it("labels the documented award example as an award and keeps null deadlines null", async () => {
    const parsed = parseSamSearch(await readJson("sam-documented-example.json"));
    expect("records" in parsed).toBe(true);
    if (!("records" in parsed)) return;
    const [record] = parsed.records;
    expect(record?.recordKind).toBe("award_notice");
    expect(record?.title).toBe("Historic Office Renovation");
    expect(record?.solicitationNumber).toBe("47PF0018R0023");
    expect(record?.agency).toBe("PUBLIC BUILDINGS SERVICE");
    expect(record?.naics).toBe("236220");
    expect(record?.location).toBe("517 E Wisconsin Ave, Milwaukee, WI 53202");
    expect(record?.deadline).toBeNull();
    expect(record?.description).toBeNull();
    expect(record?.sourceFacts.descriptionUrl).toContain("https://api.sam.gov/prod/opportunities/");
    expect(record?.sourceFacts.department).toBe("GENERAL SERVICES ADMINISTRATION");
  });

  it("does not invent NAICS, location, or a solicitation when those fields are absent", () => {
    const record = parseSamNotice({
      noticeId: "ff826a59eac743c4a1a07ff5e0cf3e3a",
      title: "Documented null fields",
      type: "Solicitation",
      solicitationNumber: " ",
      naicsCode: null,
      placeOfPerformance: null,
      responseDeadLine: null,
      uiLink: "null",
      description: "null",
    });
    expect(record?.recordKind).toBe("contract_notice");
    expect(record?.naics).toBeNull();
    expect(record?.location).toBeNull();
    expect(record?.solicitationNumber).toBeNull();
    expect(record?.sourceUrl).toBeNull();
    expect(record?.description).toBeNull();
    expect(record?.agency).toBeNull();
  });

  it("skips a notice with no type instead of guessing the kind", () => {
    expect(parseSamNotice({ noticeId: "abc", title: "Untitled kind", type: null })).toBeNull();
  });
});

describe("request checks", () => {
  it("blocks cross-site posts and allows same-origin browser posts", () => {
    const cross = new Request("https://webuiltgov.example/api/sync", {
      headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" },
    });
    const same = new Request("https://webuiltgov.example/api/sync", {
      headers: { "sec-fetch-site": "same-origin", origin: "https://webuiltgov.example", host: "webuiltgov.example" },
    });
    const forged = new Request("https://webuiltgov.example/api/sync", {
      headers: { origin: "https://evil.example", host: "webuiltgov.example" },
    });
    expect(crossSite(cross)).toBe(true);
    expect(crossSite(same)).toBe(false);
    expect(crossSite(forged)).toBe(true);
  });

  it("decodes the grants title entity", () => {
    expect(decodeHtml("Strengthening Moldova&rsquo;s Energy")).toBe("Strengthening Moldova's Energy");
  });
});
