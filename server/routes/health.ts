import { Router } from "express";

export function createHealthRouter(dbPath: string) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", dbPath });
  });

  return router;
}
