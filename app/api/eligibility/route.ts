import { AppError } from "../../../lib/auth/roles";
import { getDb } from "../../../lib/db/client";
import { isUuid } from "../../../lib/domain";
import { setEligibilityMark } from "../../../lib/eligibility/service";
import { formValue, guardPost, redirectTo } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const opportunityId = formValue(form, "opportunityId");
  const back = isUuid(opportunityId) ? `/opportunities/${opportunityId}/eligibility` : "/";
  try {
    await setEligibilityMark(await getDb(), guarded.principal, opportunityId, formValue(form, "sourceKey"), formValue(form, "disposition"));
    return redirectTo(request, `${back}?notice=eligibility-saved`);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "eligibility-invalid";
    return redirectTo(request, `${back}?notice=${code}`);
  }
}
