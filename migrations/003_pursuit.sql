create table pursuit_decisions (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  recommendation text not null,
  reason text not null,
  updated_by text references users (id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, opportunity_id),
  constraint pursuit_recommendation_chk check (
    recommendation in (
      'strong_pursuit',
      'potential',
      'needs_information',
      'partner_required',
      'high_risk',
      'poor_fit',
      'no_bid'
    )
  )
);

create table pursuit_drafts (
  organization_id text not null references organizations (id),
  opportunity_id text not null references opportunities (id),
  model text not null,
  draft text,
  error text,
  updated_by text references users (id),
  updated_at timestamptz not null default now(),
  primary key (organization_id, opportunity_id)
);
