import { AppError } from "../../../lib/auth/roles";
import { getDb } from "../../../lib/db/client";
import { isUuid } from "../../../lib/domain";
import { formValue, guardPost, redirectTo } from "../../../lib/http";
import { recordInternalApproval, recordSubmission } from "../../../lib/submissions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const intent = formValue(form, "intent");
  const opportunityId = formValue(form, "opportunityId");
  const back = isUuid(opportunityId) ? `/opportunities/${opportunityId}/submission` : "/";
  try {
    const db = await getDb();
    if (intent === "approve") {
      await recordInternalApproval(db, guarded.principal, opportunityId);
      return redirectTo(request, `${back}?notice=submission-approved`);
    }
    if (intent === "submit") {
      await recordSubmission(db, guarded.principal, opportunityId, {
        confirmationNumber: formValue(form, "confirmationNumber"),
        destination: formValue(form, "destination"),
        submittedAt: formValue(form, "submittedAt"),
      });
      return redirectTo(request, `${back}?notice=submission-recorded`);
    }
    return redirectTo(request, `${back}?notice=submission-invalid`);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "submission-invalid";
    return redirectTo(request, `${back}?notice=${code}`);
  }
}
