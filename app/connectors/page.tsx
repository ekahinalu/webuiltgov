import { Shell, SignedOut } from "../../components/chrome";
import { hasRole } from "../../lib/auth/roles";
import { getPagePrincipal } from "../../lib/auth/session";
import { connectorHealth, samKeyConfigured } from "../../lib/connectors/sync";
import { formatTimestamp } from "../../lib/dates";
import { getDb } from "../../lib/db/client";

export const metadata = { title: "Connectors" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await getPagePrincipal();
  if (!principal) return <SignedOut />;
  const params = await searchParams;
  const health = await connectorHealth(await getDb(), principal.plane);
  const canSync = hasRole(principal.role, "admin");
  const samReady = samKeyConfigured();
  return (
    <Shell principal={principal} path="/connectors" notice={one(params.notice)}>
      <h1>Connectors</h1>
      <p>A connector is stale when it has no successful sync in the last 24 hours. Sample rows are not mixed into this catalog.</p>
      <div className="results">
        {health.map((connector) => (
          <article key={connector.source} className="card">
            <div className="badges">
              <span className={connector.stale ? "badge warn" : "badge"}>{connector.stale ? "Stale" : "Fresh"}</span>
              {connector.lastStatus ? <span className="badge">{connector.lastStatus}</span> : null}
            </div>
            <h2>{connector.label}</h2>
            {connector.source === "grants.gov" ? (
              <p>Sync stores the latest 100 posted Grants.gov funding opportunities. These are grant opportunities, not contract solicitations. Descriptions are fetched for the first five. No API key is required.</p>
            ) : (
              <p>
                SAM.gov contract opportunities use the documented endpoint <code>https://api.sam.gov/opportunities/v2/search</code>.
                The server reads <strong>SAM_GOV_API_KEY</strong>. {samReady ? "A key is set on this server." : "SAM_GOV_API_KEY is not set, so sync stays paused and does not invent notices."}
                {" "}Award notices are labeled as awards. Solicitation types requested: o, k, p, r, and s, posted in the last 7 days, limit 25.
              </p>
            )}
            <dl className="facts">
              <div><dt>Last attempt</dt><dd>{connector.lastAttemptAt ? formatTimestamp(connector.lastAttemptAt) : "None"}</dd></div>
              <div><dt>Last success</dt><dd>{connector.lastSuccessAt ? formatTimestamp(connector.lastSuccessAt) : "None"}</dd></div>
              <div><dt>Fetched</dt><dd>{connector.fetchedCount ?? "None"}</dd></div>
              <div><dt>Upserted</dt><dd>{connector.upsertedCount ?? "None"}</dd></div>
              {connector.lastError ? <div className="wide"><dt>Last note</dt><dd>{connector.lastError}</dd></div> : null}
            </dl>
            {canSync ? (
              <form method="post" action="/api/sync" style={{ marginTop: "0.8rem" }}>
                <input type="hidden" name="source" value={connector.source} />
                <button type="submit">Sync {connector.label}</button>
              </form>
            ) : <p>Only an owner or admin can sync.</p>}
          </article>
        ))}
      </div>
    </Shell>
  );
}
