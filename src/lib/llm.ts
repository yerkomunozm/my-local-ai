export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

export type LLMConfig = {
  baseUrl: string;
  model: string;
};

const DEFAULT_CONFIG: LLMConfig = {
  baseUrl: "http://localhost:11434",
  model: "llama3.2",
};

export function getLLMConfig(): LLMConfig {
  const saved = localStorage.getItem("llm-config");
  if (saved) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export function saveLLMConfig(config: LLMConfig) {
  localStorage.setItem("llm-config", JSON.stringify(config));
}

export async function fetchModels(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.models?.map((m: { name: string }) => m.name) ?? [];
  } catch {
    return [];
  }
}

export async function streamChat({
  messages,
  config,
  onDelta,
  onDone,
  signal,
}: {
  messages: Message[];
  config: LLMConfig;
  onDelta: (text: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}) {
  const res = await fetch(`${config.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`LLM error: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) {
          onDelta(parsed.message.content);
        }
        if (parsed.done) {
          onDone();
          return;
        }
      } catch {
        // partial JSON, skip
      }
    }
  }

  onDone();
}

let nextId = 0;
export function generateId(): string {
  return `${Date.now()}-${nextId++}`;
}
