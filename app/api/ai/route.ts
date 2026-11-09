import { AppError } from "../../../lib/auth/roles";
import { askModel, setModel } from "../../../lib/ai/config";
import { getDb } from "../../../lib/db/client";
import { formValue, guardPost, redirectTo } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const intent = formValue(form, "intent");
  const db = await getDb();
  try {
    if (intent === "model") {
      await setModel(db, guarded.principal, formValue(form, "model"));
      return redirectTo(request, "/ai?notice=model-saved");
    }
    await askModel(db, guarded.principal, {
      prompt: formValue(form, "prompt"),
      opportunityId: formValue(form, "opportunityId"),
    });
    return redirectTo(request, "/ai?notice=asked");
  } catch (error) {
    const code = error instanceof AppError ? error.code : "forbidden";
    return redirectTo(request, `/ai?notice=${code}`);
  }
}
