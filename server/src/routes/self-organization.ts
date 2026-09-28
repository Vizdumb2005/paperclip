import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { selfOrganizationService } from "../services/self-organization.js";
import { assertBoard, assertBoardOrAgent, assertCompanyAccess } from "./authz.js";

export function selfOrganizationRoutes(db: Db) {
  const router = Router();
  const service = selfOrganizationService(db);

  router.get("/companies/:companyId/self-organization/proposals", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const proposals = await service.listProposals(companyId);
    res.json({ proposals });
  });

  router.post("/companies/:companyId/self-organization/proposals", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const agentId = (req as any).agent?.id ?? "system";
    const approval = await service.submitProposal(companyId, agentId, req.body);
    res.status(201).json({ approval });
  });

  router.post("/companies/:companyId/self-organization/evaluate", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const agentId = (req as any).agent?.id;
    const proposals = await service.evaluateAndPropose(companyId, agentId);
    res.status(200).json({ proposals });
  });

  router.post("/companies/:companyId/self-organization/proposals/:approvalId/apply", async (req, res) => {
    const { companyId, approvalId } = req.params;
    assertBoard(req); // Only human operator / board can approve structural changes
    assertCompanyAccess(req, companyId);

    const userId = (req as any).user?.id ?? "board";
    try {
      const approval = await service.applyApprovedProposal(companyId, approvalId, userId);
      res.json({ approval });
    } catch (err: any) {
      res.status(400).json({ error: err.message ?? "Failed to apply proposal" });
    }
  });

  return router;
}
