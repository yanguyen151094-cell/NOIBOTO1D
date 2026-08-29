import { useState } from "react";
import type { KaraokeSong, KaraokeSongRequest } from "@/types";

interface QueuePanelProps {
  queue: KaraokeSong[];
  requests: KaraokeSongRequest[];
  busy: boolean;
  isAdmin: boolean;
  currentUserId?: string;
  onPlay: (song: KaraokeSong) => void;
  onRemove: (songId: string) => void;
  onAdd: (url: string) => Promise<void>;
  onRequest: (url: string) => Promise<void>;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}

export default function QueuePanel({
  queue,
  requests,
  busy,
  isAdmin,
  currentUserId,
  onPlay,
  onRemove,
  onAdd,
  onRequest,
  onApprove,
  onReject,
}: QueuePanelProps) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"queue" | "requests">("queue");

  const handleAdd = async () => {
    const trimmed = url.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      if (isAdmin) {
        await onAdd(trimmed);
      } else {
        await onRequest(trimmed);
      }
      setUrl("");
    } finally {
      setAdding(false);
    }
  };

  const playing = queue.find((s) => s.status === "playing");
  const pendingRequests = requests.filter((r) => r.status === "pending");

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
            {adding ? "..." : isAdmin ? "Thêm" : "Yêu cầu"}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-foreground-400">
          {isAdmin
            ? "Mẹo: lên YouTube tìm [tên bài] karaoke, copy link rồi dán vào đây."
            : "Gửi yêu cầu — Tổ Trưởng duyệt mới vào hàng chờ."}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-background-200">
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`flex-1 px-3 py-2 text-xs font-medium cursor-pointer whitespace-nowrap ${
            activeTab === "queue"
              ? "text-primary-700 border-b-2 border-primary-500 bg-primary-50/50"
              : "text-foreground-500 hover:bg-background-100"
          }`}
        >
          Hàng chờ ({queue.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`flex-1 px-3 py-2 text-xs font-medium cursor-pointer whitespace-nowrap relative ${
            activeTab === "requests"
              ? "text-primary-700 border-b-2 border-primary-500 bg-primary-50/50"
              : "text-foreground-500 hover:bg-background-100"
          }`}
        >
          Yêu cầu ({pendingRequests.length})
          {pendingRequests.length > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent-500 text-white text-[10px] flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto cs-scroll p-2 space-y-2">
        {activeTab === "queue" ? (
          queue.length === 0 ? (
            <div className="text-center py-10 px-4">
              <div className="w-12 h-12 rounded-full bg-background-100 flex items-center justify-center mx-auto">
                <i className="ri-music-2-line text-xl text-foreground-400" />
              </div>
              <p className="mt-3 text-sm text-foreground-500">Chưa có bài hát nào</p>
              <p className="mt-1 text-xs text-foreground-400">
                {isAdmin ? "Dán link YouTube ở trên để thêm bài hát." : "Gửi yêu cầu bài hát cho Tổ Trưởng."}
              </p>
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
                    onClick={() => !isPlaying && isAdmin && onPlay(song)}
                    disabled={isPlaying || !isAdmin}
                    className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 text-white cursor-pointer ${
                      isPlaying
                        ? "bg-accent-500"
                        : isAdmin
                          ? "bg-secondary-500 hover:bg-secondary-600"
                          : "bg-background-200 text-foreground-400 cursor-not-allowed"
                    }`}
                    title={isPlaying ? "Đang phát" : isAdmin ? "Phát bài này" : "Chỉ Tổ Trưởng mới phát bài"}
                  >
                    <i
                      className={`${
                        isPlaying ? "ri-music-2-fill animate-pulse" : "ri-play-fill"
                      } text-lg`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground-900 break-words leading-snug line-clamp-2">
                      {song.title}
                    </p>
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
          )
        ) : (
          <div className="space-y-2">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 rounded-full bg-background-100 flex items-center justify-center mx-auto">
                  <i className="ri-time-line text-xl text-foreground-400" />
                </div>
                <p className="mt-3 text-sm text-foreground-500">Chưa có yêu cầu nào</p>
                <p className="mt-1 text-xs text-foreground-400">
                  {isAdmin ? "Nhân viên sẽ gửi yêu cầu bài hát ở đây." : "Gửi link YouTube ở trên để yêu cầu bài hát."}
                </p>
              </div>
            ) : (
              pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-background-50 border-background-200"
                >
                  {req.thumbnail && (
                    <img
                      src={req.thumbnail}
                      alt=""
                      className="w-12 h-9 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground-900 break-words leading-snug line-clamp-2">
                      {req.title}
                    </p>
                    <p className="text-[11px] text-foreground-500">
                      Yêu cầu bởi {req.requestedByName}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onApprove(req.id)}
                        disabled={busy}
                        className="w-7 h-7 rounded-md flex items-center justify-center bg-emerald-100 text-emerald-600 hover:bg-emerald-200 cursor-pointer"
                        title="Duyệt"
                      >
                        <i className="ri-check-line" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(req.id)}
                        disabled={busy}
                        className="w-7 h-7 rounded-md flex items-center justify-center bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer"
                        title="Từ chối"
                      >
                        <i className="ri-close-line" />
                      </button>
                    </div>
                  )}
                  {!isAdmin && req.requestedBy === currentUserId && (
                    <span className="text-[10px] text-foreground-400 whitespace-nowrap">Đang chờ duyệt</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}