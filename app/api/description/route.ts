import { AppError } from "../../../lib/auth/roles";
import { refreshGrantsOpportunity } from "../../../lib/connectors/refresh";
import { getDb } from "../../../lib/db/client";
import { isUuid } from "../../../lib/domain";
import { formValue, guardPost, redirectTo } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const opportunityId = formValue(await request.formData(), "opportunityId");
  const path = isUuid(opportunityId) ? `/opportunities/${opportunityId}` : "/";
  try {
    await refreshGrantsOpportunity(await getDb(), guarded.principal, opportunityId);
    return redirectTo(request, `${path}?notice=refreshed`);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "refresh-failed";
    return redirectTo(request, `${path}?notice=${code}`);
  }
}
