import { headers } from "next/headers";
import { getIdentity } from "../../cursor/identity.js";
import { getDb } from "../db/client";
import { ensurePrincipal, type Principal } from "./principal";

export async function getPagePrincipal(): Promise<Principal | null> {
  const headerList = await headers();
  const identity = await getIdentity(headerList);
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

export type { Principal };
