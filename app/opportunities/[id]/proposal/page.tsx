import Link from "next/link";
import { notFound } from "next/navigation";
import { xaiKey } from "../../../../lib/ai/config";
import { hasRole } from "../../../../lib/auth/roles";
import { getPagePrincipal } from "../../../../lib/auth/session";
import { Shell, SignedOut } from "../../../../components/chrome";
import { formatTimestamp } from "../../../../lib/dates";
import { getDb } from "../../../../lib/db/client";
import { CATEGORY_LABEL } from "../../../../lib/readiness/model";
import {
  COMPLETIONS,
  COMPLETION_LABEL,
  PROPOSAL_SECTIONS,
  SECTION_LABEL,
  TEXT_SECTIONS,
} from "../../../../lib/proposals/model";
import { proposalView } from "../../../../lib/proposals/service";

export const metadata = { title: "Proposal" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function shown(value: string | null): string {
  return value && value.trim() !== "" ? value : "Not stored";
}

export default async function ProposalPage({
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
  const view = await proposalView(await getDb(), principal, id);
  if (!view) notFound();
  const canEdit = hasRole(principal.role, "member");
  const keyConfigured = xaiKey() !== null;
  const included = new Set(view.includedReadinessIds);
  return (
    <Shell principal={principal} path={`/opportunities/${view.opportunityId}/proposal`} notice={one(query.notice)}>
      <p><Link href={`/opportunities/${view.opportunityId}`}>Back to {view.solicitationNumber ?? view.title}</Link></p>
      <h1>Proposal</h1>
      <p>
        {view.title} for {principal.organizationName}. Empty sections stay empty.
        Past performance repeats readiness records already saved, or verified projects someone types.
      </p>
      <p><a href={`/api/proposal/export?opportunityId=${view.opportunityId}`}>Download saved sections (PDF)</a></p>
      {TEXT_SECTIONS.map((section) => (
        <section key={section} className="card" style={{ marginTop: "1rem" }}>
          <h2>{SECTION_LABEL[section]}</h2>
          {view.sections[section] ? <p className="answer">{view.sections[section]}</p> : <p>This section is empty.</p>}
          {canEdit ? (
            <form method="post" action="/api/proposal" className="stack">
              <input type="hidden" name="intent" value="section" />
              <input type="hidden" name="opportunityId" value={view.opportunityId} />
              <input type="hidden" name="section" value={section} />
              <label>
                <span>Saved text</span>
                <textarea name="body" maxLength={20000} defaultValue={view.sections[section] ?? ""} />
              </label>
              <button type="submit">Save section</button>
            </form>
          ) : null}
        </section>
      ))}
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>{SECTION_LABEL.past_performance}</h2>
        <p>This section does not take freeform claims. Include a readiness record that is already stored, or type a verified project.</p>
        <h3>Readiness records</h3>
        {view.readiness.length === 0 ? <p>No readiness records are stored. None are repeated.</p> : null}
        <div className="results">
          {view.readiness.map((record) => (
            <article key={record.id} className="result">
              <p>{CATEGORY_LABEL[record.category]}</p>
              <p>Label: {shown(record.label)}. Value: {shown(record.recordedValue)}.</p>
              {canEdit ? (
                <form method="post" action="/api/proposal">
                  <input type="hidden" name="intent" value={included.has(record.id) ? "remove-readiness" : "include-readiness"} />
                  <input type="hidden" name="opportunityId" value={view.opportunityId} />
                  <input type="hidden" name="readinessId" value={record.id} />
                  <button type="submit">{included.has(record.id) ? "Remove from past performance" : "Include in past performance"}</button>
                </form>
              ) : <p>{included.has(record.id) ? "Included." : "Not included."}</p>}
            </article>
          ))}
        </div>
        <h3>Verified projects</h3>
        {view.projects.length === 0 ? <p>No verified projects have been typed.</p> : null}
        <div className="results">
          {view.projects.map((project) => (
            <article key={project.id} className="result">
              <p>{project.name}</p>
              <p>Client: {shown(project.client)}. Completed: {project.completedOn ?? "Not stored"}.</p>
              {project.description ? <p>{project.description}</p> : <p>Description: Not stored.</p>}
              {canEdit ? (
                <form method="post" action="/api/proposal">
                  <input type="hidden" name="intent" value={project.included ? "remove-project" : "include-project"} />
                  <input type="hidden" name="opportunityId" value={view.opportunityId} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <button type="submit">{project.included ? "Remove from this proposal" : "Include in this proposal"}</button>
                </form>
              ) : <p>{project.included ? "Included." : "Not included."}</p>}
            </article>
          ))}
        </div>
        {canEdit ? (
          <form method="post" action="/api/proposal" className="stack" style={{ marginTop: "0.8rem" }}>
            <h3>Add a verified project</h3>
            <input type="hidden" name="intent" value="add-project" />
            <input type="hidden" name="opportunityId" value={view.opportunityId} />
            <label>
              <span>Project name</span>
              <input name="name" maxLength={200} required />
            </label>
            <label>
              <span>Client</span>
              <input name="client" maxLength={200} />
            </label>
            <label>
              <span>Description</span>
              <textarea name="description" maxLength={2000} />
            </label>
            <label>
              <span>Completed</span>
              <input name="completedOn" type="date" />
            </label>
            <button type="submit">Save project</button>
          </form>
        ) : null}
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Requirement matrix</h2>
        {!view.matrixLoaded ? <p>Applicant types are not stored on this notice. No requirements were added.</p> : null}
        {view.matrixLoaded && view.matrix.length === 0 ? <p>The stored notice did not list applicant types. No requirements were added.</p> : null}
        <div className="results">
          {view.matrix.map((line) => (
            <article key={line.sourceKey} className="result">
              <div className="badges">
                <span className="badge">{line.sourceLabel}</span>
                {line.completion ? <span className="badge">{COMPLETION_LABEL[line.completion]}</span> : <span className="badge warn">Not set</span>}
              </div>
              <h2 style={{ marginTop: "0.55rem" }}>{line.text}</h2>
              <p className="meta">Section: {line.section ? SECTION_LABEL[line.section] : "Not set"}.</p>
              {canEdit ? (
                <form method="post" action="/api/proposal" className="inline">
                  <input type="hidden" name="intent" value="matrix" />
                  <input type="hidden" name="opportunityId" value={view.opportunityId} />
                  <input type="hidden" name="sourceKey" value={line.sourceKey} />
                  <label>
                    <span>Section</span>
                    <select name="section" defaultValue={line.section ?? ""}>
                      <option value="">Not set</option>
                      {PROPOSAL_SECTIONS.map((section) => <option key={section} value={section}>{SECTION_LABEL[section]}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Completion</span>
                    <select name="completion" defaultValue={line.completion ?? ""}>
                      <option value="">Not set</option>
                      {COMPLETIONS.map((item) => <option key={item} value={item}>{COMPLETION_LABEL[item]}</option>)}
                    </select>
                  </label>
                  <button type="submit">Save line</button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Model draft</h2>
        {keyConfigured ? (
          <p>XAI_API_KEY is set. Asking Grok sends the stored notice, saved sections, readiness records, and verified projects. The draft stays model text until a person saves it into cover, understanding, or technical approach.</p>
        ) : (
          <p>XAI_API_KEY is not set. Grok was not called.</p>
        )}
        {view.draft ? (
          <div>
            <p className="meta">Model {view.draft.model}. {formatTimestamp(view.draft.updatedAt)}. This is model text, not a saved section.</p>
            {view.draft.draft ? <p className="answer">{view.draft.draft}</p> : null}
            {view.draft.error ? <p>{view.draft.error}</p> : null}
          </div>
        ) : null}
        {canEdit && keyConfigured ? (
          <form method="post" action="/api/proposal">
            <input type="hidden" name="intent" value="draft" />
            <input type="hidden" name="opportunityId" value={view.opportunityId} />
            <button type="submit">Ask Grok to draft from stored records</button>
          </form>
        ) : null}
        {canEdit && view.draft?.draft ? (
          <form method="post" action="/api/proposal" className="inline" style={{ marginTop: "0.8rem" }}>
            <input type="hidden" name="intent" value="use-draft" />
            <input type="hidden" name="opportunityId" value={view.opportunityId} />
            <label>
              <span>Save draft into</span>
              <select name="section" defaultValue="cover">
                {TEXT_SECTIONS.map((section) => <option key={section} value={section}>{SECTION_LABEL[section]}</option>)}
              </select>
            </label>
            <button type="submit">Save draft into section</button>
          </form>
        ) : null}
      </section>
      {!canEdit ? <p>Viewers can read this proposal and cannot change it.</p> : null}
    </Shell>
  );
}
