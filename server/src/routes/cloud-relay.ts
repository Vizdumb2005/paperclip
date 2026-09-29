import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { defaultBlobStoreRelayService } from "../services/blob-store-relay.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

export function cloudRelayRoutes(db: Db) {
  const router = Router();
  const relay = defaultBlobStoreRelayService;

  router.post("/companies/:companyId/export/relay", async (req, res) => {
    const { companyId } = req.params;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const { bucket, prefix, includeArtifacts } = req.body ?? {};
    const actorKey = req.actor?.userId ? `user:${req.actor.userId}` : "user:board";

    const result = await relay.exportCompanyToRelay(db, companyId, {
      bucket,
      prefix,
      includeArtifacts,
      actorKey,
    });

    res.status(201).json(result);
  });

  router.post("/companies/import/relay", async (req, res) => {
    assertBoard(req);

    const { bucket, prefix, manifestSha256, targetCompanyId, collisionStrategy } = req.body ?? {};
    if (!bucket || !prefix) {
      return res.status(400).json({ error: "Missing required parameters: bucket and prefix" });
    }

    if (targetCompanyId) {
      assertCompanyAccess(req, targetCompanyId);
    }

    const actorKey = req.actor?.userId ? `user:${req.actor.userId}` : "user:board";

    const result = await relay.importCompanyFromRelay(db, {
      bucket,
      prefix,
      manifestSha256,
      targetCompanyId,
      collisionStrategy,
      actorKey,
    });

    res.status(201).json(result);
  });

  router.get("/companies/transfers/:transferId/status", async (req, res) => {
    assertBoard(req);
    const { transferId } = req.params;

    const status = await relay.getTransferStatus(db, transferId);
    if (!status) {
      return res.status(404).json({ error: "Transfer run not found" });
    }

    if (status.companyId) {
      assertCompanyAccess(req, status.companyId);
    }

    res.json({ transfer: status });
  });

  return router;
}
