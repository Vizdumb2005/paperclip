import {
  boolean,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { issues } from "./issues.js";

export const companyMemoryProviders = pgTable(
  "company_memory_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull(),
    name: text("name").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProviderKeyUq: uniqueIndex("company_memory_providers_company_key_uq").on(
      table.companyId,
      table.providerKey,
    ),
    companyUpdatedIdx: index("company_memory_providers_company_updated_idx").on(
      table.companyId,
      table.updatedAt,
    ),
  }),
);

export const memoryRecords = pgTable(
  "memory_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    runId: uuid("run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    tier: text("tier").notNull().default("episodic"),
    breadcrumbs: text("breadcrumbs"),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    embeddingVector: text("embedding_vector"),
    qualityScore: real("quality_score").default(1.0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyTierIdx: index("memory_records_company_tier_idx").on(table.companyId, table.tier),
    companySourceIdx: index("memory_records_company_source_idx").on(
      table.companyId,
      table.sourceType,
      table.sourceId,
    ),
    companyIssueIdx: index("memory_records_company_issue_idx").on(
      table.companyId,
      table.issueId,
    ),
    companyRunIdx: index("memory_records_company_run_idx").on(
      table.companyId,
      table.runId,
    ),
  }),
);
