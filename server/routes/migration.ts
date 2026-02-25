import { Router } from "express";
import { z } from "zod";

const migrationMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const migrationConversationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.number().int().positive(),
  messages: z.array(migrationMessageSchema),
});

const migrationSchema = z.object({
  conversations: z.array(migrationConversationSchema),
});

export function createMigrationRouter(deps: {
  profileRepo: {
    isMigrationDone: () => Promise<boolean>;
    markMigrationDone: () => Promise<void>;
  };
  chatRepo: {
    listChats: () => Promise<unknown[]>;
    upsertChat: (chat: {
      id: string;
      title: string;
      createdAt: number;
      updatedAt: number;
      messages: Array<{ id: string; role: "user" | "assistant"; content: string; ts: number }>;
    }) => Promise<unknown>;
  };
}) {
  const router = Router();

  router.post("/migrate/local-storage", async (req, res, next) => {
    try {
      const parsed = migrationSchema.parse(req.body ?? {});
      const alreadyDone = await deps.profileRepo.isMigrationDone();
      if (alreadyDone) {
        res.json({ migrated: false, reason: "already_migrated" });
        return;
      }

      const existingChats = await deps.chatRepo.listChats();
      if (existingChats.length > 0) {
        await deps.profileRepo.markMigrationDone();
        res.json({ migrated: false, reason: "db_not_empty" });
        return;
      }

      for (const conv of parsed.conversations) {
        const tsBase = conv.createdAt;
        await deps.chatRepo.upsertChat({
          id: conv.id,
          title: conv.title,
          createdAt: conv.createdAt,
          updatedAt: Date.now(),
          messages: conv.messages.map((m, index) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            ts: tsBase + index,
          })),
        });
      }

      await deps.profileRepo.markMigrationDone();
      res.json({ migrated: true, importedChats: parsed.conversations.length });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
