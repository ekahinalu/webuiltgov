import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, SignedOut } from "../../../../components/chrome";
import { hasRole } from "../../../../lib/auth/roles";
import { getPagePrincipal } from "../../../../lib/auth/session";
import {
  BID_STAGE_LABEL,
  BID_STAGES,
  COLUMN_LABEL,
  COST_LABEL,
  COST_LINES,
  describeTotal,
  fieldName,
  MAIN_BID_STAGES,
  MONEY_COLUMNS,
  moneyInput,
  formatMoney,
} from "../../../../lib/bids/model";
import { bidWorkspace } from "../../../../lib/bids/service";
import { formatTimestamp } from "../../../../lib/dates";
import { getDb } from "../../../../lib/db/client";
import { PIPELINE_LABEL } from "../../../../lib/domain";
import { quoteWorkspace } from "../../../../lib/quotes/service";

export const metadata = { title: "Bid" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function BidPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await getPagePrincipal();
  if (!principal) return <SignedOut />;
  const { id } = await params;
  const query = await searchParams;
  const db = await getDb();
  const workspace = await bidWorkspace(db, principal, id);
  if (!workspace) notFound();
  const quotes = await quoteWorkspace(db, principal, id);
  const canEdit = hasRole(principal.role, "member");
  const bid = workspace.bid;
  const pipeline = workspace.pipelineStatus && workspace.pipelineStatus in PIPELINE_LABEL
    ? PIPELINE_LABEL[workspace.pipelineStatus as keyof typeof PIPELINE_LABEL]
    : "Not in pipeline";
  return (
    <Shell principal={principal} path={`/opportunities/${workspace.opportunityId}/bid`} notice={one(query.notice)}>
      <p><Link href={`/opportunities/${workspace.opportunityId}`}>Back to {workspace.solicitationNumber ?? workspace.title}</Link></p>
      <h1>Bid workspace</h1>
      <p>
        {workspace.title} for {principal.organizationName}. Costs stay blank until someone enters them.
        The proposed price stays a draft until a member approves it.
      </p>
      <section className="card">
        <h2>Status</h2>
        <p>Pipeline status: {pipeline}. Changing the bid stage does not change the pipeline.</p>
        {bid ? (
          <>
            <p>Current bid stage: {BID_STAGE_LABEL[bid.stage]}.</p>
            <ol>
              {MAIN_BID_STAGES.map((stage) => (
                <li key={stage}>{bid.stage === stage ? <strong>{BID_STAGE_LABEL[stage]}</strong> : BID_STAGE_LABEL[stage]}</li>
              ))}
            </ol>
            <p className="meta">
              Closed can be selected here. Submitted is recorded on the{" "}
              <Link href={`/opportunities/${workspace.opportunityId}/submission`}>submission page</Link>
              {" "}and is not a choice in this form.
            </p>
            {canEdit ? (
              <form method="post" action="/api/bid" className="inline">
                <input type="hidden" name="intent" value="stage" />
                <input type="hidden" name="opportunityId" value={workspace.opportunityId} />
                <label>
                  <span>Move stage</span>
                  <select name="stage" defaultValue={bid.stage === "submitted" ? "" : bid.stage}>
                    {bid.stage === "submitted" ? <option value="">Submitted</option> : null}
                    {BID_STAGES.filter((stage) => stage !== "submitted").map((stage) => (
                      <option key={stage} value={stage}>{BID_STAGE_LABEL[stage]}</option>
                    ))}
                  </select>
                </label>
                <button type="submit">Save stage</button>
              </form>
            ) : <p>Viewers can read this bid and cannot change it.</p>}
          </>
        ) : (
          <>
            <p>No bid is open for this organization.</p>
            {canEdit ? (
              <form method="post" action="/api/bid">
                <input type="hidden" name="intent" value="open" />
                <input type="hidden" name="opportunityId" value={workspace.opportunityId} />
                <button type="submit">Open bid</button>
              </form>
            ) : <p>Viewers can read a bid and cannot open one.</p>}
            <p>Vendors and quotes appear after a bid is open. None are added until someone types them.</p>
          </>
        )}
      </section>
      {bid ? (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>Estimate</h2>
          <p>Low, expected, and high totals are sums of the amounts entered in that column. A blank is not treated as zero.</p>
          {canEdit ? (
            <form method="post" action="/api/bid" className="stack">
              <input type="hidden" name="intent" value="estimate" />
              <input type="hidden" name="opportunityId" value={workspace.opportunityId} />
              <div className="stack">
                {COST_LINES.map((line) => (
                  <fieldset key={line} className="stack">
                    <legend>{COST_LABEL[line]}</legend>
                    <div className="money-grid">
                      {MONEY_COLUMNS.map((column) => (
                        <label key={column}>
                          <span>{COLUMN_LABEL[column]}</span>
                          <input
                            name={fieldName(line, column)}
                            inputMode="decimal"
                            defaultValue={moneyInput(bid.amounts[line][column])}
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <label>
                <span>Proposed price</span>
                <input name="proposedPrice" inputMode="decimal" defaultValue={moneyInput(bid.proposedPrice)} />
              </label>
              <button type="submit">Save estimate</button>
            </form>
          ) : (
            <div className="stack">
              {COST_LINES.map((line) => (
                <div key={line}>
                  <h3>{COST_LABEL[line]}</h3>
                  <dl className="facts">
                    {MONEY_COLUMNS.map((column) => {
                      const amount = bid.amounts[line][column];
                      return (
                        <div key={column}>
                          <dt>{COLUMN_LABEL[column]}</dt>
                          <dd>{amount === null ? "Not entered" : formatMoney(amount)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>
          )}
          <dl className="facts" style={{ marginTop: "0.8rem" }}>
            {MONEY_COLUMNS.map((column) => (
              <div key={column}>
                <dt>{COLUMN_LABEL[column]} total</dt>
                <dd>{describeTotal(bid.totals[column])}</dd>
              </div>
            ))}
            <div>
              <dt>Proposed price</dt>
              <dd>
                {bid.proposedPrice === null ? "Not entered" : formatMoney(bid.proposedPrice)}
                {bid.priceState === "draft" ? " — draft" : ""}
                {bid.priceState === "approved" && bid.approvedByName && bid.approvedAt
                  ? ` — approved by ${bid.approvedByName} at ${formatTimestamp(bid.approvedAt)}`
                  : ""}
              </dd>
            </div>
          </dl>
          {canEdit && bid.priceState === "draft" ? (
            <form method="post" action="/api/bid">
              <input type="hidden" name="intent" value="approve" />
              <input type="hidden" name="opportunityId" value={workspace.opportunityId} />
              <button type="submit">Approve proposed price</button>
            </form>
          ) : null}
          {canEdit ? <p className="meta">Saving a changed estimate returns an approved price to draft.</p> : null}
        </section>
      ) : null}
      {bid && quotes?.bidOpen ? (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>Vendors and quotes</h2>
          <p>
            Vendors and quotes stay in {principal.organizationName}. They are not emailed or shared outside this organization.
            Compared by the amounts entered, lowest first.
          </p>
          <h3>Vendors</h3>
          {quotes.vendors.length === 0 ? <p>No vendors are saved.</p> : null}
          <div className="results">
            {quotes.vendors.map((vendor) => (
              <article key={vendor.id} className="result">
                <h2>{vendor.name}</h2>
                <p>Trade: {vendor.trade ?? "Not stored"}.</p>
              </article>
            ))}
          </div>
          {canEdit ? (
            <form method="post" action="/api/quotes" className="stack" style={{ marginTop: "0.8rem" }}>
              <input type="hidden" name="intent" value="vendor" />
              <input type="hidden" name="opportunityId" value={workspace.opportunityId} />
              <label>
                <span>Vendor name</span>
                <input name="name" maxLength={200} />
              </label>
              <label>
                <span>Trade</span>
                <input name="trade" maxLength={200} />
              </label>
              <button type="submit">Save vendor</button>
            </form>
          ) : null}
          <h3>Quotes for this bid</h3>
          <p>{quotes.summary}</p>
          {quotes.quotes.length === 0 ? null : (
            <div className="results">
              {quotes.quotes.map((quote) => (
                <article key={quote.id} className="result">
                  <p>{formatMoney(quote.amountCents)}</p>
                  <h2>{quote.vendorName}</h2>
                  <p>Trade: {quote.trade ?? "Not stored"}.</p>
                  <p>{quote.covers}</p>
                </article>
              ))}
            </div>
          )}
          {canEdit && quotes.vendors.length > 0 ? (
            <form method="post" action="/api/quotes" className="stack" style={{ marginTop: "0.8rem" }}>
              <input type="hidden" name="intent" value="quote" />
              <input type="hidden" name="opportunityId" value={workspace.opportunityId} />
              <label>
                <span>Vendor</span>
                <select name="vendorId" defaultValue="">
                  <option value="">Choose a saved vendor</option>
                  {quotes.vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.trade ? `${vendor.name}, ${vendor.trade}` : vendor.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Amount</span>
                <input name="amount" inputMode="decimal" />
              </label>
              <label>
                <span>What it covers</span>
                <input name="covers" maxLength={500} />
              </label>
              <button type="submit">Save quote</button>
            </form>
          ) : null}
          {canEdit && quotes.vendors.length === 0 ? <p>Add a vendor before entering a quote.</p> : null}
          {!canEdit ? <p>Viewers can read vendors and quotes and cannot add them.</p> : null}
        </section>
      ) : null}
    </Shell>
  );
}
