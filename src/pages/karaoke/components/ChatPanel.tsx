import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { KaraokeMessage } from "@/types";
import { uploadImage } from "@/lib/actions";
import { formatTime } from "@/utils/ui";

interface ChatPanelProps {
  messages: KaraokeMessage[];
  currentUserId: string;
  onSend: (content: string, imageUrl?: string) => void;
}

const CUTE_EMOJIS = [
  "🎤", "🎵", "🎶", "🎉", "👏", "😍", "🥳", "🔥", "💃", "🕺", "❤️", "😂", "🤣", "😎", "✨", "👍",
];

export default function ChatPanel({ messages, currentUserId, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Ảnh quá lớn (tối đa 5MB).");
      return;
    }
    setError("");
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const send = async () => {
    const text = input.trim();
    if (!text && !imageFile) return;
    if (sending) return;
    setSending(true);
    setError("");
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, "karaoke-chat");
      }
      onSend(text, imageUrl);
      setInput("");
      clearImage();
      setShowEmoji(false);
    } catch {
      setError("Gửi ảnh thất bại, thử lại nhé.");
    } finally {
      setSending(false);
    }
  };

  const sendDisabled = sending || (!input.trim() && !imageFile);

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
                    className={`px-2 py-1.5 rounded-2xl text-sm leading-relaxed ${
                      mine
                        ? "bg-secondary-500 text-white rounded-br-md"
                        : "bg-background-100 text-foreground-900 rounded-bl-md"
                    }`}
                  >
                    {m.imageUrl && (
                      <img
                        src={m.imageUrl}
                        alt="Ảnh chat"
                        className="max-w-full max-h-56 w-auto rounded-lg mb-1 object-contain"
                      />
                    )}
                    {m.content && <span className="break-words whitespace-pre-wrap">{m.content}</span>}
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

      {imagePreview && (
        <div className="px-3 py-2 border-t border-background-200 bg-background-50 flex items-center gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Đang gửi"
              className="h-12 w-12 rounded-md object-cover border border-background-200"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center cursor-pointer"
              title="Bỏ ảnh"
            >
              <i className="ri-close-line" />
            </button>
          </div>
          <p className="text-xs text-foreground-500">Ảnh sẽ được gửi kèm tin nhắn</p>
        </div>
      )}

      {error && (
        <p className="px-3 pb-1 text-xs text-red-500">{error}</p>
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-100 cursor-pointer"
          title="Gửi ảnh"
        >
          <i className="ri-image-add-line text-lg" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />
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
          disabled={sendDisabled}
          className="w-10 h-10 rounded-full bg-secondary-500 text-white flex items-center justify-center hover:bg-secondary-600 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Gửi"
        >
          {sending ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-send-plane-fill" />}
        </button>
      </div>
    </div>
  );
}