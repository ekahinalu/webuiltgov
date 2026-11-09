import { xaiKey } from "../../../lib/ai/config";
import { AppError } from "../../../lib/auth/roles";
import { getDb } from "../../../lib/db/client";
import { isUuid } from "../../../lib/domain";
import { formValue, guardPost, redirectTo } from "../../../lib/http";
import {
  addVerifiedProject,
  draftProposal,
  saveDraftIntoSection,
  saveMatrixLine,
  saveProposalSection,
  setProjectInclusion,
  setReadinessInclusion,
} from "../../../lib/proposals/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const intent = formValue(form, "intent");
  const opportunityId = formValue(form, "opportunityId");
  const back = isUuid(opportunityId) ? `/opportunities/${opportunityId}/proposal` : "/";
  try {
    const db = await getDb();
    const principal = guarded.principal;
    if (intent === "section") {
      await saveProposalSection(db, principal, opportunityId, formValue(form, "section"), formValue(form, "body"));
      return redirectTo(request, `${back}?notice=proposal-saved`);
    }
    if (intent === "include-readiness" || intent === "remove-readiness") {
      await setReadinessInclusion(db, principal, opportunityId, formValue(form, "readinessId"), intent === "include-readiness");
      return redirectTo(request, `${back}?notice=${intent === "include-readiness" ? "proposal-included" : "proposal-removed"}`);
    }
    if (intent === "add-project") {
      await addVerifiedProject(db, principal, opportunityId, {
        name: formValue(form, "name"),
        client: formValue(form, "client"),
        description: formValue(form, "description"),
        completedOn: formValue(form, "completedOn"),
      });
      return redirectTo(request, `${back}?notice=proposal-project`);
    }
    if (intent === "include-project" || intent === "remove-project") {
      await setProjectInclusion(db, principal, opportunityId, formValue(form, "projectId"), intent === "include-project");
      return redirectTo(request, `${back}?notice=${intent === "include-project" ? "proposal-included" : "proposal-removed"}`);
    }
    if (intent === "matrix") {
      await saveMatrixLine(db, principal, opportunityId, formValue(form, "sourceKey"), formValue(form, "section"), formValue(form, "completion"));
      return redirectTo(request, `${back}?notice=proposal-matrix`);
    }
    if (intent === "draft") {
      if (!xaiKey()) return redirectTo(request, `${back}?notice=proposal-no-key`);
      const outcome = await draftProposal(db, principal, opportunityId);
      return redirectTo(request, `${back}?notice=${outcome === "drafted" ? "proposal-drafted" : "proposal-draft-failed"}`);
    }
    if (intent === "use-draft") {
      await saveDraftIntoSection(db, principal, opportunityId, formValue(form, "section"));
      return redirectTo(request, `${back}?notice=proposal-draft-saved`);
    }
    return redirectTo(request, `${back}?notice=proposal-invalid`);
  } catch (error) {
    const code = error instanceof AppError ? (error.code === "missing-key" ? "proposal-no-key" : error.code) : "proposal-invalid";
    return redirectTo(request, `${back}?notice=${code}`);
  }
}
