import { AppError, isRole, type InviteRole, type Role } from "../../../lib/auth/roles";
import { getDb } from "../../../lib/db/client";
import { formValue, guardPost, redirectTo } from "../../../lib/http";
import { inviteMember, renameOrganization, setMemberRole, switchOrganization } from "../../../lib/org/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const intent = formValue(form, "intent");
  const db = await getDb();
  try {
    if (intent === "rename") {
      await renameOrganization(db, guarded.principal, formValue(form, "name"));
      return redirectTo(request, "/organization?notice=renamed");
    }
    if (intent === "switch") {
      await switchOrganization(db, guarded.principal, formValue(form, "organizationId"));
      return redirectTo(request, "/organization?notice=switched");
    }
    if (intent === "invite") {
      const role = formValue(form, "role");
      if (role !== "admin" && role !== "member" && role !== "viewer") {
        return redirectTo(request, "/organization?notice=forbidden");
      }
      await inviteMember(db, guarded.principal, formValue(form, "email"), role as InviteRole);
      return redirectTo(request, "/organization?notice=invited");
    }
    if (intent === "role" || intent === "remove") {
      const next = intent === "remove" ? "remove" : formValue(form, "role");
      if (next !== "remove" && !isRole(next)) return redirectTo(request, "/organization?notice=forbidden");
      await setMemberRole(db, guarded.principal, formValue(form, "userId"), next as Role | "remove");
      return redirectTo(request, `/organization?notice=${intent === "remove" ? "removed" : "role-updated"}`);
    }
    return redirectTo(request, "/organization?notice=forbidden");
  } catch (error) {
    const code = error instanceof AppError ? error.code : "forbidden";
    return redirectTo(request, `/organization?notice=${code}`);
  }
}
