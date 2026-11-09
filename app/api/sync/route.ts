import { AppError } from "../../../lib/auth/roles";
import { syncConnector } from "../../../lib/connectors/sync";
import { getDb } from "../../../lib/db/client";
import { formValue, guardPost, redirectTo } from "../../../lib/http";
import { SOURCES, type SourceName } from "../../../lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const source = formValue(form, "source");
  if (!(SOURCES as readonly string[]).includes(source)) {
    return redirectTo(request, "/connectors?notice=sync-failed");
  }
  try {
    const result = await syncConnector(await getDb(), guarded.principal, source as SourceName);
    return redirectTo(request, `/connectors?notice=${result.ok ? result.code : result.code}`);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "sync-failed";
    return redirectTo(request, `/connectors?notice=${code}`);
  }
}
