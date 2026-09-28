import { Router } from "express";
import type { Db } from "@paperclipai/db";
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

  return router;
}
