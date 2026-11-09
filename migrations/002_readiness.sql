create table readiness_records (
  id text primary key,
  organization_id text not null references organizations (id),
  category text not null,
  label text,
  recorded_value text,
  status text,
  source text,
  verified_on date,
  expires_on date,
  responsible_person text,
  updated_by text references users (id),
  updated_at timestamptz not null default now(),
  constraint readiness_category_chk check (
    category in ('legal_business', 'registration', 'license', 'certification', 'insurance', 'bonding')
  ),
  constraint readiness_status_chk check (
    status is null or status in ('active', 'expired', 'pending', 'inactive')
  )
);

create index readiness_org_idx on readiness_records (organization_id, category);

create table eligibility_marks (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  source_key text not null,
  disposition text not null,
  updated_by text references users (id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, opportunity_id, source_key),
  constraint eligibility_disposition_chk check (
    disposition in (
      'satisfied',
      'unsatisfied',
      'potentially_correctable',
      'needs_verification',
      'not_applicable'
    )
  )
);
