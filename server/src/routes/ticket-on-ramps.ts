import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { and, eq } from "drizzle-orm";
import { issues } from "@paperclipai/db";
import { ticketOnRampService } from "../services/ticket-on-ramps.js";
import { assertBoardOrAgent, assertCompanyAccess } from "./authz.js";

export function ticketOnRampRoutes(db: Db) {
  const router = Router();
  const service = ticketOnRampService(db);

  router.post("/companies/:companyId/tickets/inbound", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const { externalId, provider, title } = req.body;
    if (!externalId || !provider || !title) {
      res.status(400).json({ error: "Missing required fields: externalId, provider, title" });
      return;
    }

    const result = await service.syncInboundTicket(companyId, req.body);
    res.status(result.action === "created" ? 201 : 200).json(result);
  });

  router.post("/companies/:companyId/ticket-on-ramps/mirror-comment", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const { issueId, deliverableUrl } = req.body ?? {};
    if (!issueId || typeof issueId !== "string") {
      res.status(400).json({ error: "Missing required 'issueId' string in request body" });
      return;
    }

    const [issue] = await db
      .select({ id: issues.id, title: issues.title, status: issues.status })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.companyId, companyId)))
      .limit(1);
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }

    const result = await service.mirrorIssueStatusToExternalTicket(companyId, issue, {
      deliverableUrl: typeof deliverableUrl === "string" ? deliverableUrl : null,
    });
    res.json({ mirrored: result !== null, body: result?.body ?? null });
  });

  return router;
}
