import { principalFromRequest } from "../../../../lib/http";
import { getDb } from "../../../../lib/db/client";
import { proposalPdf } from "../../../../lib/proposals/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const principal = await principalFromRequest(request);
  if (!principal) return new Response("Sign in required.", { status: 401 });
  const opportunityId = new URL(request.url).searchParams.get("opportunityId") ?? "";
  const pdf = await proposalPdf(await getDb(), principal, opportunityId);
  if (!pdf) return new Response("That record is not in this catalog.", { status: 404 });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="proposal.pdf"',
      "cache-control": "private, no-store",
    },
  });
}
