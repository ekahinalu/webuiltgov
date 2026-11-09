import { AppError } from "../../../lib/auth/roles";
import { approveBidPrice, openBid, saveBidEstimate, setBidStage } from "../../../lib/bids/service";
import { getDb } from "../../../lib/db/client";
import { isUuid } from "../../../lib/domain";
import { formValue, guardPost, redirectTo } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const intent = formValue(form, "intent");
  const opportunityId = formValue(form, "opportunityId");
  const back = isUuid(opportunityId) ? `/opportunities/${opportunityId}/bid` : "/";
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  try {
    const db = await getDb();
    if (intent === "open") {
      await openBid(db, guarded.principal, opportunityId);
      return redirectTo(request, `${back}?notice=bid-opened`);
    }
    if (intent === "stage") {
      await setBidStage(db, guarded.principal, opportunityId, formValue(form, "stage"));
      return redirectTo(request, `${back}?notice=bid-stage`);
    }
    if (intent === "estimate") {
      await saveBidEstimate(db, guarded.principal, opportunityId, fields);
      return redirectTo(request, `${back}?notice=bid-saved`);
    }
    if (intent === "approve") {
      await approveBidPrice(db, guarded.principal, opportunityId);
      return redirectTo(request, `${back}?notice=bid-approved`);
    }
    return redirectTo(request, `${back}?notice=bid-invalid`);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "bid-invalid";
    return redirectTo(request, `${back}?notice=${code}`);
  }
}
