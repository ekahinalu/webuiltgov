import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, SignedOut } from "../../../../components/chrome";
import { hasRole } from "../../../../lib/auth/roles";
import { getPagePrincipal } from "../../../../lib/auth/session";
import { BID_STAGE_LABEL } from "../../../../lib/bids/model";
import { formatTimestamp } from "../../../../lib/dates";
import { getDb } from "../../../../lib/db/client";
import { priceChecklistText } from "../../../../lib/submissions/model";
import { submissionWorkspace } from "../../../../lib/submissions/service";

export const metadata = { title: "Submission" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function datetimeValue(value: Date): string {
  return value.toISOString().slice(0, 16);
}

export default async function SubmissionPage({
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
  const view = await submissionWorkspace(await getDb(), principal, id);
  if (!view) notFound();
  const canEdit = hasRole(principal.role, "member");
  const sections = view.checklist.filter((line) => line.kind === "section");
  const matrix = view.checklist.filter((line) => line.kind === "matrix");
  return (
    <Shell principal={principal} path={`/opportunities/${view.opportunityId}/submission`} notice={one(query.notice)}>
      <p><Link href={`/opportunities/${view.opportunityId}`}>Back to {view.solicitationNumber ?? view.title}</Link></p>
      <h1>Submission</h1>
      <p>
        {view.title} for {principal.organizationName}. This page does not call a government portal or send email.
        An internal approval does not mark the bid submitted.
      </p>
      <section className="card">
        <h2>Checklist</h2>
        <p>These lines come from the proposal sections and the requirement matrix already stored for this opportunity.</p>
        <div className="results">
          {sections.map((line) => (
            <article key={line.key} className="result">
              <div className="badges">
                <span className="badge">Proposal section</span>
                <span className={line.state === "saved" ? "badge" : "badge warn"}>{line.state === "saved" ? "Saved" : "Empty"}</span>
              </div>
              <h2 style={{ marginTop: "0.55rem" }}>{line.label}</h2>
            </article>
          ))}
        </div>
        <h3>Requirement matrix</h3>
        {!view.matrixLoaded ? <p>Applicant types are not stored on this notice. No matrix lines were added.</p> : null}
        {view.matrixLoaded && matrix.length === 0 ? <p>The stored notice did not list applicant types. No matrix lines were added.</p> : null}
        <div className="results">
          {matrix.map((line) => (
            <article key={line.key} className="result">
              <div className="badges">
                <span className="badge">Requirement matrix</span>
                <span className={line.state === "saved" ? "badge" : "badge warn"}>{line.state === "saved" ? "Saved" : "Empty"}</span>
              </div>
              <h2 style={{ marginTop: "0.55rem" }}>{line.label}</h2>
              {line.detail ? <p>{line.detail}</p> : <p>No section or completion is stored.</p>}
            </article>
          ))}
        </div>
        <p>{priceChecklistText(view.priceState)}</p>
        {view.priceState === "approved" && view.priceApprovedByName && view.priceApprovedAt ? (
          <p className="meta">Approved by {view.priceApprovedByName} at {formatTimestamp(view.priceApprovedAt)}.</p>
        ) : null}
        <p>{view.bidStage ? `Bid stage: ${BID_STAGE_LABEL[view.bidStage]}.` : "No bid is open."} {view.submission ? "A submission record is stored." : "The bid is not submitted."}</p>
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Internal approval</h2>
        {view.approval ? (
          <p>Recorded by {view.approval.name} at {formatTimestamp(view.approval.at)}. This did not mark the bid submitted.</p>
        ) : <p>No internal approval is recorded.</p>}
        {canEdit ? (
          <form method="post" action="/api/submission">
            <input type="hidden" name="intent" value="approve" />
            <input type="hidden" name="opportunityId" value={view.opportunityId} />
            <button type="submit">Record internal approval</button>
          </form>
        ) : null}
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Submission record</h2>
        <p>A submission is stored only when a confirmation number, an official destination, and a time are all entered. The time is stored as entered and shown in UTC.</p>
        {view.submission ? (
          <dl className="facts">
            <div><dt>Confirmation number</dt><dd>{view.submission.confirmationNumber}</dd></div>
            <div><dt>Official destination</dt><dd>{view.submission.destination}</dd></div>
            <div><dt>Time entered</dt><dd>{formatTimestamp(view.submission.submittedAt)}</dd></div>
            <div><dt>Entered by</dt><dd>{view.submission.enteredByName} at {formatTimestamp(view.submission.recordedAt)}</dd></div>
          </dl>
        ) : <p>No submission is recorded.</p>}
        {canEdit ? (
          <form method="post" action="/api/submission" className="stack" style={{ marginTop: "0.8rem" }}>
            <input type="hidden" name="intent" value="submit" />
            <input type="hidden" name="opportunityId" value={view.opportunityId} />
            <label>
              <span>Confirmation number</span>
              <input name="confirmationNumber" maxLength={200} defaultValue={view.submission?.confirmationNumber ?? ""} />
            </label>
            <label>
              <span>Official destination</span>
              <input name="destination" maxLength={500} defaultValue={view.submission?.destination ?? ""} />
            </label>
            <label>
              <span>Time</span>
              <input name="submittedAt" type="datetime-local" defaultValue={view.submission ? datetimeValue(view.submission.submittedAt) : ""} />
            </label>
            <button type="submit">Record submission</button>
          </form>
        ) : <p>Viewers can read this submission and cannot change it.</p>}
      </section>
    </Shell>
  );
}
