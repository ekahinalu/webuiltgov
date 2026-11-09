import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, SignedOut } from "../../../components/chrome";
import { hasRole } from "../../../lib/auth/roles";
import { getPagePrincipal } from "../../../lib/auth/session";
import { formatIsoDate, formatTimestamp } from "../../../lib/dates";
import { getDb } from "../../../lib/db/client";
import { httpsUrl } from "../../../lib/text";
import { KIND_LABEL, LEVEL_LABEL, PIPELINE_LABEL, SOURCE_LABEL, type GovernmentLevel, type RecordKind, type SourceName } from "../../../lib/domain";
import { getOpportunity } from "../../../lib/opportunities/detail";

export const metadata = { title: "Opportunity" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function levelLabel(value: string | null): string | null {
  if (value === "federal" || value === "state" || value === "local" || value === "tribal") {
    return LEVEL_LABEL[value as GovernmentLevel];
  }
  return null;
}

export default async function OpportunityPage({
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
  const record = await getOpportunity(await getDb(), principal, id);
  if (!record) notFound();
  const source = (record.source === "grants.gov" || record.source === "sam.gov" ? SOURCE_LABEL[record.source as SourceName] : record.source);
  const kind = record.recordKind === "grant_opportunity" || record.recordKind === "contract_notice" || record.recordKind === "award_notice"
    ? KIND_LABEL[record.recordKind as RecordKind]
    : record.recordKind;
  const sourceUrl = httpsUrl(record.sourceUrl);
  const cfda = record.sourceFacts.cfdaNumbers?.join(", ") || null;
  const deadline = formatIsoDate(record.deadline);
  return (
    <Shell principal={principal} path="/opportunities" notice={one(query.notice)}>
      <p><Link href="/">Back to search</Link></p>
      <div className="badges">
        <span className={record.recordKind === "award_notice" ? "badge warn" : "badge"}>{kind}</span>
        {levelLabel(record.governmentLevel) ? <span className="badge">{levelLabel(record.governmentLevel)}</span> : null}
      </div>
      <h1>{record.title}</h1>
      {record.recordKind === "award_notice" ? <p className="banner">This is an award notice, not an open solicitation.</p> : null}
      {record.recordKind === "grant_opportunity" ? <p>This is a federal grant opportunity from Grants.gov, not a contract solicitation.</p> : null}
      <section className="card">
        <h2>Record</h2>
        <dl className="facts">
          <div><dt>Agency</dt><dd>{record.agency ?? "Not provided by source"}</dd></div>
          {record.sourceFacts.department ? <div><dt>Department</dt><dd>{record.sourceFacts.department}</dd></div> : null}
          <div><dt>Solicitation number</dt><dd>{record.solicitationNumber ?? "Not provided by source"}</dd></div>
          <div><dt>Government level</dt><dd>{levelLabel(record.governmentLevel) ?? "Not provided by source"}</dd></div>
          <div><dt>Location</dt><dd>{record.location ?? "Not provided by source"}</dd></div>
          <div><dt>NAICS</dt><dd>{record.naics ?? "Not provided by source"}</dd></div>
          <div><dt>Deadline</dt><dd>{deadline ?? "Not provided by source"}</dd></div>
          {cfda ? <div><dt>Assistance listing</dt><dd>{cfda}</dd></div> : null}
          {record.sourceFacts.organizationPath ? <div className="wide"><dt>Organization path</dt><dd>{record.sourceFacts.organizationPath}</dd></div> : null}
          <div className="wide"><dt>Description</dt><dd>{record.description ?? "Not provided by source"}</dd></div>
        </dl>
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Provenance</h2>
        <dl className="facts">
          <div><dt>Source</dt><dd>{source}</dd></div>
          <div><dt>Source id</dt><dd>{record.sourceId}</dd></div>
          <div><dt>Source URL</dt><dd>{sourceUrl ? <a href={sourceUrl} rel="noreferrer">{sourceUrl}</a> : "Not provided by source"}</dd></div>
          <div><dt>Last verified</dt><dd>{formatTimestamp(record.lastVerifiedAt)}</dd></div>
          {record.deadlineRaw ? <div><dt>Source deadline text</dt><dd>{record.deadlineRaw}</dd></div> : null}
          {record.sourceFacts.sourceUpdated ? <div><dt>Source last updated</dt><dd>{record.sourceFacts.sourceUpdated}</dd></div> : null}
          {record.sourceFacts.governmentLevelBasis ? <div className="wide"><dt>Why this level</dt><dd>{record.sourceFacts.governmentLevelBasis}</dd></div> : null}
          {record.sourceFacts.noticeType ? <div><dt>Notice type</dt><dd>{record.sourceFacts.noticeType}</dd></div> : null}
          {record.sourceFacts.oppStatus ? <div><dt>Source status</dt><dd>{record.sourceFacts.oppStatus}</dd></div> : null}
        </dl>
        {record.source === "grants.gov" && hasRole(principal.role, "member") ? (
          <form method="post" action="/api/description" style={{ marginTop: "0.8rem" }}>
            <input type="hidden" name="opportunityId" value={record.id} />
            <button type="submit">Refresh this record from Grants.gov</button>
          </form>
        ) : null}
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Pipeline for {principal.organizationName}</h2>
        <p className="meta">Current status: {record.pipelineStatus && record.pipelineStatus in PIPELINE_LABEL ? PIPELINE_LABEL[record.pipelineStatus as keyof typeof PIPELINE_LABEL] : "Not in pipeline"}</p>
        {hasRole(principal.role, "member") ? (
          <form method="post" action="/api/pipeline" className="inline">
            <input type="hidden" name="opportunityId" value={record.id} />
            <label>
              <span>Status</span>
              <select name="status" defaultValue={record.pipelineStatus ?? "clear"}>
                <option value="clear">Not in pipeline</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="reviewing">Reviewing</option>
                <option value="pursuing">Pursuing</option>
                <option value="passed">Passed</option>
              </select>
            </label>
            <button type="submit">Save</button>
          </form>
        ) : <p>Viewers can read the pipeline and cannot change it.</p>}
        <p style={{ marginTop: "0.8rem" }}>
          <Link href={`/opportunities/${record.id}/eligibility`}>Eligibility gate</Link>
          {" · "}
          <Link href={`/opportunities/${record.id}/pursuit`}>Pursuit recommendation</Link>
          {" · "}
          <Link href={`/opportunities/${record.id}/bid`}>Bid workspace</Link>
          {" · "}
          <Link href={`/opportunities/${record.id}/proposal`}>Proposal</Link>
          {" · "}
          <Link href={`/opportunities/${record.id}/submission`}>Submission</Link>
          {" · "}
          <Link href={`/ai?opportunity=${record.id}`}>Ask AI about this record</Link>
        </p>
      </section>
    </Shell>
  );
}
