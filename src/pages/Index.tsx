import { useState, useRef, useEffect, useCallback } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { SettingsDialog } from "@/components/SettingsDialog";
import {
  Conversation,
  Message,
  generateId,
  getLLMConfig,
  streamChat,
} from "@/lib/llm";
import { Bot, Menu, X } from "lucide-react";

function loadConversations(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem("conversations") ?? "[]");
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem("conversations", JSON.stringify(convs));
}

const Index = () => {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConv?.messages]);

  const updateConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
    },
    []
  );

  const handleNew = () => {
    const id = generateId();
    const conv: Conversation = { id, title: "New Chat", messages: [], createdAt: Date.now() };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    setSidebarOpen(false);
  };

  const handleDelete = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  };

  const handleSend = async (content: string) => {
    let convId = activeId;

    if (!convId) {
      const id = generateId();
      const conv: Conversation = {
        id,
        title: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
        messages: [],
        createdAt: Date.now(),
      };
      setConversations((prev) => [conv, ...prev]);
      setActiveId(id);
      convId = id;
    }

    const userMsg: Message = { id: generateId(), role: "user", content };
    const assistantMsg: Message = { id: generateId(), role: "assistant", content: "" };

    // Update title if first message
    updateConversation(convId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? content.slice(0, 40) + (content.length > 40 ? "..." : "") : c.title,
      messages: [...c.messages, userMsg, assistantMsg],
    }));

    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const config = getLLMConfig();
    const allMessages = [...(activeConv?.messages ?? []), userMsg];

    try {
      await streamChat({
        messages: allMessages,
        config,
        signal: controller.signal,
        onDelta: (text) => {
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      updateConversation(convId!, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `⚠️ Error: ${err instanceof Error ? err.message : "Failed to connect to LLM. Make sure Ollama is running."}` }
            : m
        ),
      }));
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
          }}
          onNew={handleNew}
          onDelete={handleDelete}
          onOpenSettings={() => setSettingsOpen(true)}
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
              onSend={handleSend}
              onStop={handleStop}
              isLoading={isLoading}
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
              onClick={handleNew}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
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
