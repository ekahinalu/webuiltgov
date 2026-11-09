export type IdentityResult =
  | { verified: false; reason: string }
  | {
      verified: true;
      simulated: boolean;
      token: string;
      sub: string;
      email: string;
      emailVerified: boolean;
      name: string;
      kind: "person" | "key";
      stage: "production" | "preview";
      userId?: number;
    };

export function getIdentity(request: unknown): Promise<IdentityResult>;

export function requireIdentity(
  request: unknown,
  options?: { onFailure?: "throw" },
): Promise<Exclude<IdentityResult, { verified: false }> | Response>;
