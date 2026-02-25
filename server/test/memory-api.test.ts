/* @vitest-environment node */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createMemoryDb } from "../db";
import { createProfileRepo } from "../repositories/profile-repo";
import { createChatRepo } from "../repositories/chat-repo";
import { createApp } from "../app";

let tempDir = "";
let db: ReturnType<typeof createMemoryDb>;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "memory-api-"));
  db = createMemoryDb(path.join(tempDir, "db"));

  const profileRepo = createProfileRepo(db.userProfileDb);
  const chatRepo = createChatRepo(db.chatMemoryDb, db.chatIndexDb);

  app = createApp({ dbPath: db.dbPath, profileRepo, chatRepo });
});

afterEach(async () => {
  await db.db.close();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("memory api", () => {
  it("creates, appends and fetches chat messages", async () => {
    const createdAt = Date.now();

    await request(app)
      .post("/api/chats")
      .send({ id: "chat-1", title: "Chat 1", createdAt })
      .expect(201);

    await request(app)
      .put("/api/chats/chat-1/messages")
      .send({
        messages: [
          { id: "m1", role: "user", content: "Hola", ts: createdAt + 1 },
          { id: "m2", role: "assistant", content: "Hola!", ts: createdAt + 2 },
        ],
      })
      .expect(200);

    const chat = await request(app).get("/api/chats/chat-1").expect(200);

    expect(chat.body.id).toBe("chat-1");
    expect(chat.body.messages).toHaveLength(2);
    expect(chat.body.messages[0].content).toBe("Hola");
    expect(chat.body.messages[1].content).toBe("Hola!");
  });

  it("lists chats sorted by updatedAt desc and removes index on delete", async () => {
    const base = Date.now();

    await request(app).post("/api/chats").send({ id: "a", title: "A", createdAt: base }).expect(201);
    await request(app).post("/api/chats").send({ id: "b", title: "B", createdAt: base + 1 }).expect(201);

    await request(app)
      .put("/api/chats/a/messages")
      .send({ messages: [{ id: "a1", role: "user", content: "x", ts: base + 2 }] })
      .expect(200);

    const list1 = await request(app).get("/api/chats").expect(200);
    expect(list1.body[0].id).toBe("a");

    await request(app).delete("/api/chats/a").expect(204);

    const list2 = await request(app).get("/api/chats").expect(200);
    expect(list2.body.find((x: { id: string }) => x.id === "a")).toBeUndefined();
  });

  it("reads and updates profile", async () => {
    const initial = await request(app).get("/api/profile").expect(200);
    expect(initial.body.userId).toBe("default");

    const updated = await request(app)
      .put("/api/profile")
      .send({ traits: ["conciso"], facts: ["español"] })
      .expect(200);

    expect(updated.body.traits).toEqual(["conciso"]);
    expect(updated.body.facts).toEqual(["español"]);
  });

  it("builds context combining profile and chat history", async () => {
    const createdAt = Date.now();

    await request(app)
      .put("/api/profile")
      .send({ traits: ["directo"], facts: ["prefiere español"] })
      .expect(200);

    await request(app)
      .post("/api/chats")
      .send({ id: "ctx", title: "Ctx", createdAt })
      .expect(201);

    await request(app)
      .put("/api/chats/ctx/messages")
      .send({ messages: [{ id: "u1", role: "user", content: "Hola", ts: createdAt + 1 }] })
      .expect(200);

    const context = await request(app)
      .post("/api/context/build")
      .send({ chatId: "ctx", newUserMessage: "¿Cómo estás?" })
      .expect(200);

    expect(context.body.messages[0].role).toBe("system");
    expect(context.body.messages[1].content).toBe("Hola");
    expect(context.body.messages[2].content).toBe("¿Cómo estás?");
  });
});
