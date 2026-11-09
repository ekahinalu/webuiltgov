import { eq } from "drizzle-orm";
import { AppError, assertRole } from "../auth/roles";
import type { Principal } from "../auth/principal";
import type { AppDatabase } from "../db/client";
import { opportunities } from "../db/schema";
import { getOpportunity } from "../opportunities/detail";
import { saveParsedOpportunity } from "../opportunities/store";
import { fetchGrantsDetail, parseGrantsDetail, parseGrantsHit, type FetchLike } from "./grants-gov";

export async function refreshGrantsOpportunity(
  db: AppDatabase,
  principal: Principal,
  opportunityId: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  assertRole(principal.role, "member");
  const current = await getOpportunity(db, principal, opportunityId);
  if (!current || current.source !== "grants.gov") {
    throw new AppError("not-found", "That Grants.gov record is not in this catalog.", 404);
  }
  const attempted = current.sourceFacts.detailAttemptAt;
  if (attempted) {
    const at = new Date(attempted);
    if (!Number.isNaN(at.getTime()) && Date.now() - at.getTime() < 30_000) {
      throw new AppError("refresh-wait", "This record was refreshed moments ago.", 429);
    }
  }
  const now = new Date();
  await db
    .update(opportunities)
    .set({ sourceFacts: { ...current.sourceFacts, detailAttemptAt: now.toISOString() } })
    .where(eq(opportunities.id, current.id));
  try {
    const detail = parseGrantsDetail(await fetchGrantsDetail(fetchImpl, current.sourceId));
    if (!detail || detail.sourceId !== current.sourceId) {
      throw new AppError("refresh-failed", "Grants.gov did not return this record.", 502);
    }
    const listing = parseGrantsHit({
      id: current.sourceId,
      title: current.title,
      number: current.solicitationNumber,
      agency: detail.agency ?? current.agency,
      closeDate: detail.deadlineRaw ?? current.deadlineRaw,
    });
    if (!listing) throw new AppError("refresh-failed", "Grants.gov did not return this record.", 502);
    listing.description = detail.description;
    listing.coverage = { description: true, naics: false, location: false };
    if (detail.deadline) {
      listing.deadline = detail.deadline;
      listing.deadlineRaw = detail.deadlineRaw;
    }
    listing.sourceFacts = {
      ...current.sourceFacts,
      ...listing.sourceFacts,
      ...detail.sourceFacts,
      detailAttemptAt: now.toISOString(),
    };
    await saveParsedOpportunity(db, principal.plane, listing, now);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("refresh-failed", "Grants.gov did not return this record.", 502);
  }
}
