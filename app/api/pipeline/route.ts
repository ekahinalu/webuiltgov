import { AppError, isPipelineStatus } from "../../../lib/auth/roles";
import { getDb } from "../../../lib/db/client";
import { formValue, guardPost, redirectTo } from "../../../lib/http";
import { isUuid } from "../../../lib/domain";
import { setPipeline } from "../../../lib/opportunities/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const opportunityId = formValue(form, "opportunityId");
  const back = isUuid(opportunityId) ? `/opportunities/${opportunityId}` : "/";
  const status = formValue(form, "status");
  const next = status === "clear" ? "clear" : status;
  if (next !== "clear" && !isPipelineStatus(next)) {
    return redirectTo(request, `${back}?notice=invalid-status`);
  }
  try {
    await setPipeline(await getDb(), guarded.principal, opportunityId, next);
    return redirectTo(request, `${back}?notice=saved`);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "forbidden";
    return redirectTo(request, `${back}?notice=${code}`);
  }
}
