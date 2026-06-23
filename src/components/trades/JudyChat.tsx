"use client";

import { Bot, Send } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { askJudy, type JudyMessage } from "@/app/actions/judy";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const WELCOME: JudyMessage = {
  content:
    "Hi, I'm Judy! I have full access to this trade's data: invoices, quotes, ledger entries, shareholder distributions, and more. What would you like to know?",
  role: "assistant",
};

export function JudyChat({ tradeId }: { tradeId: string }) {
  const [messages, setMessages] = useState<JudyMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();

    if (!text || isPending) {
      return;
    }

    const userMessage: JudyMessage = { content: text, role: "user" };
    const nextMessages: JudyMessage[] = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");

    const historyForApi = nextMessages.filter((message) => message !== WELCOME);

    startTransition(async () => {
      const result = await askJudy(tradeId, historyForApi);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setMessages((previous) => [...previous, { content: result.reply, role: "assistant" }]);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[480px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d1b34]">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#0d1b34]">Judy</p>
          <p className="text-xs text-slate-500">Trade AI Assistant</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.map((message, index) => (
          <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={index}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                message.role === "user" ? "bg-[#0d1b34] text-white" : "bg-slate-100 text-[#0d1b34]"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isPending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-4 py-2.5">
              <span className="inline-flex gap-1">
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: "300ms" }}
                />
              </span>
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="flex items-end gap-3">
          <Textarea
            className="max-h-32 min-h-[44px] resize-none"
            disabled={isPending}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Judy anything about this trade... (Enter to send)"
            rows={1}
            value={input}
          />
          <Button
            className="shrink-0 bg-[#0d1b34] hover:bg-[#13294d]"
            disabled={!input.trim() || isPending}
            onClick={handleSend}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
