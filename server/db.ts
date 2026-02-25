import path from "node:path";
import { Level } from "level";
import { ChatSummary, MemoryChat, UserProfile } from "./types";

export type MemoryDb = ReturnType<typeof createMemoryDb>;

export function createMemoryDb(customPath?: string) {
  const dbPath = customPath ?? path.resolve(process.cwd(), "data/memory-db");
  const db = new Level<string, unknown>(dbPath, { valueEncoding: "json" });

  const userProfileDb = db.sublevel<string, UserProfile | { done: boolean; updatedAt: number }>("user_profile", {
    valueEncoding: "json",
  });

  const chatMemoryDb = db.sublevel<string, MemoryChat>("chat_memory", {
    valueEncoding: "json",
  });

  const chatIndexDb = db.sublevel<string, ChatSummary>("chat_index", {
    valueEncoding: "json",
  });

  return {
    dbPath,
    db,
    userProfileDb,
    chatMemoryDb,
    chatIndexDb,
  };
}
