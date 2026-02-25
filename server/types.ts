export type MemoryRole = "user" | "assistant" | "system";

export type MemoryMessage = {
  id: string;
  role: MemoryRole;
  content: string;
  ts: number;
};

export type MemoryChat = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: MemoryMessage[];
};

export type ChatSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type UserProfile = {
  userId: "default";
  traits: string[];
  facts: string[];
  updatedAt: number;
};

export type ContextMessage = {
  role: MemoryRole;
  content: string;
};
