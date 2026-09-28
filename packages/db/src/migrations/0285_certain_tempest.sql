CREATE TABLE "company_memory_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"run_id" uuid,
	"issue_id" uuid,
	"tier" text DEFAULT 'episodic' NOT NULL,
	"breadcrumbs" text,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding_vector" text,
	"quality_score" real DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payload" jsonb NOT NULL,
	"classification" jsonb,
	"linked_issue_id" uuid,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_queues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"routing_policy" jsonb DEFAULT '{"autoDispatch":false,"confidenceThreshold":0.75}'::jsonb NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 120 NOT NULL,
	"default_assignee_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_memory_providers" ADD CONSTRAINT "company_memory_providers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_records" ADD CONSTRAINT "memory_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_records" ADD CONSTRAINT "memory_records_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_records" ADD CONSTRAINT "memory_records_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_records" ADD CONSTRAINT "memory_records_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_queue_items" ADD CONSTRAINT "work_queue_items_queue_id_work_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."work_queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_queue_items" ADD CONSTRAINT "work_queue_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_queue_items" ADD CONSTRAINT "work_queue_items_linked_issue_id_issues_id_fk" FOREIGN KEY ("linked_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_queues" ADD CONSTRAINT "work_queues_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_queues" ADD CONSTRAINT "work_queues_default_assignee_agent_id_agents_id_fk" FOREIGN KEY ("default_assignee_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_memory_providers_company_key_uq" ON "company_memory_providers" USING btree ("company_id","provider_key");--> statement-breakpoint
CREATE INDEX "company_memory_providers_company_updated_idx" ON "company_memory_providers" USING btree ("company_id","updated_at");--> statement-breakpoint
CREATE INDEX "memory_records_company_tier_idx" ON "memory_records" USING btree ("company_id","tier");--> statement-breakpoint
CREATE INDEX "memory_records_company_source_idx" ON "memory_records" USING btree ("company_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "memory_records_company_issue_idx" ON "memory_records" USING btree ("company_id","issue_id");--> statement-breakpoint
CREATE INDEX "memory_records_company_run_idx" ON "memory_records" USING btree ("company_id","run_id");--> statement-breakpoint
CREATE INDEX "work_queue_items_queue_status_idx" ON "work_queue_items" USING btree ("queue_id","status");--> statement-breakpoint
CREATE INDEX "work_queue_items_company_status_idx" ON "work_queue_items" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "work_queue_items_created_idx" ON "work_queue_items" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_queues_company_key_uq" ON "work_queues" USING btree ("company_id","key");--> statement-breakpoint
CREATE INDEX "work_queues_company_updated_idx" ON "work_queues" USING btree ("company_id","updated_at");