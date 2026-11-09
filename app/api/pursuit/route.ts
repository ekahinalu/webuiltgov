import { xaiKey } from "../../../lib/ai/config";
import { AppError } from "../../../lib/auth/roles";
import { getDb } from "../../../lib/db/client";
import { isUuid } from "../../../lib/domain";
import { formValue, guardPost, redirectTo } from "../../../lib/http";
import { draftPursuit, savePursuitDecision } from "../../../lib/pursuit/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const intent = formValue(form, "intent");
  const opportunityId = formValue(form, "opportunityId");
  const back = isUuid(opportunityId) ? `/opportunities/${opportunityId}/pursuit` : "/";
  try {
    const db = await getDb();
    if (intent === "draft") {
      if (!xaiKey()) return redirectTo(request, `${back}?notice=pursuit-no-key`);
      const outcome = await draftPursuit(db, guarded.principal, opportunityId);
      return redirectTo(request, `${back}?notice=${outcome === "drafted" ? "pursuit-drafted" : "pursuit-draft-failed"}`);
    }
    if (intent !== "save") return redirectTo(request, `${back}?notice=pursuit-invalid`);
    await savePursuitDecision(db, guarded.principal, opportunityId, formValue(form, "recommendation"), formValue(form, "reason"));
    return redirectTo(request, `${back}?notice=pursuit-saved`);
  } catch (error) {
    const code = error instanceof AppError ? (error.code === "missing-key" ? "pursuit-no-key" : error.code) : "pursuit-invalid";
    return redirectTo(request, `${back}?notice=${code}`);
  }
}
