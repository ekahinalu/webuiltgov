import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, SignedOut } from "../../../../components/chrome";
import { hasRole } from "../../../../lib/auth/roles";
import { getPagePrincipal } from "../../../../lib/auth/session";
import { awardWorkspace, type FulfillmentItem } from "../../../../lib/awards/service";
import { formatMoney } from "../../../../lib/bids/model";
import { formatIsoDate, formatTimestamp } from "../../../../lib/dates";
import { getDb } from "../../../../lib/db/client";

export const metadata = { title: "Award" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function ItemList({
  items,
  canEdit,
  opportunityId,
}: {
  items: FulfillmentItem[];
  canEdit: boolean;
  opportunityId: string;
}) {
  if (items.length === 0) return <p>None saved.</p>;
  return (
    <div className="results">
      {items.map((item) => (
        <article key={item.id} className="result">
          <div className="badges">
            <span className={item.completed ? "badge" : "badge warn"}>{item.completed ? "Complete" : "Not complete"}</span>
          </div>
          <h2 style={{ marginTop: "0.55rem" }}>{item.name}</h2>
          <p>Due: {formatIsoDate(item.dueOn) ?? "Not stored"}.</p>
          {item.completed && item.completedByName && item.completedAt ? (
            <p>Checked complete by {item.completedByName} at {formatTimestamp(item.completedAt)}.</p>
          ) : <p>Not marked complete.</p>}
          {canEdit ? (
            <form method="post" action="/api/award" className="inline">
              <input type="hidden" name="intent" value="complete" />
              <input type="hidden" name="opportunityId" value={opportunityId} />
              <input type="hidden" name="itemId" value={item.id} />
              <label>
                <input type="checkbox" name="completed" value="yes" defaultChecked={item.completed} /> Complete
              </label>
              <button type="submit">Save completion</button>
            </form>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export default async function AwardPage({
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
  const view = await awardWorkspace(await getDb(), principal, id);
  if (!view) notFound();
  const canEdit = hasRole(principal.role, "member");
  return (
    <Shell principal={principal} path={`/opportunities/${view.opportunityId}/award`} notice={one(query.notice)}>
      <p><Link href={`/opportunities/${view.opportunityId}`}>Back to {view.solicitationNumber ?? view.title}</Link></p>
      <h1>Award and fulfillment</h1>
      <p>
        {view.title} for {principal.organizationName}. An award is stored only from an amount, a date, and a source that a member types.
        The notice is not turned into an award. No invoice is created, and the amount is not recorded as revenue.
      </p>
      <section className="card">
        <h2>Award</h2>
        {view.award ? (
          <dl className="facts">
            <div><dt>Awarded amount</dt><dd>{formatMoney(view.award.amountCents)}</dd></div>
            <div><dt>Award date</dt><dd>{formatIsoDate(view.award.awardedOn)}</dd></div>
            <div><dt>Source</dt><dd>{view.award.source}</dd></div>
            <div><dt>Entered by</dt><dd>{view.award.enteredByName} at {formatTimestamp(view.award.recordedAt)}</dd></div>
          </dl>
        ) : <p>No award is stored. No fulfillment project exists.</p>}
        {canEdit ? (
          <form method="post" action="/api/award" className="stack" style={{ marginTop: "0.8rem" }}>
            <input type="hidden" name="intent" value="award" />
            <input type="hidden" name="opportunityId" value={view.opportunityId} />
            <label>
              <span>Awarded amount</span>
              <input name="amount" inputMode="decimal" defaultValue="" />
            </label>
            <label>
              <span>Award date</span>
              <input name="awardedOn" type="date" defaultValue="" />
            </label>
            <label>
              <span>Source</span>
              <input name="source" maxLength={300} defaultValue="" />
            </label>
            <button type="submit">{view.award ? "Update award" : "Save award"}</button>
          </form>
        ) : <p>Viewers can read this award and cannot change it.</p>}
      </section>
      {view.award ? (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>Fulfillment project</h2>
          <p>Milestones and obligations stay not complete until a person checks them. A due date can be left blank.</p>
          <h3>Milestones</h3>
          <ItemList items={view.milestones} canEdit={canEdit} opportunityId={view.opportunityId} />
          <h3>Obligations</h3>
          <ItemList items={view.obligations} canEdit={canEdit} opportunityId={view.opportunityId} />
          {canEdit ? (
            <form method="post" action="/api/award" className="stack" style={{ marginTop: "0.8rem" }}>
              <input type="hidden" name="intent" value="item" />
              <input type="hidden" name="opportunityId" value={view.opportunityId} />
              <label>
                <span>Kind</span>
                <select name="kind" defaultValue="milestone">
                  <option value="milestone">Milestone</option>
                  <option value="obligation">Obligation</option>
                </select>
              </label>
              <label>
                <span>Name</span>
                <input name="name" maxLength={200} />
              </label>
              <label>
                <span>Due date</span>
                <input name="dueOn" type="date" />
              </label>
              <button type="submit">Add item</button>
            </form>
          ) : null}
        </section>
      ) : null}
    </Shell>
  );
}
