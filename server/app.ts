import express from "express";
import { ZodError } from "zod";
import { createHealthRouter } from "./routes/health";
import { createProfileRouter } from "./routes/profile";
import { createChatsRouter } from "./routes/chats";
import { createContextRouter } from "./routes/context";
import { createMigrationRouter } from "./routes/migration";

export function createApp(deps: {
  dbPath: string;
  profileRepo: {
    getProfile: () => Promise<{ traits: string[]; facts: string[] }>;
    updateProfile: (input: { traits: string[]; facts: string[] }) => Promise<unknown>;
    isMigrationDone: () => Promise<boolean>;
    markMigrationDone: () => Promise<void>;
  };
  chatRepo: {
    listChats: () => Promise<unknown[]>;
    getChat: (id: string) => Promise<any | null>;
    createChat: (chat: any) => Promise<unknown>;
    appendMessages: (chatId: string, messages: any[]) => Promise<unknown | null>;
    upsertChat: (chat: any) => Promise<unknown>;
    deleteChat: (id: string) => Promise<boolean>;
  };
}) {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createHealthRouter(deps.dbPath));
  app.use("/api", createProfileRouter(deps.profileRepo));
  app.use("/api", createChatsRouter(deps.chatRepo));
  app.use("/api", createContextRouter({ profileRepo: deps.profileRepo, chatRepo: deps.chatRepo }));
  app.use("/api", createMigrationRouter({ profileRepo: deps.profileRepo, chatRepo: deps.chatRepo }));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "validation_error", issues: err.issues });
      return;
    }

    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.status(500).json({ error: "unknown_error" });
  });

  return app;
}
