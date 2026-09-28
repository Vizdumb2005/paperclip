import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  companies,
  companySkills,
  companyTransferRuns,
  createDb,
  goals,
  heartbeatRuns,
  projects,
  routineRuns,
  routines,
} from "@paperclipai/db";
import { startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";
import { getEmbeddedPostgresTestSupport } from "./helpers/embedded-postgres.js";
import { TELEMETRY_ADOPTION_WINDOW_DAYS, telemetryAdoptionService } from "../services/telemetry-adoption.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres telemetry adoption service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

function utcNoon(offsetDays: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays, 12));
}

function utcKey(offsetDays: number): string {
  return utcNoon(offsetDays).toISOString().slice(0, 10);
}

async function seedCompany(db: ReturnType<typeof createDb>, name: string) {
  const companyId = randomUUID();
  await db.insert(companies).values({
    id: companyId,
    name,
    issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    requireBoardApprovalForNewAgents: false,
  });
  return companyId;
}

describeEmbeddedPostgres("telemetry adoption service", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-telemetry-adoption-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(heartbeatRuns);
    await db.delete(routineRuns);
    await db.delete(routines);
    await db.delete(companySkills);
    await db.delete(companyTransferRuns);
    await db.delete(projects);
    await db.delete(goals);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("returns all 15 events with zero counts and a full window for an empty company", async () => {
    const companyId = await seedCompany(db, "Empty");
    const summary = await telemetryAdoptionService(db).summary(companyId);

    expect(summary.companyId).toBe(companyId);
    expect(summary.windowDays).toBe(TELEMETRY_ADOPTION_WINDOW_DAYS);
    expect(summary.events).toHaveLength(15);
    for (const entry of summary.events) {
      expect(entry.total).toBe(0);
      expect(entry.byDay).toHaveLength(TELEMETRY_ADOPTION_WINDOW_DAYS);
      expect(entry.byDay.every((bucket) => bucket.count === 0)).toBe(true);
    }
    const byEvent = new Map(summary.events.map((entry) => [entry.event, entry]));
    expect(byEvent.get("install.started")?.proxySource).toBeNull();
    expect(byEvent.get("install.completed")?.proxySource).toBeNull();
  });

  it("counts company-scoped proxies by type and day without leaking across companies", async () => {
    const companyId = await seedCompany(db, "Adoption");
    const otherCompanyId = await seedCompany(db, "Other");
    const agentId = randomUUID();
    const otherAgentId = randomUUID();
    const today = utcNoon(0);
    const yesterday = utcNoon(-1);

    for (const [id, cid, heartbeat] of [
      [agentId, companyId, today],
      [otherAgentId, otherCompanyId, null],
    ] as const) {
      await db.insert(agents).values({
        id,
        companyId: cid,
        name: heartbeat ? "HeartbeatAgent" : "QuietAgent",
        role: "engineer",
        status: "idle",
        adapterType: "process",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
        ...(heartbeat ? { lastHeartbeatAt: heartbeat, createdAt: yesterday } : { createdAt: today }),
      });
    }

    await db.insert(heartbeatRuns).values([
      { id: randomUUID(), companyId, agentId, invocationSource: "assignment", status: "succeeded", createdAt: today },
      { id: randomUUID(), companyId, agentId, invocationSource: "assignment", status: "failed", errorCode: "process_lost", createdAt: today },
      { id: randomUUID(), companyId, agentId, invocationSource: "assignment", status: "queued", createdAt: yesterday },
      { id: randomUUID(), companyId: otherCompanyId, agentId: otherAgentId, invocationSource: "assignment", status: "succeeded", createdAt: today },
    ]);

    await db.insert(projects).values({ companyId, name: "Project", createdAt: today });
    await db.insert(goals).values({ companyId, title: "Goal", createdAt: yesterday });
    const routineId = randomUUID();
    await db.insert(routines).values({ id: routineId, companyId, title: "Routine", createdAt: today });
    await db.insert(routineRuns).values({ companyId, routineId, source: "schedule", status: "completed", createdAt: today });
    await db.insert(companySkills).values({
      companyId,
      key: "skill-key",
      slug: "skill-slug",
      name: "Skill",
      markdown: "# Skill",
      createdAt: today,
    });
    await db.insert(companyTransferRuns).values({
      companyId,
      direction: "import",
      actorKey: "board",
      containerRef: {},
      idempotencyKey: randomUUID(),
      createdAt: today,
    });

    const summary = await telemetryAdoptionService(db).summary(companyId);
    const byEvent = new Map(summary.events.map((entry) => [entry.event, entry]));
    const total = (event: string) => byEvent.get(event as never)?.total;
    const dayCount = (event: string, key: string) =>
      byEvent.get(event as never)?.byDay.find((bucket) => bucket.date === key)?.count;

    expect(total("agent.created")).toBe(1);
    expect(total("agent.first_heartbeat")).toBe(1);
    expect(total("agent.task_run")).toBe(3);
    // The queued run has no terminal status, so it is excluded from task_completed.
    expect(total("agent.task_completed")).toBe(2);
    expect(total("error.handler_crash")).toBe(1);
    expect(total("project.created")).toBe(1);
    expect(total("goal.created")).toBe(1);
    expect(total("routine.created")).toBe(1);
    expect(total("routine.run")).toBe(1);
    expect(total("skill.imported")).toBe(1);
    expect(total("company.imported")).toBe(1);

    expect(dayCount("agent.task_run", utcKey(0))).toBe(2);
    expect(dayCount("agent.task_run", utcKey(-1))).toBe(1);
    expect(dayCount("goal.created", utcKey(-1))).toBe(1);
    expect(dayCount("goal.created", utcKey(0))).toBe(0);
  });

  it("throws not-found for an unknown company", async () => {
    await expect(telemetryAdoptionService(db).summary(randomUUID())).rejects.toMatchObject({ status: 404 });
  });
});
