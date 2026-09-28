import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { companyMemoryService } from "../services/company-memory.js";
import { assertBoardOrAgent, assertCompanyAccess } from "./authz.js";

export function companyMemoryRoutes(db: Db) {
  const router = Router();
  const service = companyMemoryService(db);

  router.get("/companies/:companyId/memory/providers", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const providers = await service.listProviders(companyId);
    res.json({ providers });
  });

  router.post("/companies/:companyId/memory/providers", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const provider = await service.upsertProvider(companyId, req.body);
    res.status(201).json({ provider });
  });

  router.post("/companies/:companyId/memory/search", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const results = await service.search(companyId, req.body);
    res.json({ results });
  });

  router.post("/companies/:companyId/memory/ingest", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const records = await service.ingestDocument(companyId, req.body);
    res.status(201).json({ records });
  });

  router.get("/companies/:companyId/memory/playbooks", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const playbooks = await service.listPlaybooks(companyId);
    res.json({ playbooks });
  });

  return router;
}
