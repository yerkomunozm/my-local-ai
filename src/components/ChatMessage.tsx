import { Message } from "@/lib/llm";
import ReactMarkdown from "react-markdown";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`py-6 px-4 md:px-0 ${isUser ? "bg-chat-user" : "bg-chat-assistant"}`}>
      <div className="mx-auto max-w-3xl flex gap-4">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${
            isUser ? "bg-secondary" : "bg-primary/20"
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4 text-foreground" />
          ) : (
            <Bot className="w-4 h-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            {isUser ? "You" : "Assistant"}
          </div>
          <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {message.content ? (
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-secondary px-1.5 py-0.5 rounded text-primary text-sm" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="bg-secondary rounded-lg p-4 overflow-x-auto">
                        <code className={`${className} text-sm`} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : isStreaming ? (
              <span className="typing-cursor text-muted-foreground">Thinking</span>
            ) : null}
            {isStreaming && message.content && (
              <span className="typing-cursor" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
