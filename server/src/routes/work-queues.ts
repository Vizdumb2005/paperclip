import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { workQueueService } from "../services/work-queues.js";
import { assertBoardOrAgent, assertCompanyAccess } from "./authz.js";

export function workQueueRoutes(db: Db) {
  const router = Router();
  const service = workQueueService(db);

  router.get("/companies/:companyId/work-queues", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const queues = await service.listQueues(companyId);
    res.json({ queues });
  });

  router.post("/companies/:companyId/work-queues", async (req, res) => {
    const { companyId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const queue = await service.createQueue(companyId, req.body);
    res.status(201).json({ queue });
  });

  router.get("/companies/:companyId/work-queues/:key", async (req, res) => {
    const { companyId, key } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const queue = await service.getQueue(companyId, key);
    if (!queue) {
      res.status(404).json({ error: "Queue not found" });
      return;
    }
    res.json({ queue });
  });

  router.post("/companies/:companyId/work-queues/:key/ingest", async (req, res) => {
    const { companyId, key } = req.params;
    // Allow external on-ramp webhook ingestions or board/agent callers
    assertCompanyAccess(req, companyId);

    try {
      const item = await service.ingest(companyId, key, req.body);
      res.status(201).json({ item });
    } catch (err: any) {
      res.status(400).json({ error: err.message ?? "Ingestion failed" });
    }
  });

  router.get("/companies/:companyId/work-queues/:key/items", async (req, res) => {
    const { companyId, key } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    const queue = await service.getQueue(companyId, key);
    if (!queue) {
      res.status(404).json({ error: "Queue not found" });
      return;
    }

    const status = req.query.status as any;
    const items = await service.listItems(companyId, queue.id, status);
    res.json({ items });
  });

  router.post("/companies/:companyId/work-queues/items/:itemId/replay", async (req, res) => {
    const { companyId, itemId } = req.params;
    assertBoardOrAgent(req);
    assertCompanyAccess(req, companyId);

    try {
      const item = await service.replayDeadLetter(companyId, itemId);
      res.json({ item });
    } catch (err: any) {
      res.status(400).json({ error: err.message ?? "Replay failed" });
    }
  });

  return router;
}
