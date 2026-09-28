import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  companies,
  companySkills,
  companyTransferRuns,
  goals,
  heartbeatRuns,
  issueThreadInteractions,
  projects,
  routineRuns,
  routines,
} from "@paperclipai/db";
import { notFound } from "../errors.js";
import type { PaperclipEventName } from "@paperclipai/shared/telemetry";
import type {
  TelemetryAdoptionDayBucket,
  TelemetryAdoptionEventEntry,
  TelemetryAdoptionSummary,
} from "@paperclipai/shared";

export const TELEMETRY_ADOPTION_WINDOW_DAYS = 14;

const TERMINAL_RUN_STATUSES = ["succeeded", "failed", "timed_out", "cancelled", "interrupted"];

function formatUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function recentUtcDateKeys(now: Date, days: number): string[] {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, index) => {
    const dayOffset = index - (days - 1);
    return formatUtcDateKey(new Date(todayUtc + dayOffset * 24 * 60 * 60 * 1000));
  });
}

function bucketByDay(createdAts: Date[], days: string[]): TelemetryAdoptionDayBucket[] {
  const counts = new Map(days.map((date) => [date, 0]));
  for (const createdAt of createdAts) {
    const key = formatUtcDateKey(createdAt);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return days.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export function telemetryAdoptionService(db: Db) {
  async function entry(
    event: PaperclipEventName,
    proxySource: string | null,
    createdAts: Date[] | null,
    days: string[],
  ): Promise<TelemetryAdoptionEventEntry> {
    if (proxySource === null || createdAts === null) {
      return {
        event,
        proxySource,
        total: 0,
        byDay: days.map((date) => ({ date, count: 0 })),
      };
    }
    return { event, proxySource, total: createdAts.length, byDay: bucketByDay(createdAts, days) };
  }

  return {
    summary: async (companyId: string): Promise<TelemetryAdoptionSummary> => {
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);
      if (!company) throw notFound("Company not found");

      const now = new Date();
      const days = recentUtcDateKeys(now, TELEMETRY_ADOPTION_WINDOW_DAYS);

      const [
        agentRows,
        heartbeatRows,
        goalRows,
        projectRows,
        routineRows,
        routineRunRows,
        interactionRows,
        skillRows,
        transferRows,
      ] = await Promise.all([
        db
          .select({ createdAt: agents.createdAt, lastHeartbeatAt: agents.lastHeartbeatAt })
          .from(agents)
          .where(eq(agents.companyId, companyId)),
        db
          .select({ createdAt: heartbeatRuns.createdAt, status: heartbeatRuns.status, errorCode: heartbeatRuns.errorCode })
          .from(heartbeatRuns)
          .where(eq(heartbeatRuns.companyId, companyId)),
        db.select({ createdAt: goals.createdAt }).from(goals).where(eq(goals.companyId, companyId)),
        db.select({ createdAt: projects.createdAt }).from(projects).where(eq(projects.companyId, companyId)),
        db.select({ createdAt: routines.createdAt }).from(routines).where(eq(routines.companyId, companyId)),
        db.select({ createdAt: routineRuns.createdAt }).from(routineRuns).where(eq(routineRuns.companyId, companyId)),
        db
          .select({ createdAt: issueThreadInteractions.createdAt, resolvedAt: issueThreadInteractions.resolvedAt })
          .from(issueThreadInteractions)
          .where(eq(issueThreadInteractions.companyId, companyId)),
        db.select({ createdAt: companySkills.createdAt }).from(companySkills).where(eq(companySkills.companyId, companyId)),
        db
          .select({ createdAt: companyTransferRuns.createdAt })
          .from(companyTransferRuns)
          .where(and(eq(companyTransferRuns.companyId, companyId), eq(companyTransferRuns.direction, "import"))),
      ]);

      const agentCreatedAts = agentRows.map((row) => row.createdAt);
      const firstHeartbeatAts = agentRows.filter((row) => row.lastHeartbeatAt !== null).map((row) => row.createdAt);
      const runCreatedAts = heartbeatRows.map((row) => row.createdAt);
      const completedRunAts = heartbeatRows
        .filter((row) => TERMINAL_RUN_STATUSES.includes(String(row.status)))
        .map((row) => row.createdAt);
      const crashRunAts = heartbeatRows.filter((row) => row.errorCode !== null).map((row) => row.createdAt);
      const interactionCreatedAts = interactionRows.map((row) => row.createdAt);
      const interactionResolvedAts = interactionRows
        .filter((row) => row.resolvedAt !== null)
        .map((row) => row.createdAt);

      const events = await Promise.all([
        entry("agent.created", "agents.created_at", agentCreatedAts, days),
        entry("agent.first_heartbeat", "agents.last_heartbeat_at (first-seen agents by creation day)", firstHeartbeatAts, days),
        entry("agent.task_completed", "heartbeat_runs.created_at (terminal statuses)", completedRunAts, days),
        entry("agent.task_run", "heartbeat_runs.created_at", runCreatedAts, days),
        entry("company.imported", "company_transfer_runs.created_at (direction=import)", transferRows.map((row) => row.createdAt), days),
        entry("error.handler_crash", "heartbeat_runs.created_at (error_code present)", crashRunAts, days),
        entry("goal.created", "goals.created_at", goalRows.map((row) => row.createdAt), days),
        entry("install.completed", null, null, days),
        entry("install.started", null, null, days),
        entry("interaction.created", "issue_thread_interactions.created_at", interactionCreatedAts, days),
        entry("interaction.resolved", "issue_thread_interactions.created_at (resolved_at present)", interactionResolvedAts, days),
        entry("project.created", "projects.created_at", projectRows.map((row) => row.createdAt), days),
        entry("routine.created", "routines.created_at", routineRows.map((row) => row.createdAt), days),
        entry("routine.run", "routine_runs.created_at", routineRunRows.map((row) => row.createdAt), days),
        entry("skill.imported", "company_skills.created_at", skillRows.map((row) => row.createdAt), days),
      ]);

      return {
        companyId,
        generatedAt: now.toISOString(),
        windowDays: TELEMETRY_ADOPTION_WINDOW_DAYS,
        events,
      };
    },
  };
}

