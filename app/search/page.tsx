import { Shell, SignedOut } from "../../components/chrome";
import { OpportunityCard } from "../../components/opportunity";
import { getPagePrincipal } from "../../lib/auth/session";
import { connectorHealth } from "../../lib/connectors/sync";
import { getDb } from "../../lib/db/client";
import { formatTimestamp } from "../../lib/dates";
import { listAgencies, PAGE_SIZE, parseSearchParams, searchHref, searchOpportunities } from "../../lib/opportunities/search";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await getPagePrincipal();
  if (!principal) return <SignedOut />;
  const params = await searchParams;
  const parsed = parseSearchParams(params);
  const db = await getDb();
  const health = await connectorHealth(db, principal.plane);
  const grants = health.find((item) => item.source === "grants.gov");
  if (!parsed.ok) {
    return (
      <Shell principal={principal} path="/search" notice={one(params.notice)}>
        <h1>Opportunity search</h1>
        <p className="banner">{parsed.message}</p>
      </Shell>
    );
  }
  const [{ rows, total }, agencies] = await Promise.all([
    searchOpportunities(db, principal.plane, principal.organizationId, parsed.query),
    listAgencies(db, principal.plane),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <Shell principal={principal} path="/search" notice={one(params.notice)}>
      <h1>Opportunity search</h1>
      <p>
        Records are copied from source syncs. A blank field means the source did not provide it.
        Pipeline status belongs to {principal.organizationName} only.
      </p>
      {grants?.stale ? (
        <p className="banner">
          Grants.gov is stale{grants.lastSuccessAt ? ` (last success ${formatTimestamp(grants.lastSuccessAt)})` : ""}.
          An owner or admin can sync it from Connectors. No API key is required for Grants.gov.
        </p>
      ) : null}
      <div className="layout">
        <form className="panel" method="get" action="/search">
          <h2>Filters</h2>
          <div className="filters">
            <label>
              <span>Text</span>
              <input name="q" defaultValue={parsed.query.q} placeholder="Title, agency, number" />
            </label>
            <label>
              <span>Government level</span>
              <select name="level" defaultValue={parsed.query.level}>
                <option value="">Any</option>
                <option value="federal">Federal</option>
                <option value="state">State</option>
                <option value="local">Local</option>
                <option value="tribal">Tribal</option>
              </select>
            </label>
            <label>
              <span>Agency</span>
              <input name="agency" defaultValue={parsed.query.agency} list="agencies" />
              <datalist id="agencies">
                {agencies.map((agency) => <option key={agency} value={agency} />)}
              </datalist>
            </label>
            <label>
              <span>Location</span>
              <input name="location" defaultValue={parsed.query.location} />
            </label>
            <label>
              <span>NAICS</span>
              <input name="naics" defaultValue={parsed.query.naics} inputMode="numeric" placeholder="Prefix, such as 236" />
            </label>
            <label>
              <span>Deadline from</span>
              <input name="deadlineFrom" type="date" defaultValue={parsed.query.deadlineFrom} />
            </label>
            <label>
              <span>Deadline to</span>
              <input name="deadlineTo" type="date" defaultValue={parsed.query.deadlineTo} />
            </label>
            <label>
              <span>Source</span>
              <select name="source" defaultValue={parsed.query.source}>
                <option value="">Any synced source</option>
                <option value="grants.gov">Grants.gov</option>
                <option value="sam.gov">SAM.gov</option>
              </select>
            </label>
            <button type="submit">Apply filters</button>
          </div>
        </form>
        <section>
          <p className="meta">{total === 0 ? "No synced opportunities match." : `${total} synced ${total === 1 ? "opportunity matches" : "opportunities match"}.`}</p>
          {total === 0 ? (
            <div className="card">
              <p>The catalog only contains records a connector has stored. An owner or admin can sync the latest 100 posted Grants.gov funding opportunities from Connectors.</p>
            </div>
          ) : (
            <div className="results">
              {rows.map((hit) => <OpportunityCard key={hit.id} hit={hit} />)}
            </div>
          )}
          {pages > 1 ? (
            <div className="pager">
              {parsed.query.page > 1 ? <a href={searchHref(parsed.query, parsed.query.page - 1)}>Previous</a> : <span />}
              <span className="meta">Page {parsed.query.page} of {pages}</span>
              {parsed.query.page < pages ? <a href={searchHref(parsed.query, parsed.query.page + 1)}>Next</a> : <span />}
            </div>
          ) : null}
        </section>
      </div>
    </Shell>
  );
}
