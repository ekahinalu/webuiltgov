create table proposal_sections (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  section text not null,
  body text,
  updated_by text references users (id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, opportunity_id, section),
  constraint proposal_section_chk check (
    section in ('cover', 'understanding', 'technical_approach', 'past_performance')
  )
);

create table proposal_inclusions (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  readiness_id text not null references readiness_records (id) on delete cascade,
  primary key (organization_id, opportunity_id, readiness_id)
);

create table verified_projects (
  id text primary key,
  organization_id text not null references organizations (id),
  name text not null,
  client text,
  description text,
  completed_on date,
  updated_by text references users (id),
  updated_at timestamptz not null default now()
);

create table proposal_projects (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  project_id text not null references verified_projects (id) on delete cascade,
  primary key (organization_id, opportunity_id, project_id)
);

create table proposal_matrix (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  source_key text not null,
  section text,
  completion text,
  updated_by text references users (id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, opportunity_id, source_key),
  constraint proposal_matrix_section_chk check (
    section is null or section in ('cover', 'understanding', 'technical_approach', 'past_performance')
  ),
  constraint proposal_matrix_completion_chk check (
    completion is null or completion in ('complete', 'incomplete', 'missing', 'needs_review', 'not_applicable')
  )
);

create table proposal_drafts (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  model text not null,
  draft text,
  error text,
  updated_by text references users (id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, opportunity_id)
);
