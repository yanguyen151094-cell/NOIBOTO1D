import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useKaraokeRoom } from "@/hooks/useKaraokeRoom";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import {
  addKaraokeSong,
  extractYoutubeId,
  fetchYoutubeInfo,
  playKaraokeSong,
  removeKaraokeSong,
  sendKaraokeMessage,
  updateKaraokePlayState,
  checkVideoExists,
  joinKaraokeRoom,
} from "@/lib/actions";
import type { KaraokeSong } from "@/types";
import YoutubePlayer, { type YoutubePlayerHandle } from "./YoutubePlayer";
import QueuePanel from "./QueuePanel";
import ChatPanel from "./ChatPanel";
import VoiceCallPanel from "./VoiceCallPanel";

const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;

const YT_ERROR_MESSAGES: Record<number, string> = {
  2: "Video ID không hợp lệ.",
  5: "Lỗi trình phát HTML5.",
  100: "Video không tồn tại hoặc đã bị xóa.",
  101: "Chủ kênh chặn nhúng video này. Vui lòng chọn bài khác.",
  150: "Chủ kênh chặn nhúng video này. Vui lòng chọn bài khác.",
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface RoomViewProps {
  roomId: string;
  roomName: string;
  memberCount: number;
  onBack: () => void;
}

export default function RoomView({ roomId, roomName, memberCount, onBack }: RoomViewProps) {
  const { currentUser } = useAuth();
  const { room, queue, messages, loading, error, reload } = useKaraokeRoom(roomId);

  const playerRef = useRef<YoutubePlayerHandle>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastLoadedVideoRef = useRef<string | null>(null);
  const lastLoadTimeRef = useRef(0);
  const queueRef = useRef<KaraokeSong[]>(queue);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  const voice = useVoiceCall(
    roomId,
    currentUser?.id ?? "",
    currentUser?.name ?? "Thành viên"
  );

  // Auto join phòng khi vào
  useEffect(() => {
    if (roomId) {
      joinKaraokeRoom(roomId).catch(() => {});
    }
  }, [roomId]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const broadcast = useCallback((payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: "broadcast", event: "karaoke-sync", payload });
  }, []);

  const handlePlaySong = useCallback(
    async (song: KaraokeSong) => {
      setVideoError(null);
      lastLoadTimeRef.current = Date.now();
      lastLoadedVideoRef.current = song.videoId;
      playerRef.current?.loadVideo(song.videoId, 0);
      setIsPlaying(true);
      setProgress(0);
      broadcast({ kind: "load", videoId: song.videoId });
      try {
        await playKaraokeSong(roomId, song);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Không thể phát bài hát.");
      }
    },
    [roomId, broadcast]
  );

  const playSongRef = useRef(handlePlaySong);
  useEffect(() => {
    playSongRef.current = handlePlaySong;
  });

  // Lắng nghe broadcast để đồng bộ play/pause/seek/load
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`karaoke-sync-${roomId}`, {
      config: { broadcast: { self: true } },
    });
    ch.on("broadcast", { event: "karaoke-sync" }, ({ payload }: { payload?: Record<string, unknown> }) => {
      const p = payload ?? {};
      if (p.kind === "play") {
        playerRef.current?.play();
        setIsPlaying(true);
      } else if (p.kind === "pause") {
        playerRef.current?.pause();
        setIsPlaying(false);
      } else if (p.kind === "seek" && typeof p.position === "number") {
        playerRef.current?.seekTo(p.position);
        setProgress(p.position);
      } else if (p.kind === "load" && typeof p.videoId === "string") {
        lastLoadTimeRef.current = Date.now();
        if (lastLoadedVideoRef.current !== p.videoId) {
          lastLoadedVideoRef.current = p.videoId;
          setVideoError(null);
          playerRef.current?.loadVideo(p.videoId, 0);
          setIsPlaying(true);
          setProgress(0);
        }
      }
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [roomId]);

  // Khi bài hát hiện tại đổi (từ database) thì load video — CHỈ khi player đã sẵn sàng
  useEffect(() => {
    if (!playerReady) return;
    const videoId = room?.currentVideoId;
    if (!videoId) return;
    if (lastLoadedVideoRef.current === videoId) return;
    lastLoadedVideoRef.current = videoId;
    setVideoError(null);
    playerRef.current?.loadVideo(videoId, room.currentPosition ?? 0);
    setProgress(room.currentPosition ?? 0);
    setIsPlaying(true); // loadVideoById tự động bắt đầu phát
  }, [playerReady, room?.currentVideoId, room?.currentPosition]);

  // Đồng bộ play/pause khi isPlaying trong DB thay đổi (cùng video)
  useEffect(() => {
    if (!playerReady || !lastLoadedVideoRef.current || !room?.currentVideoId) return;
    if (lastLoadedVideoRef.current !== room.currentVideoId) return;
    if (room.isPlaying) {
      playerRef.current?.play();
      setIsPlaying(true);
    } else {
      playerRef.current?.pause();
      setIsPlaying(false);
    }
  }, [playerReady, room?.isPlaying, room?.currentVideoId]);

  // Đồng bộ vị trí khi currentPosition trong DB thay đổi đáng kể (cùng video)
  useEffect(() => {
    if (!playerReady || !lastLoadedVideoRef.current || !room?.currentVideoId) return;
    if (lastLoadedVideoRef.current !== room.currentVideoId) return;
    const currentPos = playerRef.current?.getCurrentTime() ?? 0;
    const targetPos = room?.currentPosition ?? 0;
    if (Math.abs(currentPos - targetPos) > 5) {
      playerRef.current?.seekTo(targetPos);
      setProgress(targetPos);
    }
  }, [playerReady, room?.currentPosition, room?.currentVideoId]);

  // Đồng hồ tiến trình
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(() => {
      setProgress(playerRef.current?.getCurrentTime() ?? 0);
      setDuration(playerRef.current?.getDuration() ?? 0);
    }, 500);
    return () => clearInterval(interval);
  }, [roomId]);

  const handleStateChange = useCallback((state: number) => {
    if (state === PLAYING) setIsPlaying(true);
    else if (state === PAUSED) setIsPlaying(false);
    else if (state === ENDED) {
      if (Date.now() - lastLoadTimeRef.current < 3000) return;
      const next = queueRef.current.find((s) => s.status === "queued");
      if (next) playSongRef.current(next);
    }
  }, []);

  const handlePlayerError = useCallback((errorCode: number) => {
    const msg = YT_ERROR_MESSAGES[errorCode] ?? `Lỗi phát video (${errorCode}). Vui lòng chọn bài hát khác.`;
    setVideoError(msg);
    setIsPlaying(false);
  }, []);

  const togglePlay = () => {
    if (videoError) {
      notify("Video đang bị lỗi, chọn bài khác nhé!");
      return;
    }
    if (isPlaying) {
      playerRef.current?.pause();
      setIsPlaying(false);
      broadcast({ kind: "pause" });
      updateKaraokePlayState(roomId, false, playerRef.current?.getCurrentTime() ?? 0).catch(() => {});
    } else {
      playerRef.current?.play();
      setIsPlaying(true);
      broadcast({ kind: "play" });
      updateKaraokePlayState(roomId, true, playerRef.current?.getCurrentTime() ?? 0).catch(() => {});
    }
  };

  const handleNext = () => {
    const next = queueRef.current.find((s) => s.status === "queued");
    if (next) handlePlaySong(next);
    else notify("Hàng chờ đã hết, thêm bài hát mới nhé!");
  };

  const handlePrev = () => {
    const played = queueRef.current.filter((s) => s.status === "played");
    const prev = played[played.length - 1];
    if (prev) handlePlaySong(prev);
  };

  const handleAdd = async (url: string) => {
    const videoId = extractYoutubeId(url);
    if (!videoId) {
      notify("Link YouTube không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }
    setBusy(true);
    try {
      const exists = await checkVideoExists(videoId);
      if (!exists) {
        notify("Video không tồn tại hoặc không cho phép nhúng. Vui lòng chọn bài khác.");
        setBusy(false);
        return;
      }
      const info = await fetchYoutubeInfo(videoId);
      await addKaraokeSong(roomId, videoId, info.title, info.thumbnail);
      notify(`Đã thêm "${info.title}" vào hàng chờ.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Thêm bài hát thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (songId: string) => {
    setBusy(true);
    try {
      await removeKaraokeSong(songId);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Xóa bài hát thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (content: string) => {
    try {
      await sendKaraokeMessage(roomId, content);
    } catch {
      notify("Gửi tin nhắn thất bại.");
    }
  };

  const playing = queue.find((s) => s.status === "playing");

  if (loading && !room) {
    return (
      <div className="h-full flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-foreground-400 text-2xl" />
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-foreground-600">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-3 px-4 py-2 rounded-md bg-primary-500 text-white text-sm cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 md:px-4 py-3 border-b border-background-200">
        <div className="w-9 h-9 rounded-lg bg-accent-500 text-white flex items-center justify-center shrink-0">
          <i className="ri-mic-line text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground-900 break-words leading-snug">{roomName}</p>
          <p className="text-[11px] text-foreground-500">{memberCount} thành viên · Phòng hát karaoke chung</p>
        </div>
        {playing && (
          <span className="px-2.5 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-medium whitespace-nowrap">
            <i className="ri-music-2-fill mr-1" />
            Đang hát
          </span>
        )}
      </div>

      {/* Nội dung */}
      <div className="flex-1 overflow-y-auto cs-scroll p-3 md:p-4">
        {/* Player */}
        <div className="rounded-lg overflow-hidden bg-black aspect-video w-full max-h-[60vh] mx-auto relative">
          <YoutubePlayer
            ref={playerRef}
            onStateChange={handleStateChange}
            onError={handlePlayerError}
            onReady={() => setPlayerReady(true)}
          />
          {videoError && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white z-10">
              <i className="ri-error-warning-line text-4xl text-foreground-400 mb-3" />
              <p className="text-sm font-medium text-center px-6">{videoError}</p>
              <p className="text-[11px] text-foreground-400 mt-1 text-center px-6">
                Video này không thể phát. Vui lòng chọn bài hát khác trong hàng chờ.
              </p>
            </div>
          )}
          {!playerReady && !videoError && (
            <div className="absolute inset-0 bg-black flex items-center justify-center text-white z-10">
              <i className="ri-loader-4-line animate-spin text-2xl mr-2" />
              <span className="text-sm">Đang tải player...</span>
            </div>
          )}
        </div>

        {/* Now playing + controls */}
        <div className="mt-3 rounded-lg border border-background-200 bg-background-50 p-3 md:p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground-900 break-words leading-snug">
                {playing ? playing.title : room?.currentTitle ?? "Chọn một bài hát để bắt đầu hát"}
              </p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                {formatDuration(progress)} / {formatDuration(duration)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrev}
                className="w-10 h-10 rounded-full bg-background-100 text-foreground-700 flex items-center justify-center hover:bg-background-200 cursor-pointer"
                title="Bài trước"
              >
                <i className="ri-skip-back-fill text-lg" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer ${
                  videoError
                    ? "bg-foreground-300 text-foreground-500 cursor-not-allowed"
                    : "bg-primary-500 text-white hover:bg-primary-600"
                }`}
                title={isPlaying ? "Tạm dừng" : "Phát"}
                disabled={!!videoError}
              >
                <i className={`${isPlaying ? "ri-pause-fill" : "ri-play-fill"} text-2xl`} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="w-10 h-10 rounded-full bg-background-100 text-foreground-700 flex items-center justify-center hover:bg-background-200 cursor-pointer"
                title="Bài tiếp theo"
              >
                <i className="ri-skip-forward-fill text-lg" />
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div
            className="mt-3 h-1.5 rounded-full bg-background-200 overflow-hidden cursor-pointer"
            onClick={(e) => {
              if (videoError) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              const target = Math.max(0, ratio * duration);
              playerRef.current?.seekTo(target);
              setProgress(target);
              broadcast({ kind: "seek", position: target });
            }}
          >
            <div
              className="h-full bg-accent-500 rounded-full transition-all"
              style={{ width: `${duration ? Math.min(100, (progress / duration) * 100) : 0}%` }}
            />
          </div>
        </div>

        {/* Voice call */}
        <div className="mt-3">
          <VoiceCallPanel
            isActive={voice.isActive}
            isMuted={voice.isMuted}
            localStream={voice.localStream}
            peers={voice.peers ?? {}}
            participants={voice.participants}
            error={voice.error}
            onJoin={voice.join}
            onLeave={voice.leave}
            onToggleMute={voice.toggleMute}
          />
        </div>

        {/* Queue + Chat */}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="h-80">
            <QueuePanel
              queue={queue}
              busy={busy}
              onPlay={handlePlaySong}
              onRemove={handleRemove}
              onAdd={handleAdd}
            />
          </div>
          <div className="h-80">
            <ChatPanel
              messages={messages}
              currentUserId={currentUser?.id ?? ""}
              onSend={handleSend}
            />
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-background-50 text-sm px-4 py-2.5 rounded-lg animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}