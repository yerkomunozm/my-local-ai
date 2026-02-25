import { Conversation, Message } from "@/lib/llm";

export type UserProfile = {
  userId: "default";
  traits: string[];
  facts: string[];
  updatedAt: number;
};

export type MemoryMessage = Message & { ts: number };

export type MemoryConversation = Omit<Conversation, "messages"> & {
  updatedAt: number;
  messages: MemoryMessage[];
};

export type ChatSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type ContextBuildResponse = {
  chatId: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Memory API ${res.status}: ${txt || res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function healthCheck() {
  return request<{ status: string; dbPath: string }>("/api/health");
}

export function getProfile() {
  return request<UserProfile>("/api/profile");
}

export function updateProfile(payload: { traits: string[]; facts: string[] }) {
  return request<UserProfile>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getChats() {
  return request<ChatSummary[]>("/api/chats");
}

export function getChat(id: string) {
  return request<MemoryConversation>(`/api/chats/${id}`);
}

export function createChat(chat: { id: string; title: string; createdAt: number }) {
  return request<MemoryConversation>("/api/chats", {
    method: "POST",
    body: JSON.stringify(chat),
  });
}

export function appendChatMessages(chatId: string, messages: MemoryMessage[]) {
  return request<MemoryConversation>(`/api/chats/${chatId}/messages`, {
    method: "PUT",
    body: JSON.stringify({ messages }),
  });
}

export function deleteChat(chatId: string) {
  return request<void>(`/api/chats/${chatId}`, { method: "DELETE" });
}

export function buildContext(payload: { chatId: string; newUserMessage?: string }) {
  return request<ContextBuildResponse>("/api/context/build", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function migrateFromLocalStorage(conversations: Conversation[]) {
  return request<{ migrated: boolean; reason?: string; importedChats?: number }>("/api/migrate/local-storage", {
    method: "POST",
    body: JSON.stringify({ conversations }),
  });
}
