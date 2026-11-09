import { ReadinessFields } from "../../components/readiness-fields";
import { Shell, SignedOut } from "../../components/chrome";
import { hasRole } from "../../lib/auth/roles";
import { getPagePrincipal } from "../../lib/auth/session";
import { formatIsoDate, utcToday } from "../../lib/dates";
import { getDb } from "../../lib/db/client";
import { CATEGORY_LABEL, READINESS_CATEGORIES, STATUS_LABEL, type ReadinessCategory } from "../../lib/readiness/model";
import { listReadiness, type ReadinessRow } from "../../lib/readiness/service";

export const metadata = { title: "Readiness" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function shown(value: string | null): string {
  return value && value.trim() !== "" ? value : "Blank";
}

export default async function ReadinessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await getPagePrincipal();
  if (!principal) return <SignedOut />;
  const params = await searchParams;
  const today = utcToday();
  const { records, missing } = await listReadiness(await getDb(), principal, today);
  const canEdit = hasRole(principal.role, "member");
  const expired = records.filter((record) => record.flags.includes("expired"));
  const expiring = records.filter((record) => record.flags.includes("expiring"));
  const grouped = new Map<ReadinessCategory, ReadinessRow[]>();
  for (const category of READINESS_CATEGORIES) grouped.set(category, []);
  for (const record of records) grouped.get(record.category)?.push(record);
  return (
    <Shell principal={principal} path="/readiness" notice={one(params.notice)}>
      <h1>Company readiness</h1>
      <p>
        These records belong to {principal.organizationName}. Blank fields stay blank and are flagged.
        Nothing on this page is filled from an opportunity or from a guessed credential.
      </p>
      <section className="card">
        <h2>Missing or expiring</h2>
        <div className="badges">
          <span className="badge warn">{missing.length} categories have no records</span>
          <span className={expired.length > 0 ? "badge warn" : "badge"}>{expired.length} expired</span>
          <span className={expiring.length > 0 ? "badge warn" : "badge"}>{expiring.length} expiring within 30 days</span>
        </div>
        {missing.length > 0 ? (
          <p style={{ marginTop: "0.8rem" }}>No records on file: {missing.map((category) => CATEGORY_LABEL[category]).join(", ")}.</p>
        ) : <p style={{ marginTop: "0.8rem" }}>Every category has at least one record. Open records still flag blank fields.</p>}
        <p className="meta">A stored status is only what someone typed. Expired and expiring flags come from the expiration date, compared with {formatIsoDate(today)} UTC.</p>
      </section>
      {canEdit ? (
        <form method="post" action="/api/readiness" className="card stack" style={{ marginTop: "1rem" }}>
          <h2>Add a record</h2>
          <p className="meta">Leave unknown fields empty. The new record will flag them.</p>
          <ReadinessFields />
          <button type="submit" name="intent" value="create">Save record</button>
        </form>
      ) : <p>Viewers can read readiness and cannot change it.</p>}
      {READINESS_CATEGORIES.map((category) => {
        const rows = grouped.get(category) ?? [];
        return (
          <section key={category} className="card" style={{ marginTop: "1rem" }}>
            <h2>{CATEGORY_LABEL[category]}</h2>
            {rows.length === 0 ? <p><span className="badge warn">Missing</span> No records on file.</p> : null}
            <div className="results">
              {rows.map((record) => (
                <article key={record.id} className="result">
                  <div className="badges">
                    {record.flags.map((flag) => <span key={flag} className="badge warn">{flag}</span>)}
                    {record.flags.length === 0 ? <span className="badge">No blank or expiring fields</span> : null}
                  </div>
                  <dl className="facts" style={{ marginTop: "0.8rem" }}>
                    <div><dt>Label</dt><dd>{shown(record.label)}</dd></div>
                    <div><dt>Recorded value</dt><dd>{shown(record.recordedValue)}</dd></div>
                    <div><dt>Status</dt><dd>{record.status ? STATUS_LABEL[record.status] : "Blank"}</dd></div>
                    <div><dt>Source</dt><dd>{shown(record.source)}</dd></div>
                    <div><dt>Verification date</dt><dd>{record.verifiedOn ? formatIsoDate(record.verifiedOn) : "Blank"}</dd></div>
                    <div><dt>Expiration</dt><dd>{record.expiresOn ? formatIsoDate(record.expiresOn) : "Blank"}</dd></div>
                    <div><dt>Responsible person</dt><dd>{shown(record.responsiblePerson)}</dd></div>
                  </dl>
                  {canEdit ? (
                    <form method="post" action="/api/readiness" className="stack" style={{ marginTop: "0.8rem" }}>
                      <input type="hidden" name="id" value={record.id} />
                      <ReadinessFields {...record} lockCategory />
                      <div className="row-actions">
                        <button type="submit" name="intent" value="save">Save changes</button>
                        <button type="submit" name="intent" value="remove" className="secondary">Remove</button>
                      </div>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </Shell>
  );
}
