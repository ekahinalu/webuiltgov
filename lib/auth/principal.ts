import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/client";
import { invites, memberships, organizations, users } from "../db/schema";
import type { Plane } from "../domain";
import { cleanText } from "../text";
import { isRole, type Role } from "./roles";

export type Principal = {
  userId: string;
  plane: Plane;
  email: string;
  name: string;
  simulated: boolean;
  organizationId: string;
  organizationName: string;
  role: Role;
  memberships: { organizationId: string; name: string; role: Role }[];
};

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function ensurePrincipal(
  db: AppDatabase,
  input: { plane: Plane; sub: string; email: string; name: string; simulated: boolean },
): Promise<Principal> {
  if (input.sub.trim() === "") throw new Error("identity subject missing");
  return db.transaction(async (tx) => {
    const database = tx as unknown as AppDatabase;
    await database.execute(sql`select pg_advisory_xact_lock(hashtext(${`user:${input.sub}`}), hashtext(${input.plane}))`);
    const email = normalizeEmail(input.email);
    const name = cleanText(input.name, 120);
    await database
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        plane: input.plane,
        identitySub: input.sub,
        email,
        name,
      })
      .onConflictDoNothing();

    const [user] = await database
      .select()
      .from(users)
      .where(and(eq(users.plane, input.plane), eq(users.identitySub, input.sub)))
      .limit(1);
    if (!user) throw new Error("user bootstrap failed");

    if (email !== user.email || name !== user.name) {
      await database
        .update(users)
        .set({
          email: email ?? user.email,
          name: name ?? user.name,
        })
        .where(eq(users.id, user.id));
    }

    if (email) {
      const pending = await database
        .select({ id: invites.id, organizationId: invites.organizationId, role: invites.role })
        .from(invites)
        .innerJoin(organizations, eq(invites.organizationId, organizations.id))
        .where(and(eq(organizations.plane, input.plane), eq(invites.email, email)));
      for (const invite of pending) {
        if (!isRole(invite.role) || invite.role === "owner") continue;
        await database
          .insert(memberships)
          .values({ organizationId: invite.organizationId, userId: user.id, role: invite.role })
          .onConflictDoNothing();
        await database.delete(invites).where(eq(invites.id, invite.id));
      }
    }

    let rows = await membershipRows(database, user.id, input.plane);
    if (rows.length === 0) {
      const organizationId = crypto.randomUUID();
      await database.insert(organizations).values({
        id: organizationId,
        plane: input.plane,
        name: "Home organization",
      });
      await database.insert(memberships).values({
        organizationId,
        userId: user.id,
        role: "owner",
      });
      rows = await membershipRows(database, user.id, input.plane);
    }

    const active = rows.find((row) => row.organizationId === user.activeOrganizationId) ?? rows[0];
    if (!active) throw new Error("membership bootstrap failed");
    if (user.activeOrganizationId !== active.organizationId) {
      await database.update(users).set({ activeOrganizationId: active.organizationId }).where(eq(users.id, user.id));
    }

    return {
      userId: user.id,
      plane: input.plane,
      email: email ?? user.email ?? "",
      name: name ?? user.name ?? "",
      simulated: input.simulated,
      organizationId: active.organizationId,
      organizationName: active.name,
      role: active.role,
      memberships: rows.map((row) => ({
        organizationId: row.organizationId,
        name: row.name,
        role: row.role,
      })),
    };
  });
}

async function membershipRows(db: AppDatabase, userId: string, plane: Plane) {
  const rows = await db
    .select({
      organizationId: organizations.id,
      name: organizations.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(and(eq(memberships.userId, userId), eq(organizations.plane, plane)));
  return rows.flatMap((row) => {
    if (!isRole(row.role)) return [];
    return [{ organizationId: row.organizationId, name: row.name, role: row.role }];
  });
}
