import { Router } from "express";
import { z } from "zod";

const profileSchema = z.object({
  traits: z.array(z.string()).default([]),
  facts: z.array(z.string()).default([]),
});

export function createProfileRouter(profileRepo: {
  getProfile: () => Promise<unknown>;
  updateProfile: (input: { traits: string[]; facts: string[] }) => Promise<unknown>;
}) {
  const router = Router();

  router.get("/profile", async (_req, res, next) => {
    try {
      const profile = await profileRepo.getProfile();
      res.json(profile);
    } catch (err) {
      next(err);
    }
  });

  router.put("/profile", async (req, res, next) => {
    try {
      const parsed = profileSchema.parse(req.body ?? {});
      const updated = await profileRepo.updateProfile(parsed);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
