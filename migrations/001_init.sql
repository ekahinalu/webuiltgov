create table users (
  id text primary key,
  plane text not null,
  identity_sub text not null,
  email text,
  name text,
  active_organization_id text,
  created_at timestamptz not null default now(),
  constraint users_plane_chk check (plane in ('production', 'preview')),
  constraint users_plane_sub unique (plane, identity_sub)
);

create table organizations (
  id text primary key,
  plane text not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint organizations_plane_chk check (plane in ('production', 'preview'))
);

alter table users
  add constraint users_active_org_fk
  foreign key (active_organization_id) references organizations (id);

create table memberships (
  organization_id text not null references organizations (id),
  user_id text not null references users (id),
  role text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  constraint memberships_role_chk check (role in ('owner', 'admin', 'member', 'viewer'))
);

create table invites (
  id text primary key,
  organization_id text not null references organizations (id),
  email text not null,
  role text not null,
  created_by text not null references users (id),
  created_at timestamptz not null default now(),
  constraint invites_role_chk check (role in ('admin', 'member', 'viewer')),
  constraint invites_org_email unique (organization_id, email)
);

create table opportunities (
  id text primary key,
  plane text not null,
  source text not null,
  source_id text not null,
  source_url text,
  agency text,
  solicitation_number text,
  title text not null,
  description text,
  government_level text,
  location text,
  naics text,
  deadline date,
  deadline_raw text,
  last_verified_at timestamptz not null,
  record_kind text not null,
  source_facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_plane_chk check (plane in ('production', 'preview')),
  constraint opportunities_level_chk check (
    government_level is null or government_level in ('federal', 'state', 'local', 'tribal')
  ),
  constraint opportunities_kind_chk check (
    record_kind in ('grant_opportunity', 'contract_notice', 'award_notice')
  ),
  constraint opportunities_source_id unique (plane, source, source_id)
);

create index opportunities_plane_deadline_idx on opportunities (plane, deadline);
create index opportunities_plane_agency_idx on opportunities (plane, agency);

create table pipeline_entries (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  status text not null,
  updated_by text references users (id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, opportunity_id),
  constraint pipeline_status_chk check (status in ('unreviewed', 'reviewing', 'pursuing', 'passed'))
);

create table connector_runs (
  id text primary key,
  plane text not null,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  error text,
  fetched_count integer,
  upserted_count integer,
  constraint connector_runs_plane_chk check (plane in ('production', 'preview')),
  constraint connector_runs_status_chk check (status in ('running', 'success', 'error', 'skipped'))
);

create index connector_runs_lookup_idx on connector_runs (plane, source, started_at desc);

create table ai_settings (
  plane text primary key,
  model text not null,
  updated_at timestamptz not null default now(),
  constraint ai_settings_plane_chk check (plane in ('production', 'preview'))
);

create table ai_requests (
  id text primary key,
  plane text not null,
  user_id text not null references users (id),
  created_at timestamptz not null default now(),
  constraint ai_requests_plane_chk check (plane in ('production', 'preview'))
);

create index ai_requests_user_idx on ai_requests (plane, user_id, created_at desc);

create table ai_answers (
  plane text not null,
  user_id text not null references users (id),
  opportunity_id text,
  prompt text not null,
  answer text,
  error text,
  created_at timestamptz not null default now(),
  primary key (plane, user_id),
  constraint ai_answers_plane_chk check (plane in ('production', 'preview'))
);
