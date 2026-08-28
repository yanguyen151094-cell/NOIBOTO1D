import { useState } from "react";
import type { KaraokeSong } from "@/types";

interface QueuePanelProps {
  queue: KaraokeSong[];
  busy: boolean;
  onPlay: (song: KaraokeSong) => void;
  onRemove: (songId: string) => void;
  onAdd: (url: string) => Promise<void>;
}

export default function QueuePanel({ queue, busy, onPlay, onRemove, onAdd }: QueuePanelProps) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const trimmed = url.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await onAdd(trimmed);
      setUrl("");
    } finally {
      setAdding(false);
    }
  };

  const playing = queue.find((s) => s.status === "playing");

  return (
    <div className="flex flex-col h-full bg-background-50 rounded-lg border border-background-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200">
        <p className="text-sm font-semibold text-foreground-900">Hàng chờ bài hát</p>
        <p className="text-[11px] text-foreground-500">
          {playing ? `Đang hát: ${playing.title}` : "Chưa có bài nào đang phát"}
        </p>
      </div>

      <div className="px-4 py-3 border-b border-background-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Dán link YouTube karaoke vào đây..."
            className="flex-1 px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !url.trim()}
            className="px-3 py-2 rounded-md bg-secondary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {adding ? "..." : "Thêm"}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-foreground-400">
          Mẹo: lên YouTube tìm "[tên bài] karaoke", copy link rồi dán vào đây.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto cs-scroll p-2 space-y-2">
        {queue.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="w-12 h-12 rounded-full bg-background-100 flex items-center justify-center mx-auto">
              <i className="ri-music-2-line text-xl text-foreground-400" />
            </div>
            <p className="mt-3 text-sm text-foreground-500">Chưa có bài hát nào</p>
            <p className="mt-1 text-xs text-foreground-400">Dán link YouTube ở trên để thêm bài hát.</p>
          </div>
        ) : (
          queue.map((song) => {
            const isPlaying = song.status === "playing";
            const isPlayed = song.status === "played";
            return (
              <div
                key={song.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                  isPlaying
                    ? "bg-accent-100 border-accent-300"
                    : isPlayed
                      ? "bg-background-100 border-background-200 opacity-70"
                      : "bg-background-50 border-background-200 hover:bg-background-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => !isPlaying && onPlay(song)}
                  disabled={isPlaying}
                  className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 text-white cursor-pointer ${
                    isPlaying ? "bg-accent-500" : "bg-secondary-500 hover:bg-secondary-600"
                  }`}
                  title={isPlaying ? "Đang phát" : "Phát bài này"}
                >
                  <i className={`${isPlaying ? "ri-music-2-fill animate-pulse" : "ri-play-fill"} text-lg`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground-900 break-words leading-snug line-clamp-2">{song.title}</p>
                  <p className="text-[11px] text-foreground-500">
                    {isPlaying ? "Đang hát" : isPlayed ? "Đã hát" : "Chờ phát"}
                    {song.addedByName ? ` · ${song.addedByName}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(song.id)}
                  disabled={busy}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-400 hover:bg-red-500/10 hover:text-red-400 cursor-pointer shrink-0"
                  title="Xóa khỏi hàng chờ"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}