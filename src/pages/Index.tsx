import { useState, useRef, useEffect, useCallback } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Conversation, Message, generateId, getLLMConfig, streamChat } from "@/lib/llm";
import {
  appendChatMessages,
  buildContext,
  createChat,
  deleteChat,
  getChat,
  getChats,
  healthCheck,
  migrateFromLocalStorage,
  type MemoryConversation,
  type MemoryMessage,
} from "@/lib/memory-api";
import { Bot, Menu, X } from "lucide-react";

type UIConversation = Conversation & { updatedAt: number };

function loadLegacyConversations(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem("conversations") ?? "[]");
  } catch {
    return [];
  }
}

function toUIConversation(chat: MemoryConversation): UIConversation {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messages: chat.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, ts: m.ts })),
  };
}

function upsertAndSort(list: UIConversation[], next: UIConversation): UIConversation[] {
  const updated = list.some((c) => c.id === next.id)
    ? list.map((c) => (c.id === next.id ? next : c))
    : [next, ...list];

  return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
}

const Index = () => {
  const [conversations, setConversations] = useState<UIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [backendError, setBackendError] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConv?.messages]);

  const updateConversation = useCallback((id: string, updater: (c: UIConversation) => UIConversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }, []);

  const loadConversationById = useCallback(async (id: string) => {
    const chat = await getChat(id);
    setConversations((prev) => upsertAndSort(prev, toUIConversation(chat)));
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await healthCheck();

        const legacyConversations = loadLegacyConversations();
        if (legacyConversations.length > 0) {
          await migrateFromLocalStorage(legacyConversations);
        }

        const summaries = await getChats();
        const initialConversations: UIConversation[] = summaries
          .map((s) => ({
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            messages: [],
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);

        setConversations(initialConversations);

        if (initialConversations.length > 0) {
          const firstId = initialConversations[0].id;
          setActiveId(firstId);
          await loadConversationById(firstId);
        }

        setBackendAvailable(true);
        setBackendError("");
      } catch (err) {
        setBackendAvailable(false);
        setBackendError(err instanceof Error ? err.message : "Memory backend unavailable");
      }
    };

    bootstrap();
  }, [loadConversationById]);

  const handleNew = async () => {
    if (!backendAvailable) return;

    const id = generateId();
    const now = Date.now();
    const created = await createChat({ id, title: "New Chat", createdAt: now });
    setConversations((prev) => upsertAndSort(prev, toUIConversation(created)));
    setActiveId(id);
    setSidebarOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!backendAvailable) return;

    await deleteChat(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  };

  const handleSend = async (content: string) => {
    if (!backendAvailable) return;

    let convId = activeId;

    if (!convId) {
      const id = generateId();
      const now = Date.now();
      const created = await createChat({
        id,
        title: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
        createdAt: now,
      });
      setConversations((prev) => upsertAndSort(prev, toUIConversation(created)));
      setActiveId(id);
      convId = id;
    }

    const userMsg: MemoryMessage = {
      id: generateId(),
      role: "user",
      content,
      ts: Date.now(),
    };

    const assistantMsg: Message = { id: generateId(), role: "assistant", content: "", ts: Date.now() };

    updateConversation(convId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? content.slice(0, 40) + (content.length > 40 ? "..." : "") : c.title,
      updatedAt: Date.now(),
      messages: [...c.messages, userMsg, assistantMsg],
    }));

    await appendChatMessages(convId, [userMsg]);

    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const config = getLLMConfig();

    let assistantContent = "";

    try {
      const context = await buildContext({ chatId: convId });
      const contextMessages: Message[] = context.messages.map((m, index) => ({
        id: `ctx-${index}`,
        role: m.role,
        content: m.content,
      }));

      await streamChat({
        messages: contextMessages,
        config,
        signal: controller.signal,
        onDelta: (text) => {
          assistantContent += text;
          updateConversation(convId!, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: m.content + text } : m
            ),
          }));
        },
        onDone: () => {
          setIsLoading(false);
          abortRef.current = null;
        },
      });

      const persisted = await appendChatMessages(convId, [
        { id: assistantMsg.id, role: "assistant", content: assistantContent, ts: Date.now() },
      ]);
      setConversations((prev) => upsertAndSort(prev, toUIConversation(persisted)));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect to LLM. Make sure Ollama is running.";
      const isAbort = err instanceof Error && err.name === "AbortError";

      if (!isAbort) {
        updateConversation(convId!, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: `⚠️ Error: ${errorMessage}` } : m
          ),
        }));

        await appendChatMessages(convId, [
          { id: assistantMsg.id, role: "assistant", content: `⚠️ Error: ${errorMessage}`, ts: Date.now() },
        ]);
      }

      setIsLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 rounded-lg bg-card p-2 text-muted-foreground hover:text-foreground md:hidden transition-colors"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => {
            setActiveId(id);
            setSidebarOpen(false);
            loadConversationById(id).catch(() => undefined);
          }}
          onNew={() => {
            handleNew().catch(() => undefined);
          }}
          onDelete={(id) => {
            handleDelete(id).catch(() => undefined);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          disabled={!backendAvailable}
        />
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {!backendAvailable && (
          <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            Servidor de memoria no disponible: {backendError}
          </div>
        )}

        {activeConv ? (
          <>
            {/* Header */}
            <div className="border-b border-border px-4 py-3 flex items-center gap-3">
              <div className="md:hidden w-8" /> {/* spacer for mobile menu btn */}
              <h1 className="text-sm font-medium text-foreground truncate">
                {activeConv.title}
              </h1>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {activeConv.messages.map((msg, i) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isStreaming={
                    isLoading &&
                    msg.role === "assistant" &&
                    i === activeConv.messages.length - 1
                  }
                />
              ))}
            </div>

            {/* Input */}
            <ChatInput
              onSend={(msg) => {
                handleSend(msg).catch(() => undefined);
              }}
              onStop={handleStop}
              isLoading={isLoading}
              disabled={!backendAvailable}
            />
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <div className="rounded-2xl bg-primary/10 p-6">
              <Bot className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center max-w-md">
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Local AI Chat
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Chat with your local LLM through Ollama. Your conversations stay on your machine — private and fast.
              </p>
            </div>
            <button
              onClick={() => {
                handleNew().catch(() => undefined);
              }}
              disabled={!backendAvailable}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              Start a new chat
            </button>
            <p className="text-xs text-muted-foreground">
              Make sure Ollama is running on localhost:11434
            </p>
          </div>
        )}
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default Index;
