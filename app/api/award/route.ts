import { AppError } from "../../../lib/auth/roles";
import { saveAward, addFulfillmentItem, setFulfillmentComplete } from "../../../lib/awards/service";
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
  const back = isUuid(opportunityId) ? `/opportunities/${opportunityId}/award` : "/";
  try {
    const db = await getDb();
    if (intent === "award") {
      const outcome = await saveAward(db, guarded.principal, opportunityId, {
        amount: formValue(form, "amount"),
        awardedOn: formValue(form, "awardedOn"),
        source: formValue(form, "source"),
      });
      return redirectTo(request, `${back}?notice=${outcome === "created" ? "award-saved" : "award-updated"}`);
    }
    if (intent === "item") {
      await addFulfillmentItem(db, guarded.principal, opportunityId, {
        kind: formValue(form, "kind"),
        name: formValue(form, "name"),
        dueOn: formValue(form, "dueOn"),
      });
      return redirectTo(request, `${back}?notice=item-saved`);
    }
    if (intent === "complete") {
      await setFulfillmentComplete(db, guarded.principal, opportunityId, formValue(form, "itemId"), formValue(form, "completed") === "yes");
      return redirectTo(request, `${back}?notice=item-complete`);
    }
    return redirectTo(request, `${back}?notice=item-invalid`);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "award-invalid";
    return redirectTo(request, `${back}?notice=${code}`);
  }
}
