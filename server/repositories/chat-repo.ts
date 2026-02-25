import { ChatSummary, MemoryChat, MemoryMessage } from "../types";

function makeChatKey(chatId: string): string {
  return `chat:${chatId}`;
}

function invertTs(updatedAt: number): string {
  return String(9999999999999 - updatedAt).padStart(13, "0");
}

function makeIndexKey(updatedAt: number, chatId: string): string {
  return `chat_index:${invertTs(updatedAt)}:${chatId}`;
}

function toSummary(chat: MemoryChat): ChatSummary {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

function generateChatTitleFromMessage(content: string): string {
  const cleaned = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Conversacion general";

  const firstChunk = cleaned.split(/[.!?\n]/)[0]?.trim() || cleaned;
  const maxLen = 60;

  if (firstChunk.length <= maxLen) return firstChunk;

  const shortened = firstChunk.slice(0, maxLen);
  const lastSpace = shortened.lastIndexOf(" ");
  if (lastSpace > 20) {
    return `${shortened.slice(0, lastSpace)}...`;
  }
  return `${shortened}...`;
}

export function createChatRepo(
  chatMemoryDb: {
    get: (key: string) => Promise<MemoryChat>;
    put: (key: string, value: MemoryChat) => Promise<void>;
    del: (key: string) => Promise<void>;
  },
  chatIndexDb: {
    put: (key: string, value: ChatSummary) => Promise<void>;
    del: (key: string) => Promise<void>;
    iterator: () => AsyncIterable<[string, ChatSummary]>;
  }
) {
  const getChat = async (id: string): Promise<MemoryChat | null> => {
    try {
      return await chatMemoryDb.get(makeChatKey(id));
    } catch {
      return null;
    }
  };

  const upsertChat = async (chat: MemoryChat): Promise<MemoryChat> => {
    const existing = await getChat(chat.id);
    if (existing) {
      await chatIndexDb.del(makeIndexKey(existing.updatedAt, existing.id)).catch(() => undefined);
    }

    await chatMemoryDb.put(makeChatKey(chat.id), chat);
    await chatIndexDb.put(makeIndexKey(chat.updatedAt, chat.id), toSummary(chat));
    return chat;
  };

  const createChat = async (chat: MemoryChat): Promise<MemoryChat> => upsertChat(chat);

  const appendMessages = async (chatId: string, messages: MemoryMessage[]): Promise<MemoryChat | null> => {
    const existing = await getChat(chatId);
    if (!existing) return null;

    const hadUserMessages = existing.messages.some((m) => m.role === "user");
    const firstIncomingUser = messages.find((m) => m.role === "user" && m.content.trim().length > 0);

    const next: MemoryChat = {
      ...existing,
      title: !hadUserMessages && firstIncomingUser
        ? generateChatTitleFromMessage(firstIncomingUser.content)
        : existing.title,
      updatedAt: Date.now(),
      messages: [...existing.messages, ...messages],
    };

    return upsertChat(next);
  };

  const setMessages = async (chatId: string, messages: MemoryMessage[]): Promise<MemoryChat | null> => {
    const existing = await getChat(chatId);
    if (!existing) return null;

    const next: MemoryChat = {
      ...existing,
      updatedAt: Date.now(),
      messages,
    };

    return upsertChat(next);
  };

  const deleteChat = async (id: string): Promise<boolean> => {
    const existing = await getChat(id);
    if (!existing) return false;

    await chatMemoryDb.del(makeChatKey(id));
    await chatIndexDb.del(makeIndexKey(existing.updatedAt, existing.id)).catch(() => undefined);
    return true;
  };

  const listChats = async (): Promise<ChatSummary[]> => {
    const rows: ChatSummary[] = [];
    for await (const [, summary] of chatIndexDb.iterator()) {
      rows.push(summary);
    }
    return rows;
  };

  return {
    getChat,
    listChats,
    createChat,
    upsertChat,
    appendMessages,
    setMessages,
    deleteChat,
  };
}
