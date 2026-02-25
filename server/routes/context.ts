import { Router } from "express";
import { z } from "zod";

const contextSchema = z.object({
  chatId: z.string().min(1),
  newUserMessage: z.string().optional(),
});

export function createContextRouter(deps: {
  profileRepo: { getProfile: () => Promise<{ traits: string[]; facts: string[] }> };
  chatRepo: { getChat: (id: string) => Promise<{ messages: Array<{ role: "user" | "assistant" | "system"; content: string }> } | null> };
}) {
  const router = Router();

  router.post("/context/build", async (req, res, next) => {
    try {
      const parsed = contextSchema.parse(req.body ?? {});
      const [profile, chat] = await Promise.all([
        deps.profileRepo.getProfile(),
        deps.chatRepo.getChat(parsed.chatId),
      ]);

      if (!chat) {
        res.status(404).json({ error: "chat not found" });
        return;
      }

      const systemLines = [
        profile.traits.length ? `Traits: ${profile.traits.join(", ")}` : "",
        profile.facts.length ? `Facts: ${profile.facts.join(", ")}` : "",
      ].filter(Boolean);

      const messages = [] as Array<{ role: "user" | "assistant" | "system"; content: string }>;

      if (systemLines.length > 0) {
        messages.push({ role: "system", content: systemLines.join("\n") });
      }

      for (const msg of chat.messages) {
        messages.push({ role: msg.role, content: msg.content });
      }

      if (parsed.newUserMessage) {
        messages.push({ role: "user", content: parsed.newUserMessage });
      }

      res.json({ chatId: parsed.chatId, messages });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
