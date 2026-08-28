import { useEffect, useRef, useState } from "react";
import type { KaraokeMessage } from "@/types";
import { formatTime } from "@/utils/ui";

interface ChatPanelProps {
  messages: KaraokeMessage[];
  currentUserId: string;
  onSend: (content: string) => void;
}

const CUTE_EMOJIS = [
  "🎤", "🎵", "🎶", "🎉", "👏", "😍", "🥳", "🔥", "💃", "🕺", "❤️", "😂", "🤣", "😎", "✨", "👍",
];

export default function ChatPanel({ messages, currentUserId, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
    setShowEmoji(false);
  };

  return (
    <div className="flex flex-col h-full bg-background-50 rounded-lg border border-background-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200">
        <p className="text-sm font-semibold text-foreground-900">Trò chuyện</p>
        <p className="text-[11px] text-foreground-500">Cổ vũ nhau trong lúc hát nhé 🎤</p>
      </div>

      <div className="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-foreground-400 py-10">
            Chưa có tin nhắn nào. Hãy bắt đầu cổ vũ mọi người! 🎶
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  {!mine && (
                    <span className="text-[10px] text-foreground-400 mb-0.5 px-1">{m.senderName}</span>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      mine
                        ? "bg-secondary-500 text-white rounded-br-md"
                        : "bg-background-100 text-foreground-900 rounded-bl-md"
                    }`}
                  >
                    {m.content}
                  </div>
                  <span className="text-[10px] text-foreground-400 mt-0.5 px-1">{formatTime(m.sentAt)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {showEmoji && (
        <div className="px-3 py-2 border-t border-background-200 bg-background-50 flex gap-1 flex-wrap">
          {CUTE_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setInput((v) => v + e)}
              className="w-8 h-8 rounded-md text-lg hover:bg-background-100 cursor-pointer"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-3 border-t border-background-200 bg-background-50">
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-100 cursor-pointer"
          title="Biểu tượng cảm xúc"
        >
          <i className="ri-emotion-line text-lg" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Nhắn gì đó..."
          className="flex-1 px-3 py-2 rounded-full border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          type="button"
          onClick={send}
          className="w-10 h-10 rounded-full bg-secondary-500 text-white flex items-center justify-center hover:bg-secondary-600 cursor-pointer shrink-0"
          aria-label="Gửi"
        >
          <i className="ri-send-plane-fill" />
        </button>
      </div>
    </div>
  );
}