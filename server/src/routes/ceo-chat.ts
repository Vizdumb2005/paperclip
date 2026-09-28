import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { ceoChatService } from "../services/ceo-chat.js";
import { assertBoardOrAgent, assertCompanyAccess } from "./authz.js";

export function ceoChatRoutes(db: Db) {
  const router = Router();
  const service = ceoChatService(db);

  router.post("/companies/:companyId/ceo-chat/resolve", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const { message } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Missing required 'message' string in request body" });
      return;
    }

    const actions = service.resolveWorkActions(message);
    res.json({ actions });
  });

  router.post("/companies/:companyId/ceo-chat/execute", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const { action } = req.body;
    if (!action || !action.actionType) {
      res.status(400).json({ error: "Missing required 'action' in request body" });
      return;
    }

    const actor = req.actor;
    const actorId = actor.type === "board" ? actor.userId : actor.agentId;
    const result = await service.executeWorkAction(companyId, action, actorId);
    res.status(201).json(result);
  });

  return router;
}
