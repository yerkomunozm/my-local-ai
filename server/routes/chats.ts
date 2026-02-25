import { Router } from "express";
import { z } from "zod";

const createChatSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.number().int().positive(),
});

const messageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  ts: z.number().int().positive(),
});

const appendMessagesSchema = z.object({
  messages: z.array(messageSchema),
});

export function createChatsRouter(chatRepo: {
  listChats: () => Promise<unknown[]>;
  getChat: (id: string) => Promise<unknown | null>;
  createChat: (chat: {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: unknown[];
  }) => Promise<unknown>;
  appendMessages: (chatId: string, messages: unknown[]) => Promise<unknown | null>;
  deleteChat: (id: string) => Promise<boolean>;
}) {
  const router = Router();

  router.get("/chats", async (_req, res, next) => {
    try {
      const chats = await chatRepo.listChats();
      res.json(chats);
    } catch (err) {
      next(err);
    }
  });

  router.get("/chats/:id", async (req, res, next) => {
    try {
      const chat = await chatRepo.getChat(req.params.id);
      if (!chat) {
        res.status(404).json({ error: "chat not found" });
        return;
      }
      res.json(chat);
    } catch (err) {
      next(err);
    }
  });

  router.post("/chats", async (req, res, next) => {
    try {
      const parsed = createChatSchema.parse(req.body ?? {});
      const created = await chatRepo.createChat({
        ...parsed,
        updatedAt: parsed.createdAt,
        messages: [],
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.put("/chats/:id/messages", async (req, res, next) => {
    try {
      const parsed = appendMessagesSchema.parse(req.body ?? {});
      const updated = await chatRepo.appendMessages(req.params.id, parsed.messages);
      if (!updated) {
        res.status(404).json({ error: "chat not found" });
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/chats/:id", async (req, res, next) => {
    try {
      const deleted = await chatRepo.deleteChat(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "chat not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
