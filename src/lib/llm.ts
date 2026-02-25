export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts?: number;
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
  model: "llama3",
};

function buildOllamaUrl(baseUrl: string, endpoint: "/api/tags" | "/api/chat"): string {
  const normalizedBase = (baseUrl || DEFAULT_CONFIG.baseUrl).trim().replace(/\/+$/, "");

  // Users often save base URLs like ".../api" or ".../v1". Ollama endpoints live under "/api/*".
  // Normalize these variants to prevent 404s such as "/api/api/chat" or "/v1/api/chat".
  if (normalizedBase.endsWith("/api")) {
    return `${normalizedBase}${endpoint.replace("/api", "")}`;
  }
  if (normalizedBase.endsWith("/v1")) {
    return `${normalizedBase.slice(0, -3)}${endpoint}`;
  }

  return `${normalizedBase}${endpoint}`;
}

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
    const res = await fetch(buildOllamaUrl(baseUrl, "/api/tags"));
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
  const chatUrl = buildOllamaUrl(config.baseUrl, "/api/chat");
  const openMessageList = messages.map((m) => ({ role: m.role, content: m.content }));

  const startRequest = async (model: string) =>
    fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: openMessageList,
        stream: true,
      }),
      signal,
    });

  let activeModel = config.model;
  let res = await startRequest(activeModel);

  // Auto-recover when configured model does not exist locally.
  if (res.status === 404) {
    let bodyText = "";
    try {
      bodyText = await res.clone().text();
    } catch {
      bodyText = "";
    }
    if (bodyText.includes("model") && bodyText.includes("not found")) {
      const availableModels = await fetchModels(config.baseUrl);
      if (availableModels.length > 0 && !availableModels.includes(activeModel)) {
        activeModel = availableModels[0];
        saveLLMConfig({ ...config, model: activeModel });
        res = await startRequest(activeModel);
      }
    }
  }

  if (!res.ok || !res.body) {
    let serverError = "";
    try {
      const payload = await res.clone().json();
      if (typeof payload?.error === "string") {
        serverError = payload.error;
      }
    } catch {
      // ignore non-JSON payloads
    }

    const suffix = serverError ? ` - ${serverError}` : "";
    throw new Error(`LLM error: ${res.status} ${res.statusText} (${chatUrl})${suffix}`);
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
