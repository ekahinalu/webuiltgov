import { describe, expect, it } from "vitest";
import { AppError, assertCanAssignRole } from "../lib/auth/roles";

describe("role changes", () => {
  it("lets an owner change a member and blocks removing the last owner", () => {
    expect(() =>
      assertCanAssignRole({ actor: "owner", current: "member", next: "viewer", isSelf: false, ownerCount: 1 }),
    ).not.toThrow();
    expect(() =>
      assertCanAssignRole({ actor: "owner", current: "owner", next: "remove", isSelf: true, ownerCount: 1 }),
    ).toThrow(AppError);
  });

  it("stops admins from changing owners, admins, or themselves", () => {
    expect(() =>
      assertCanAssignRole({ actor: "admin", current: "member", next: "viewer", isSelf: false, ownerCount: 1 }),
    ).not.toThrow();
    expect(() =>
      assertCanAssignRole({ actor: "admin", current: "owner", next: "member", isSelf: false, ownerCount: 2 }),
    ).toThrow(AppError);
    expect(() =>
      assertCanAssignRole({ actor: "admin", current: "admin", next: "member", isSelf: true, ownerCount: 1 }),
    ).toThrow(AppError);
    expect(() =>
      assertCanAssignRole({ actor: "viewer", current: "member", next: "viewer", isSelf: false, ownerCount: 1 }),
    ).toThrow(AppError);
  });
});
