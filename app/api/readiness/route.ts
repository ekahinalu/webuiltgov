import { AppError } from "../../../lib/auth/roles";
import { getDb } from "../../../lib/db/client";
import { isUuid } from "../../../lib/domain";
import { formValue, guardPost, redirectTo } from "../../../lib/http";
import { removeReadinessRecord, saveReadinessRecord } from "../../../lib/readiness/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const intent = formValue(form, "intent");
  const id = formValue(form, "id");
  try {
    const db = await getDb();
    if (intent === "remove") {
      if (!isUuid(id)) return redirectTo(request, "/readiness?notice=not-found");
      await removeReadinessRecord(db, guarded.principal, id);
      return redirectTo(request, "/readiness?notice=readiness-removed");
    }
    if (intent !== "create" && intent !== "save") return redirectTo(request, "/readiness?notice=readiness-invalid");
    if (intent === "save" && !isUuid(id)) return redirectTo(request, "/readiness?notice=not-found");
    await saveReadinessRecord(
      db,
      guarded.principal,
      {
        category: formValue(form, "category"),
        label: formValue(form, "label"),
        recordedValue: formValue(form, "recordedValue"),
        status: formValue(form, "status"),
        source: formValue(form, "source"),
        verifiedOn: formValue(form, "verifiedOn"),
        expiresOn: formValue(form, "expiresOn"),
        responsiblePerson: formValue(form, "responsiblePerson"),
      },
      intent === "save" ? id : undefined,
    );
    return redirectTo(request, "/readiness?notice=readiness-saved");
  } catch (error) {
    const code = error instanceof AppError ? error.code : "readiness-invalid";
    return redirectTo(request, `/readiness?notice=${code}`);
  }
}
