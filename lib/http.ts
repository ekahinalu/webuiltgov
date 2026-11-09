import { getIdentity } from "../cursor/identity.js";
import { getDb } from "./db/client";
import { ensurePrincipal, type Principal } from "./auth/principal";

export function crossSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return false;
  if (site === "cross-site" || site === "same-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }
  const host = request.headers.get("host")?.split(",")[0]?.trim() ?? "";
  let urlHost = "";
  try {
    urlHost = new URL(request.url).host;
  } catch {
    urlHost = "";
  }
  return originHost !== host && originHost !== urlHost;
}

export function redirectTo(request: Request, path: string): Response {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("bad redirect");
  }
  const target = new URL(path, request.url);
  return new Response(null, {
    status: 303,
    headers: { location: target.toString(), "cache-control": "private, no-store" },
  });
}

export function formValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export async function principalFromRequest(request: Request): Promise<Principal | null> {
  const identity = await getIdentity(request);
  if (!identity.verified || identity.kind !== "person") return null;
  const db = await getDb();
  return ensurePrincipal(db, {
    plane: identity.stage === "preview" ? "preview" : "production",
    sub: identity.sub,
    email: identity.email,
    name: identity.name,
    simulated: identity.simulated,
  });
}

export async function guardPost(request: Request): Promise<{ principal: Principal } | Response> {
  if (crossSite(request)) return redirectTo(request, "/?notice=forbidden");
  const principal = await principalFromRequest(request);
  if (!principal) return redirectTo(request, "/?notice=forbidden");
  return { principal };
}
