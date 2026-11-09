create table invoices (
  id text primary key,
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  number text not null,
  amount_cents bigint not null,
  entered_by text references users (id),
  entered_by_name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, opportunity_id) references awards (organization_id, opportunity_id),
  constraint invoices_number_chk check (length(trim(number)) > 0),
  constraint invoices_amount_chk check (amount_cents >= 0)
);

create table payments (
  id text primary key,
  organization_id text not null,
  invoice_id text not null,
  amount_cents bigint not null,
  paid_on date not null,
  entered_by text references users (id),
  entered_by_name text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, invoice_id) references invoices (organization_id, id),
  constraint payments_amount_chk check (amount_cents >= 0)
);
