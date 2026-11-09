create table submission_records (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  internal_approved_by text references users (id),
  internal_approved_by_name text,
  internal_approved_at timestamptz,
  confirmation_number text,
  destination text,
  submitted_at timestamptz,
  entered_by text references users (id),
  entered_by_name text,
  recorded_at timestamptz,
  primary key (organization_id, opportunity_id),
  constraint submission_fields_chk check (
    (
      confirmation_number is null
      and destination is null
      and submitted_at is null
      and entered_by is null
      and entered_by_name is null
      and recorded_at is null
    )
    or (
      confirmation_number is not null
      and destination is not null
      and submitted_at is not null
      and entered_by is not null
      and entered_by_name is not null
      and recorded_at is not null
    )
  )
);
