import { date, integer, jsonb, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";
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
