import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { LayaClassification, WorkQueueRoutingPolicy } from "@paperclipai/shared";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const workQueues = pgTable(
  "work_queues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    routingPolicy: jsonb("routing_policy")
      .$type<WorkQueueRoutingPolicy>()
      .notNull()
      .default({ autoDispatch: false, confidenceThreshold: 0.75 }),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(120),
    defaultAssigneeAgentId: uuid("default_assignee_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyKeyUq: uniqueIndex("work_queues_company_key_uq").on(table.companyId, table.key),
    companyUpdatedIdx: index("work_queues_company_updated_idx").on(
      table.companyId,
      table.updatedAt,
    ),
  }),
);

export const workQueueItems = pgTable(
  "work_queue_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queueId: uuid("queue_id")
      .notNull()
      .references(() => workQueues.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    classification: jsonb("classification").$type<LayaClassification>(),
    linkedIssueId: uuid("linked_issue_id").references(() => issues.id, {
      onDelete: "set null",
    }),
    retryCount: integer("retry_count").notNull().default(0),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => ({
    queueStatusIdx: index("work_queue_items_queue_status_idx").on(table.queueId, table.status),
    companyStatusIdx: index("work_queue_items_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    createdIdx: index("work_queue_items_created_idx").on(table.createdAt),
  }),
);
