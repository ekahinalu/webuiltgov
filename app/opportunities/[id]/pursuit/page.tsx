import Link from "next/link";
import { notFound } from "next/navigation";
import { xaiKey } from "../../../../lib/ai/config";
import { hasRole } from "../../../../lib/auth/roles";
import { getPagePrincipal } from "../../../../lib/auth/session";
import { Shell, SignedOut } from "../../../../components/chrome";
import { formatIsoDate, formatTimestamp, utcToday } from "../../../../lib/dates";
import { getDb } from "../../../../lib/db/client";
import { SOURCE_LABEL, type SourceName } from "../../../../lib/domain";
import { DISPOSITION_LABEL } from "../../../../lib/eligibility/model";
import { httpsUrl } from "../../../../lib/text";
import { CATEGORY_LABEL, STATUS_LABEL, type ReadinessStatus } from "../../../../lib/readiness/model";
import { RECOMMENDATION_LABEL, RECOMMENDATIONS } from "../../../../lib/pursuit/model";
import { pursuitView } from "../../../../lib/pursuit/service";

export const metadata = { title: "Pursuit" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function shown(value: string | null): string {
  return value && value.trim() !== "" ? value : "Not stored";
}

export default async function PursuitPage({
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
  const view = await pursuitView(await getDb(), principal, id, utcToday());
  if (!view) notFound();
  const canEdit = hasRole(principal.role, "member");
  const keyConfigured = xaiKey() !== null;
  const source = view.source === "grants.gov" || view.source === "sam.gov" ? SOURCE_LABEL[view.source as SourceName] : view.source;
  const sourceUrl = httpsUrl(view.sourceUrl);
  const deadline = formatIsoDate(view.deadline);
  const overridden = view.decision !== null && view.decision.recommendation !== view.suggestion.recommendation;
  return (
    <Shell principal={principal} path={`/opportunities/${view.opportunityId}/pursuit`} notice={one(query.notice)}>
      <p>
        <Link href={`/opportunities/${view.opportunityId}`}>Back to {view.solicitationNumber ?? view.title}</Link>
      </p>
      <h1>Pursuit recommendation</h1>
      <p>
        {view.title} from {source}. The suggestion is a rule over stored fields for {principal.organizationName}. It is not a win probability.
        Partner required and no-bid are not suggested. A person can set them and must enter a reason.
      </p>
      <section className="card">
        <h2>Capture note</h2>
        <dl className="facts">
          <div><dt>Agency</dt><dd>{shown(view.agency)}</dd></div>
          <div><dt>Solicitation number</dt><dd>{shown(view.solicitationNumber)}</dd></div>
          <div><dt>Deadline</dt><dd>{deadline ?? "Not stored"}</dd></div>
          <div><dt>Source deadline text</dt><dd>{shown(view.deadlineRaw)}</dd></div>
          <div className="wide"><dt>Source</dt><dd>{sourceUrl ? <a href={sourceUrl} rel="noreferrer">{sourceUrl}</a> : shown(view.sourceUrl)}</dd></div>
          <div className="wide"><dt>What the stored notice says</dt><dd className="answer">{shown(view.notice)}</dd></div>
        </dl>
        <h3 style={{ marginTop: "1rem" }}>Gaps</h3>
        {view.gaps.length === 0 ? <p>No gaps were found in the stored fields used by the suggestion.</p> : (
          <ul>
            {view.gaps.map((gap, index) => <li key={`${index}:${gap}`}>{gap}</li>)}
          </ul>
        )}
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Fit from stored records</h2>
        <p>Eligibility marks are for this opportunity. Readiness records belong to {principal.organizationName} and are not specific to this notice.</p>
        <p>
          <span className="badge">{RECOMMENDATION_LABEL[view.suggestion.recommendation]}</span>
        </p>
        <p>{view.suggestion.rule}</p>
        {view.costSharing === true ? <p>Grants.gov stored cost sharing as required. That fact is not a credential and is not a mark.</p> : null}
        {view.costSharing === false ? <p>Grants.gov stored cost sharing as not required. That fact is not a credential and is not a mark.</p> : null}
        {view.costSharing === null ? <p>Cost sharing was not stored.</p> : null}
        <div className="results" style={{ marginTop: "0.8rem" }}>
          {view.fit.lines.map((line, index) => (
            <article key={`${index}:${line.text}`} className="result">
              <div className="badges">
                <span className="badge">{line.sourceLabel}</span>
                {line.disposition ? <span className="badge">{DISPOSITION_LABEL[line.disposition]}</span> : <span className="badge warn">Not marked</span>}
              </div>
              <p style={{ marginTop: "0.45rem" }}>{line.text}</p>
            </article>
          ))}
          {view.fit.eligibilityLoaded && view.fit.lines.length === 0 ? <p>The stored detail listed no applicant types.</p> : null}
          {!view.fit.eligibilityLoaded ? <p>Applicant types are not stored on this record.</p> : null}
        </div>
        <h3 style={{ marginTop: "1rem" }}>Readiness</h3>
        {view.fit.missingCategories.length > 0 ? (
          <p>No records stored: {view.fit.missingCategories.map((category) => CATEGORY_LABEL[category]).join(", ")}.</p>
        ) : <p>Every readiness category has at least one stored record.</p>}
        <div className="results">
          {view.fit.records.map((record, index) => (
            <article key={`${record.category}:${record.label ?? "blank"}:${index}`} className="result">
              <div className="badges">
                <span className="badge">{CATEGORY_LABEL[record.category]}</span>
                {record.flags.length === 0 ? <span className="badge">No blank or expiring fields</span> : record.flags.map((flag) => <span key={flag} className="badge warn">{flag}</span>)}
              </div>
              <dl className="facts" style={{ marginTop: "0.6rem" }}>
                <div><dt>Label</dt><dd>{shown(record.label)}</dd></div>
                <div><dt>Recorded value</dt><dd>{shown(record.recordedValue)}</dd></div>
                <div><dt>Status</dt><dd>{record.status && record.status in STATUS_LABEL ? STATUS_LABEL[record.status as ReadinessStatus] : "Not stored"}</dd></div>
                <div><dt>Source</dt><dd>{shown(record.source)}</dd></div>
                <div><dt>Verification date</dt><dd>{record.verifiedOn ? formatIsoDate(record.verifiedOn) : "Not stored"}</dd></div>
                <div><dt>Expiration</dt><dd>{record.expiresOn ? formatIsoDate(record.expiresOn) : "Not stored"}</dd></div>
                <div><dt>Responsible person</dt><dd>{shown(record.responsiblePerson)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Model draft</h2>
        {keyConfigured ? (
          <p>XAI_API_KEY is set. Asking Grok sends this page&apos;s stored capture note, eligibility marks, and readiness records. The request does not add awards, competitors, credentials, or a win probability.</p>
        ) : (
          <p>XAI_API_KEY is not set. Grok was not called. The suggestion uses only stored fields.</p>
        )}
        {view.draft ? (
          <div>
            <p className="meta">Model {view.draft.model}. {formatTimestamp(view.draft.updatedAt)}. This draft is not a stored source record and is not the recommendation.</p>
            {view.draft.draft ? <p className="answer">{view.draft.draft}</p> : null}
            {view.draft.error ? <p>{view.draft.error}</p> : null}
          </div>
        ) : null}
        {canEdit && keyConfigured ? (
          <form method="post" action="/api/pursuit">
            <input type="hidden" name="intent" value="draft" />
            <input type="hidden" name="opportunityId" value={view.opportunityId} />
            <button type="submit">Ask Grok to draft from stored records</button>
          </form>
        ) : null}
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Recommendation for {principal.organizationName}</h2>
        {view.decision ? (
          <>
            <p>
              <span className="badge">{RECOMMENDATION_LABEL[view.decision.recommendation]}</span>
              {" "}
              {overridden ? "This overrides the suggestion." : "This matches the suggestion."}
            </p>
            <p>{view.decision.reason}</p>
            <p className="meta">Saved {formatTimestamp(view.decision.updatedAt)}.</p>
          </>
        ) : <p>No recommendation has been saved. The suggestion above is not a decision.</p>}
        {canEdit ? (
          <form method="post" action="/api/pursuit" className="stack">
            <input type="hidden" name="intent" value="save" />
            <input type="hidden" name="opportunityId" value={view.opportunityId} />
            <label>
              <span>Recommendation</span>
              <select name="recommendation" defaultValue={view.decision?.recommendation ?? ""} required>
                <option value="">Choose a recommendation</option>
                {RECOMMENDATIONS.map((item) => (
                  <option key={item} value={item}>{RECOMMENDATION_LABEL[item]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Reason</span>
              <textarea name="reason" maxLength={2000} required defaultValue={view.decision?.reason ?? ""} />
            </label>
            <button type="submit">Save recommendation</button>
          </form>
        ) : <p>Viewers can read the recommendation and cannot change it.</p>}
      </section>
    </Shell>
  );
}
