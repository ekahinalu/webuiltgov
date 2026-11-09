import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ensurePrincipal } from "../lib/auth/principal";
import { AppError } from "../lib/auth/roles";
import { addFulfillmentItem, awardWorkspace, saveAward, setFulfillmentComplete } from "../lib/awards/service";
import { parseGrantsHit } from "../lib/connectors/grants-gov";
import { createTestDb } from "../lib/db/client";
import { fulfillmentItems, fulfillmentProjects, opportunities } from "../lib/db/schema";
import { saveParsedOpportunity } from "../lib/opportunities/store";
import { inviteMember } from "../lib/org/service";

function person(sub: string, email: string, name: string) {
  return { plane: "production" as const, sub, email, name, simulated: false };
}

describe("award and fulfillment", () => {
  it("creates a project only from a typed award and leaves work incomplete", async () => {
    const db = await createTestDb();
    const owner = await ensurePrincipal(db, person("award-owner", "award-owner@example.com", "Award Owner"));
    const other = await ensurePrincipal(db, person("award-other", "award-other@example.com", "Other"));
    await inviteMember(db, owner, "award-viewer@example.com", "viewer");
    const viewer = await ensurePrincipal(db, person("award-viewer", "award-viewer@example.com", "Viewer"));
    const hit = parseGrantsHit({
      id: "363546",
      number: "HRSA-27-072",
      title: "Women's Initiative for Screening and Health (WISH)",
      agency: "Health Resources and Services Administration",
      closeDate: "01/08/2027",
    });
    if (!hit) throw new Error("hit missing");
    await saveParsedOpportunity(db, "production", hit, new Date("2026-11-09T07:50:00Z"));
    const [row] = await db.select().from(opportunities).where(eq(opportunities.sourceId, "363546"));
    if (!row) throw new Error("row missing");

    const opened = await awardWorkspace(db, owner, row.id);
    expect(opened?.award).toBeNull();
    expect(opened?.milestones).toEqual([]);
    expect(opened?.obligations).toEqual([]);
    expect(opened?.title).toBe("Women's Initiative for Screening and Health (WISH)");

    await expect(saveAward(db, owner, row.id, { amount: "", awardedOn: "2026-11-01", source: "Typed award letter" })).rejects.toMatchObject({
      code: "award-incomplete",
    });
    await expect(saveAward(db, owner, row.id, { amount: "1000", awardedOn: "", source: "Typed award letter" })).rejects.toMatchObject({
      code: "award-incomplete",
    });
    await expect(saveAward(db, owner, row.id, { amount: "1000", awardedOn: "2026-11-01", source: "  " })).rejects.toMatchObject({
      code: "award-incomplete",
    });
    await expect(saveAward(db, owner, row.id, { amount: "12.555", awardedOn: "2026-11-01", source: "Typed award letter" })).rejects.toMatchObject({
      code: "award-invalid",
    });
    await expect(saveAward(db, owner, row.id, { amount: "1000", awardedOn: "2026-02-31", source: "Typed award letter" })).rejects.toMatchObject({
      code: "award-invalid",
    });
    expect(await db.select().from(fulfillmentProjects)).toEqual([]);
    await expect(addFulfillmentItem(db, owner, row.id, { kind: "milestone", name: "Notice to proceed", dueOn: "" })).rejects.toMatchObject({
      code: "item-award",
    });

    expect(await saveAward(db, owner, row.id, { amount: "0", awardedOn: "2026-11-01", source: "Typed award letter" })).toBe("created");
    const awarded = await awardWorkspace(db, owner, row.id);
    expect(awarded?.award?.amountCents).toBe(0);
    expect(awarded?.award?.awardedOn).toBe("2026-11-01");
    expect(awarded?.award?.source).toBe("Typed award letter");
    expect(awarded?.award?.enteredBy).toBe(owner.userId);
    expect(awarded?.award?.enteredByName).toBe("Award Owner");
    expect(awarded?.award?.source).not.toContain("Health Resources");
    expect(await db.select().from(fulfillmentProjects)).toHaveLength(1);

    await expect(saveAward(db, owner, row.id, { amount: "", awardedOn: "2026-11-02", source: "Replacement" })).rejects.toMatchObject({
      code: "award-incomplete",
    });
    expect((await awardWorkspace(db, owner, row.id))?.award?.amountCents).toBe(0);
    expect((await awardWorkspace(db, owner, row.id))?.award?.source).toBe("Typed award letter");

    await expect(addFulfillmentItem(db, viewer, row.id, { kind: "milestone", name: "Viewer item", dueOn: "" })).rejects.toBeInstanceOf(AppError);
    await expect(addFulfillmentItem(db, owner, row.id, { kind: "milestone", name: "  ", dueOn: "" })).rejects.toMatchObject({ code: "item-name" });
    await expect(addFulfillmentItem(db, owner, row.id, { kind: "milestone", name: "Notice to proceed", dueOn: "2026-02-31" })).rejects.toMatchObject({
      code: "item-date",
    });
    expect(await db.select().from(fulfillmentItems)).toEqual([]);

    await addFulfillmentItem(db, owner, row.id, { kind: "milestone", name: "Notice to proceed", dueOn: "" });
    await addFulfillmentItem(db, owner, row.id, { kind: "obligation", name: "Monthly report", dueOn: "2026-01-01" });
    const project = await awardWorkspace(db, owner, row.id);
    expect(project?.milestones).toHaveLength(1);
    expect(project?.milestones[0]?.dueOn).toBeNull();
    expect(project?.milestones[0]?.completed).toBe(false);
    expect(project?.obligations[0]?.dueOn).toBe("2026-01-01");
    expect(project?.obligations[0]?.completed).toBe(false);
    const milestoneId = project?.milestones[0]?.id;
    if (!milestoneId) throw new Error("milestone missing");

    await setFulfillmentComplete(db, owner, row.id, milestoneId, false);
    expect((await awardWorkspace(db, owner, row.id))?.milestones[0]?.completed).toBe(false);
    await expect(setFulfillmentComplete(db, viewer, row.id, milestoneId, true)).rejects.toBeInstanceOf(AppError);
    await setFulfillmentComplete(db, owner, row.id, milestoneId, true);
    const checked = (await awardWorkspace(db, owner, row.id))?.milestones[0];
    expect(checked?.completed).toBe(true);
    expect(checked?.completedByName).toBe("Award Owner");
    expect(checked?.completedAt).toBeInstanceOf(Date);
    expect((await awardWorkspace(db, owner, row.id))?.obligations[0]?.completed).toBe(false);
    await setFulfillmentComplete(db, owner, row.id, milestoneId, false);
    expect((await awardWorkspace(db, owner, row.id))?.milestones[0]?.completed).toBe(false);
    expect((await awardWorkspace(db, owner, row.id))?.milestones[0]?.completedAt).toBeNull();

    expect(await saveAward(db, owner, row.id, { amount: "1500", awardedOn: "2026-11-03", source: "Typed modification" })).toBe("updated");
    const updated = await awardWorkspace(db, owner, row.id);
    expect(updated?.award?.amountCents).toBe(150000);
    expect(updated?.milestones).toHaveLength(1);
    expect(await db.select().from(fulfillmentProjects)).toHaveLength(1);

    const hidden = await awardWorkspace(db, other, row.id);
    expect(hidden?.award).toBeNull();
    expect(hidden?.milestones).toEqual([]);
    await expect(setFulfillmentComplete(db, other, row.id, milestoneId, true)).rejects.toMatchObject({ code: "not-found" });
    expect((await awardWorkspace(db, owner, row.id))?.milestones[0]?.completed).toBe(false);
  });
});
