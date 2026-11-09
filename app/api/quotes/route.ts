import { AppError } from "../../../lib/auth/roles";
import { getDb } from "../../../lib/db/client";
import { isUuid } from "../../../lib/domain";
import { formValue, guardPost, redirectTo } from "../../../lib/http";
import { addQuote, addVendor } from "../../../lib/quotes/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const intent = formValue(form, "intent");
  const opportunityId = formValue(form, "opportunityId");
  const back = isUuid(opportunityId) ? `/opportunities/${opportunityId}/bid` : "/";
  try {
    const db = await getDb();
    if (intent === "vendor") {
      await addVendor(db, guarded.principal, opportunityId, {
        name: formValue(form, "name"),
        trade: formValue(form, "trade"),
      });
      return redirectTo(request, `${back}?notice=vendor-saved`);
    }
    if (intent === "quote") {
      await addQuote(db, guarded.principal, opportunityId, {
        vendorId: formValue(form, "vendorId"),
        amount: formValue(form, "amount"),
        covers: formValue(form, "covers"),
      });
      return redirectTo(request, `${back}?notice=quote-saved`);
    }
    return redirectTo(request, `${back}?notice=quote-invalid`);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "quote-invalid";
    return redirectTo(request, `${back}?notice=${code}`);
  }
}
