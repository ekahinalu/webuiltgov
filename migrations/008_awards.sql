create table awards (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  amount_cents bigint not null,
  awarded_on date not null,
  source text not null,
  entered_by text references users (id),
  entered_by_name text not null,
  recorded_at timestamptz not null,
  primary key (organization_id, opportunity_id),
  constraint awards_amount_chk check (amount_cents >= 0),
  constraint awards_source_chk check (length(trim(source)) > 0)
);

create table fulfillment_projects (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  primary key (organization_id, opportunity_id),
  foreign key (organization_id, opportunity_id) references awards (organization_id, opportunity_id)
);

create table fulfillment_items (
  id text primary key,
  organization_id text not null,
  opportunity_id text not null,
  kind text not null,
  name text not null,
  due_on date,
  completed boolean not null default false,
  completed_by text references users (id),
  completed_by_name text,
  completed_at timestamptz,
  created_by text references users (id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, opportunity_id) references fulfillment_projects (organization_id, opportunity_id),
  constraint fulfillment_kind_chk check (kind in ('milestone', 'obligation')),
  constraint fulfillment_name_chk check (length(trim(name)) > 0),
  constraint fulfillment_complete_chk check (
    (
      completed = false
      and completed_by is null
      and completed_by_name is null
      and completed_at is null
    )
    or (
      completed = true
      and completed_by is not null
      and completed_by_name is not null
      and completed_at is not null
    )
  )
);
