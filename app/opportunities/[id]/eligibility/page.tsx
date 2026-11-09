import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, SignedOut } from "../../../../components/chrome";
import { hasRole } from "../../../../lib/auth/roles";
import { getPagePrincipal } from "../../../../lib/auth/session";
import { utcToday } from "../../../../lib/dates";
import { getDb } from "../../../../lib/db/client";
import { SOURCE_LABEL, type SourceName } from "../../../../lib/domain";
import { DISPOSITIONS, DISPOSITION_LABEL } from "../../../../lib/eligibility/model";
import { eligibilityForOpportunity } from "../../../../lib/eligibility/service";
import { getOpportunity } from "../../../../lib/opportunities/detail";
import { CATEGORY_LABEL } from "../../../../lib/readiness/model";
import { listReadiness } from "../../../../lib/readiness/service";

export const metadata = { title: "Eligibility" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function EligibilityPage({
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
  const record = await getOpportunity(db, principal, id);
  if (!record) notFound();
  const gate = await eligibilityForOpportunity(db, principal, id);
  if (!gate) notFound();
  const readiness = await listReadiness(db, principal, utcToday());
  const canEdit = hasRole(principal.role, "member");
  const unmarked = gate.lines.filter((line) => line.disposition === null).length;
  const source = record.source === "grants.gov" || record.source === "sam.gov" ? SOURCE_LABEL[record.source as SourceName] : record.source;
  const incomplete = readiness.records.filter((item) => item.flags.length > 0).length;
  return (
    <Shell principal={principal} path={`/opportunities/${record.id}/eligibility`} notice={one(query.notice)}>
      <p><Link href={`/opportunities/${record.id}`}>Back to {record.solicitationNumber ?? record.title}</Link></p>
      <h1>Eligibility gate</h1>
      <p>
        {record.title} from {source}. Each requirement below is copied from the stored source record.
        A disposition stays unmarked until someone in {principal.organizationName} sets it.
      </p>
      <section className="card">
        <h2>Source requirements</h2>
        {!gate.loaded ? (
          <p>
            <span className="badge warn">Not loaded</span>{" "}
            {record.source === "grants.gov"
              ? "This stored Grants.gov record has no applicant-type list. Refresh the record from the opportunity page to copy the types on the notice. No requirements were added."
              : "This source record has no stored applicant-type list. No requirements were added."}
          </p>
        ) : null}
        {gate.loaded && gate.lines.length === 0 ? (
          <p><span className="badge warn">None listed</span> The stored detail did not include applicant types. No requirements were added.</p>
        ) : null}
        {gate.loaded && gate.lines.length > 0 ? (
          <p>{gate.lines.length} applicant types are on the stored record. {unmarked} are not marked.</p>
        ) : null}
        {gate.costSharing === true ? <p>Grants.gov says cost sharing is required. That source fact is not a company credential and is not marked.</p> : null}
        {gate.costSharing === false ? <p>Grants.gov says cost sharing is not required. That source fact is not a company credential and is not marked.</p> : null}
        {gate.loaded && gate.costSharing === null ? <p>Cost sharing was not on the stored detail.</p> : null}
        <div className="results" style={{ marginTop: "0.8rem" }}>
          {gate.lines.map((line) => (
            <article key={line.sourceKey} className="result">
              <div className="badges">
                <span className="badge">{line.sourceLabel}</span>
                {line.disposition ? <span className="badge">{DISPOSITION_LABEL[line.disposition]}</span> : <span className="badge warn">Not marked</span>}
              </div>
              <h2 style={{ marginTop: "0.6rem" }}>{line.text}</h2>
              {canEdit ? (
                <form method="post" action="/api/eligibility" className="inline">
                  <input type="hidden" name="opportunityId" value={record.id} />
                  <input type="hidden" name="sourceKey" value={line.sourceKey} />
                  <label>
                    <span>Disposition</span>
                    <select name="disposition" defaultValue={line.disposition ?? ""}>
                      <option value="">Not marked</option>
                      {DISPOSITIONS.map((item) => (
                        <option key={item} value={item}>{DISPOSITION_LABEL[item]}</option>
                      ))}
                    </select>
                  </label>
                  <button type="submit">Save mark</button>
                </form>
              ) : <p className="meta">Viewers can read marks and cannot change them.</p>}
            </article>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Readiness beside this gate</h2>
        <p>Missing and expiring company records are listed here. They do not set a disposition.</p>
        <p>
          {readiness.missing.length === 0
            ? "Every readiness category has at least one record."
            : `No records on file: ${readiness.missing.map((category) => CATEGORY_LABEL[category]).join(", ")}.`}
          {" "}
          {incomplete} stored records have blank or expiring fields.
        </p>
        <p><Link href="/readiness">Open company readiness</Link></p>
      </section>
    </Shell>
  );
}
