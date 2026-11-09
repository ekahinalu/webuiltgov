import Link from "next/link";
import { KIND_LABEL, LEVEL_LABEL, PIPELINE_LABEL, SOURCE_LABEL, type GovernmentLevel, type RecordKind, type SourceName } from "../lib/domain";
import { formatIsoDate, formatTimestamp } from "../lib/dates";
import type { SearchHit } from "../lib/opportunities/search";

function knownLevel(value: string | null): value is GovernmentLevel {
  return value === "federal" || value === "state" || value === "local" || value === "tribal";
}

function knownKind(value: string): value is RecordKind {
  return value === "grant_opportunity" || value === "contract_notice" || value === "award_notice";
}

function knownSource(value: string): value is SourceName {
  return value === "grants.gov" || value === "sam.gov";
}

export function OpportunityCard({ hit }: { hit: SearchHit }) {
  const deadline = formatIsoDate(hit.deadline);
  return (
    <article className="result">
      <div className="badges">
        <span className={hit.recordKind === "award_notice" ? "badge warn" : "badge"}>
          {knownKind(hit.recordKind) ? KIND_LABEL[hit.recordKind] : hit.recordKind}
        </span>
        {knownLevel(hit.governmentLevel) ? <span className="badge">{LEVEL_LABEL[hit.governmentLevel]}</span> : null}
        <span className="badge">{knownSource(hit.source) ? SOURCE_LABEL[hit.source] : hit.source}</span>
        {hit.pipelineStatus && hit.pipelineStatus in PIPELINE_LABEL ? (
          <span className="badge">{PIPELINE_LABEL[hit.pipelineStatus as keyof typeof PIPELINE_LABEL]}</span>
        ) : null}
      </div>
      <h2><Link href={`/opportunities/${hit.id}`}>{hit.title}</Link></h2>
      <p className="meta">
        {[hit.agency, hit.solicitationNumber, deadline ? `Due ${deadline}` : null, hit.naics ? `NAICS ${hit.naics}` : null, hit.location]
          .filter(Boolean)
          .join(" · ") || "The source did not provide agency, number, deadline, NAICS, or location."}
      </p>
      <p className="meta">Last verified {formatTimestamp(hit.lastVerifiedAt)}</p>
    </article>
  );
}
