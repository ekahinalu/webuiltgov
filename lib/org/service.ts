import { and, eq, sql } from "drizzle-orm";
import { assertCanAssignRole, assertRole, isRole, type InviteRole, type Role } from "../auth/roles";
import { normalizeEmail, type Principal } from "../auth/principal";
import { AppError } from "../auth/roles";
import type { AppDatabase } from "../db/client";
import { invites, memberships, organizations, users } from "../db/schema";
import { cleanText } from "../text";

export async function renameOrganization(db: AppDatabase, principal: Principal, name: string): Promise<void> {
  assertRole(principal.role, "admin");
  const cleaned = cleanText(name, 80);
  if (!cleaned) throw new AppError("invalid-name", "Enter an organization name.", 400);
  await db
    .update(organizations)
    .set({ name: cleaned })
    .where(and(eq(organizations.id, principal.organizationId), eq(organizations.plane, principal.plane)));
}

export async function switchOrganization(db: AppDatabase, principal: Principal, organizationId: string): Promise<void> {
  const membership = principal.memberships.find((item) => item.organizationId === organizationId);
  if (!membership) throw new AppError("forbidden", "You are not a member of that organization.", 403);
  await db.update(users).set({ activeOrganizationId: organizationId }).where(eq(users.id, principal.userId));
}

export async function listMembers(db: AppDatabase, principal: Principal) {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(and(eq(memberships.organizationId, principal.organizationId), eq(organizations.plane, principal.plane)));
  return rows.flatMap((row) => (isRole(row.role) ? [{ ...row, role: row.role }] : []));
}

export async function listInvites(db: AppDatabase, principal: Principal) {
  assertRole(principal.role, "admin");
  return db
    .select({ id: invites.id, email: invites.email, role: invites.role })
    .from(invites)
    .where(eq(invites.organizationId, principal.organizationId));
}

async function ownerCount(db: AppDatabase, organizationId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.role, "owner")));
  return Number(row?.total ?? 0);
}

export async function inviteMember(
  db: AppDatabase,
  principal: Principal,
  emailInput: string,
  role: InviteRole,
): Promise<void> {
  const email = normalizeEmail(emailInput);
  if (!email) throw new AppError("invalid-email", "Enter a valid email.", 400);
  const owners = await ownerCount(db, principal.organizationId);
  assertCanAssignRole({ actor: principal.role, current: null, next: role, isSelf: false, ownerCount: owners });
  const members = await listMembers(db, principal);
  if (members.some((member) => member.email === email)) {
    throw new AppError("already-member", "That person is already in the organization.", 409);
  }
  await db
    .insert(invites)
    .values({
      id: crypto.randomUUID(),
      organizationId: principal.organizationId,
      email,
      role,
      createdBy: principal.userId,
    })
    .onConflictDoUpdate({
      target: [invites.organizationId, invites.email],
      set: { role, createdBy: principal.userId },
    });
}

export async function setMemberRole(
  db: AppDatabase,
  principal: Principal,
  userId: string,
  next: Role | "remove",
): Promise<void> {
  const [member] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.organizationId, principal.organizationId), eq(memberships.userId, userId)))
    .limit(1);
  if (!member || !isRole(member.role)) throw new AppError("not-found", "Member not found.", 404);
  const owners = await ownerCount(db, principal.organizationId);
  assertCanAssignRole({
    actor: principal.role,
    current: member.role,
    next,
    isSelf: userId === principal.userId,
    ownerCount: owners,
  });
  if (next === "remove") {
    await db
      .delete(memberships)
      .where(and(eq(memberships.organizationId, principal.organizationId), eq(memberships.userId, userId)));
    if (userId === principal.userId) {
      await db.update(users).set({ activeOrganizationId: null }).where(eq(users.id, userId));
    }
    return;
  }
  await db
    .update(memberships)
    .set({ role: next })
    .where(and(eq(memberships.organizationId, principal.organizationId), eq(memberships.userId, userId)));
}
