export const ROLES = ["viewer", "member", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export const PIPELINE_STATUSES = ["unreviewed", "reviewing", "pursuing", "passed"] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const INVITE_ROLES = ["admin", "member", "viewer"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

const RANK: Record<Role, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

export class AppError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isPipelineStatus(value: unknown): value is PipelineStatus {
  return typeof value === "string" && (PIPELINE_STATUSES as readonly string[]).includes(value);
}

export function hasRole(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

export function assertRole(role: Role, minimum: Role): void {
  if (!hasRole(role, minimum)) {
    throw new AppError("forbidden", "Your role cannot do that.", 403);
  }
}

export function assertCanAssignRole(args: {
  actor: Role;
  current: Role | null;
  next: Role | "remove";
  isSelf: boolean;
  ownerCount: number;
}): void {
  const { actor, current, next, isSelf, ownerCount } = args;
  if (actor !== "owner" && actor !== "admin") {
    throw new AppError("forbidden", "Your role cannot manage members.", 403);
  }
  if (current === "owner" && next !== "owner" && ownerCount <= 1) {
    throw new AppError("last-owner", "The organization needs an owner.", 409);
  }
  if (actor === "owner") {
    if (next === "owner" && current !== "owner") {
      throw new AppError("forbidden", "Ownership is not reassigned here.", 403);
    }
    return;
  }
  if (isSelf) throw new AppError("forbidden", "Admins cannot change their own role.", 403);
  if (current === "owner" || current === "admin" || next === "owner" || next === "admin") {
    throw new AppError("forbidden", "Only an owner can change owners and admins.", 403);
  }
}
