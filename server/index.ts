import { createMemoryDb } from "./db";
import { createProfileRepo } from "./repositories/profile-repo";
import { createChatRepo } from "./repositories/chat-repo";
import { createApp } from "./app";

const PORT = 8787;
const db = createMemoryDb();

const profileRepo = createProfileRepo(db.userProfileDb);
const chatRepo = createChatRepo(db.chatMemoryDb, db.chatIndexDb);
const app = createApp({ dbPath: db.dbPath, profileRepo, chatRepo });

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Memory API listening on http://localhost:${PORT}`);
});

const gracefulShutdown = async () => {
  server.close(async () => {
    await db.db.close();
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
