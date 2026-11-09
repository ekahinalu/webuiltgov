create table vendors (
  id text primary key,
  organization_id text not null references organizations (id),
  name text not null,
  trade text,
  created_by text references users (id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint vendors_name_chk check (length(trim(name)) > 0)
);

create table quotes (
  id text primary key,
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  vendor_id text not null,
  amount_cents bigint not null,
  covers text not null,
  created_by text references users (id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, vendor_id) references vendors (organization_id, id),
  constraint quotes_amount_chk check (amount_cents >= 0),
  constraint quotes_covers_chk check (length(trim(covers)) > 0)
);
