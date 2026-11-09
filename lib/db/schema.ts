import { bigint, boolean, date, integer, jsonb, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";
import type { SourceFacts } from "../domain";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    plane: text("plane").notNull(),
    identitySub: text("identity_sub").notNull(),
    email: text("email"),
    name: text("name"),
    activeOrganizationId: text("active_organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("users_plane_sub").on(table.plane, table.identitySub)],
);

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  plane: text("plane").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    organizationId: text("organization_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.userId] })],
);

export const invites = pgTable(
  "invites",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("invites_org_email").on(table.organizationId, table.email)],
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: text("id").primaryKey(),
    plane: text("plane").notNull(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    sourceUrl: text("source_url"),
    agency: text("agency"),
    solicitationNumber: text("solicitation_number"),
    title: text("title").notNull(),
    description: text("description"),
    governmentLevel: text("government_level"),
    location: text("location"),
    naics: text("naics"),
    deadline: date("deadline"),
    deadlineRaw: text("deadline_raw"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: "date" }).notNull(),
    recordKind: text("record_kind").notNull(),
    sourceFacts: jsonb("source_facts").$type<SourceFacts>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("opportunities_source_id").on(table.plane, table.source, table.sourceId)],
);

export const pipelineEntries = pgTable(
  "pipeline_entries",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    status: text("status").notNull(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId] })],
);

export const connectorRuns = pgTable("connector_runs", {
  id: text("id").primaryKey(),
  plane: text("plane").notNull(),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  status: text("status").notNull(),
  error: text("error"),
  fetchedCount: integer("fetched_count"),
  upsertedCount: integer("upserted_count"),
});

export const aiSettings = pgTable("ai_settings", {
  plane: text("plane").primaryKey(),
  model: text("model").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const aiRequests = pgTable("ai_requests", {
  id: text("id").primaryKey(),
  plane: text("plane").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const readinessRecords = pgTable("readiness_records", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  category: text("category").notNull(),
  label: text("label"),
  recordedValue: text("recorded_value"),
  status: text("status"),
  source: text("source"),
  verifiedOn: date("verified_on"),
  expiresOn: date("expires_on"),
  responsiblePerson: text("responsible_person"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const eligibilityMarks = pgTable(
  "eligibility_marks",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    sourceKey: text("source_key").notNull(),
    disposition: text("disposition").notNull(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId, table.sourceKey] })],
);

export const pursuitDecisions = pgTable(
  "pursuit_decisions",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    recommendation: text("recommendation").notNull(),
    reason: text("reason").notNull(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId] })],
);

export const pursuitDrafts = pgTable(
  "pursuit_drafts",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    model: text("model").notNull(),
    draft: text("draft"),
    error: text("error"),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId] })],
);

export const bids = pgTable(
  "bids",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    stage: text("stage").notNull(),
    laborLow: bigint("labor_low", { mode: "number" }),
    laborExpected: bigint("labor_expected", { mode: "number" }),
    laborHigh: bigint("labor_high", { mode: "number" }),
    materialsLow: bigint("materials_low", { mode: "number" }),
    materialsExpected: bigint("materials_expected", { mode: "number" }),
    materialsHigh: bigint("materials_high", { mode: "number" }),
    equipmentLow: bigint("equipment_low", { mode: "number" }),
    equipmentExpected: bigint("equipment_expected", { mode: "number" }),
    equipmentHigh: bigint("equipment_high", { mode: "number" }),
    subcontractorsLow: bigint("subcontractors_low", { mode: "number" }),
    subcontractorsExpected: bigint("subcontractors_expected", { mode: "number" }),
    subcontractorsHigh: bigint("subcontractors_high", { mode: "number" }),
    overheadLow: bigint("overhead_low", { mode: "number" }),
    overheadExpected: bigint("overhead_expected", { mode: "number" }),
    overheadHigh: bigint("overhead_high", { mode: "number" }),
    contingencyLow: bigint("contingency_low", { mode: "number" }),
    contingencyExpected: bigint("contingency_expected", { mode: "number" }),
    contingencyHigh: bigint("contingency_high", { mode: "number" }),
    profitLow: bigint("profit_low", { mode: "number" }),
    profitExpected: bigint("profit_expected", { mode: "number" }),
    profitHigh: bigint("profit_high", { mode: "number" }),
    proposedPrice: bigint("proposed_price", { mode: "number" }),
    approvedBy: text("approved_by"),
    approvedByName: text("approved_by_name"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId] })],
);

export const proposalSections = pgTable(
  "proposal_sections",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    section: text("section").notNull(),
    body: text("body"),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId, table.section] })],
);

export const proposalInclusions = pgTable(
  "proposal_inclusions",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    readinessId: text("readiness_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId, table.readinessId] })],
);

export const verifiedProjects = pgTable("verified_projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  client: text("client"),
  description: text("description"),
  completedOn: date("completed_on"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const proposalProjects = pgTable(
  "proposal_projects",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    projectId: text("project_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId, table.projectId] })],
);

export const proposalMatrix = pgTable(
  "proposal_matrix",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    sourceKey: text("source_key").notNull(),
    section: text("section"),
    completion: text("completion"),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId, table.sourceKey] })],
);

export const proposalDrafts = pgTable(
  "proposal_drafts",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    model: text("model").notNull(),
    draft: text("draft"),
    error: text("error"),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId] })],
);

export const submissionRecords = pgTable(
  "submission_records",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    internalApprovedBy: text("internal_approved_by"),
    internalApprovedByName: text("internal_approved_by_name"),
    internalApprovedAt: timestamp("internal_approved_at", { withTimezone: true, mode: "date" }),
    confirmationNumber: text("confirmation_number"),
    destination: text("destination"),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    enteredBy: text("entered_by"),
    enteredByName: text("entered_by_name"),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId] })],
);

export const vendors = pgTable(
  "vendors",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    trade: text("trade"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("vendors_org_id").on(table.organizationId, table.id)],
);

export const quotes = pgTable("quotes", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  opportunityId: text("opportunity_id").notNull(),
  vendorId: text("vendor_id").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  covers: text("covers").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const awards = pgTable(
  "awards",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    awardedOn: date("awarded_on").notNull(),
    source: text("source").notNull(),
    enteredBy: text("entered_by"),
    enteredByName: text("entered_by_name").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId] })],
);

export const fulfillmentProjects = pgTable(
  "fulfillment_projects",
  {
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.opportunityId] })],
);

export const fulfillmentItems = pgTable("fulfillment_items", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  opportunityId: text("opportunity_id").notNull(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  dueOn: date("due_on"),
  completed: boolean("completed").notNull().default(false),
  completedBy: text("completed_by"),
  completedByName: text("completed_by_name"),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    number: text("number").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    enteredBy: text("entered_by"),
    enteredByName: text("entered_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [unique("invoices_org_id").on(table.organizationId, table.id)],
);

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  invoiceId: text("invoice_id").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  paidOn: date("paid_on").notNull(),
  enteredBy: text("entered_by"),
  enteredByName: text("entered_by_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const aiAnswers = pgTable(
  "ai_answers",
  {
    plane: text("plane").notNull(),
    userId: text("user_id").notNull(),
    opportunityId: text("opportunity_id"),
    prompt: text("prompt").notNull(),
    answer: text("answer"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.plane, table.userId] })],
);
