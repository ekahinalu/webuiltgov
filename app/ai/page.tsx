import { Shell, SignedOut } from "../../components/chrome";
import { hasRole } from "../../lib/auth/roles";
import { getPagePrincipal } from "../../lib/auth/session";
import { DEFAULT_XAI_MODEL, getModel, latestAnswer, XAI_BASE_URL, xaiKey } from "../../lib/ai/config";
import { formatTimestamp } from "../../lib/dates";
import { getDb } from "../../lib/db/client";
import { isUuid } from "../../lib/domain";
import { getOpportunity } from "../../lib/opportunities/detail";

export const metadata = { title: "AI" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await getPagePrincipal();
  if (!principal) return <SignedOut />;
  const params = await searchParams;
  const db = await getDb();
  const model = await getModel(db, principal.plane);
  const configured = xaiKey() !== null;
  const answer = await latestAnswer(db, principal);
  const requestedId = one(params.opportunity);
  const linked = isUuid(requestedId) ? await getOpportunity(db, principal, requestedId) : null;
  return (
    <Shell principal={principal} path="/ai" notice={one(params.notice)}>
      <h1>AI</h1>
      <section className="card">
        <h2>xAI configuration</h2>
        <dl className="facts">
          <div className="wide"><dt>Base URL</dt><dd>{XAI_BASE_URL}</dd></div>
          <div><dt>Model</dt><dd>{model}</dd></div>
          <div><dt>Default model</dt><dd>{DEFAULT_XAI_MODEL}</dd></div>
          <div className="wide"><dt>API key</dt><dd>{configured ? "XAI_API_KEY is set on the server." : "XAI_API_KEY is not set. Add that server environment variable to call xAI. Search, sync, and organizations keep working without it."}</dd></div>
        </dl>
        {hasRole(principal.role, "admin") ? (
          <form method="post" action="/api/ai" className="inline" style={{ marginTop: "0.8rem" }}>
            <input type="hidden" name="intent" value="model" />
            <label>
              <span>Model name</span>
              <input name="model" defaultValue={model} required />
            </label>
            <button type="submit">Save model</button>
          </form>
        ) : null}
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Ask about a stored record</h2>
        {configured ? (
          <form method="post" action="/api/ai" className="stack">
            <input type="hidden" name="intent" value="ask" />
            <label>
              <span>Opportunity id</span>
              <input name="opportunityId" defaultValue={linked?.id ?? ""} placeholder="Optional" />
            </label>
            {linked ? <p className="meta">Using “{linked.title}”. Fields the source left empty stay empty in the prompt.</p> : null}
            <label>
              <span>Question</span>
              <textarea name="prompt" maxLength={2000} required placeholder="What is the deadline and agency on this record?" />
            </label>
            <button type="submit">Ask xAI</button>
          </form>
        ) : (
          <p>The model is not called while XAI_API_KEY is missing.</p>
        )}
        {answer ? (
          <div style={{ marginTop: "1rem" }}>
            <p className="meta">{formatTimestamp(answer.createdAt)}</p>
            <p><strong>Question.</strong> {answer.prompt}</p>
            {answer.error ? <p className="banner">{answer.error}</p> : null}
            {answer.answer ? <p className="answer">{answer.answer}</p> : null}
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
