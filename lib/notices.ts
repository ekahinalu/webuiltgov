export const NOTICES: Record<string, string> = {
  synced: "Sync finished. Rows in the catalog came from the source response.",
  "sync-skipped": "Sync did not add rows. The connector note explains why.",
  "sync-denied": "Only an owner or admin can sync.",
  "sync-cooldown": "A sync just ran. Wait a moment and try again.",
  "sync-busy": "A sync is already running.",
  "sync-failed": "Sync failed. The connector note has the error.",
  saved: "Pipeline status saved for this organization.",
  forbidden: "Your role cannot do that.",
  renamed: "Organization name saved.",
  switched: "Switched organization.",
  invited: "Invite saved. It applies when that email signs in.",
  "role-updated": "Role updated.",
  removed: "Member removed.",
  "invalid-email": "Enter a valid email.",
  "invalid-name": "Enter an organization name.",
  "already-member": "That person is already in the organization.",
  "last-owner": "The organization needs an owner.",
  "missing-key": "XAI_API_KEY is not set. Search keeps working.",
  asked: "The model response is below.",
  "invalid-prompt": "Enter a question under 2000 characters.",
  "ai-limit": "AI is limited to 8 requests every 10 minutes.",
  "not-found": "That record is not in this catalog.",
  refreshed: "Refreshed this record from Grants.gov.",
  "refresh-failed": "Grants.gov did not return a refreshed record.",
  "refresh-wait": "This record was refreshed moments ago.",
  "invalid-model": "That model name is not valid.",
  "model-saved": "Model name saved for this environment.",
  "invalid-status": "Pipeline status is not recognized.",
};

export function noticeText(code: string | undefined): string | null {
  if (!code) return null;
  return NOTICES[code] ?? null;
}
