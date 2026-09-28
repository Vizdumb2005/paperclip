import request from "supertest";
import { expect, it } from "vitest";
import { agents, type Db } from "@paperclipai/db";
import { dashboardRoutes } from "../routes/dashboard.js";
import {
  describeEmbeddedPostgres,
  resetCompanyIssueFixtures,
  routeApp,
  seedCompanyWithBoardAccess,
  useEmbeddedPostgres,
} from "./helpers/route-test-harness.js";

describeEmbeddedPostgres("telemetry adoption route", () => {
  const ctx = useEmbeddedPostgres("paperclip-telemetry-adoption-route-", {
    resetEach: async (db: Db) => {
      await db.delete(agents);
      await resetCompanyIssueFixtures(db);
    },
  });

  it("returns the adoption summary for a company the actor can access", async () => {
    const company = await seedCompanyWithBoardAccess(ctx.db, "Adoption route");
    await ctx.db.insert(agents).values({
      companyId: company.companyId,
      name: "AdoptionAgent",
      role: "engineer",
      status: "idle",
      adapterType: "process",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });
    const res = await request(routeApp(ctx.db, company.actor, dashboardRoutes))
      .get(`/api/companies/${company.companyId}/telemetry-adoption`)
      .expect(200);
    const body = res.body as { companyId: string; events: { event: string; total: number }[] };
    expect(body.companyId).toBe(company.companyId);
    expect(body.events).toHaveLength(15);
    expect(body.events.find((entry) => entry.event === "agent.created")?.total).toBe(1);
  });

  it("rejects cross-company access", async () => {
    const company = await seedCompanyWithBoardAccess(ctx.db, "Adoption owner");
    const other = await seedCompanyWithBoardAccess(ctx.db, "Adoption stranger");
    await request(routeApp(ctx.db, company.actor, dashboardRoutes))
      .get(`/api/companies/${other.companyId}/telemetry-adoption`)
      .expect(403);
  });
});
