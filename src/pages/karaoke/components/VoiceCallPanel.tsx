import { useRef, useEffect } from "react";
import Avatar from "@/components/base/Avatar";

interface VoicePeer {
  stream: MediaStream | null;
  userName: string;
}

interface VoiceCallPanelProps {
  isActive: boolean;
  isMuted: boolean;
  localStream: MediaStream | null;
  peers: Record<string, VoicePeer>;
  participants: string[];
  error: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
}

function AudioPlayer({ stream, muted = false }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline muted={muted} className="hidden" />;
}

export default function VoiceCallPanel({
  isActive,
  isMuted,
  localStream,
  peers,
  participants,
  error,
  onJoin,
  onLeave,
  onToggleMute,
}: VoiceCallPanelProps) {
  const allParticipants = Array.from(new Set([...participants, ...Object.keys(peers)]));
  const connectedPeers = Object.keys(peers).filter((id) => peers[id]?.stream);
  const pendingPeers = allParticipants.filter((id) => !peers[id]?.stream);

  if (!isActive) {
    return (
      <div className="rounded-lg border border-background-200 bg-background-50 p-3 md:p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-secondary-100 text-secondary-600 flex items-center justify-center shrink-0">
            <i className="ri-headphone-line text-lg" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-900">Gọi thoại trong phòng</p>
            <p className="text-xs text-foreground-500 break-words leading-snug">Bấm "Tham gia" để gọi cho nhau hát karaoke.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onJoin}
          className="shrink-0 px-4 py-2 rounded-md bg-secondary-500 text-white text-sm font-medium hover:bg-secondary-600 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-phone-line mr-1" />
          Tham gia
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-background-200 bg-background-50 p-3 md:p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 animate-pulse">
            <i className="ri-mic-line text-lg" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-900">
              Đang gọi ({allParticipants.length + 1} người)
            </p>
            <p className="text-xs text-foreground-500 break-words leading-snug">
              {isMuted ? "Micro đang tắt tiếng" : "Micro đang bật"}
              {pendingPeers.length > 0 && ` · ${pendingPeers.length} đang kết nối...`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer ${
              isMuted
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "bg-background-100 text-foreground-600 hover:bg-background-200"
            }`}
            title={isMuted ? "Bật micro" : "Tắt micro"}
          >
            <i className={isMuted ? "ri-mic-off-line" : "ri-mic-line"} />
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 cursor-pointer"
            title="Rời cuộc gọi"
          >
            <i className="ri-close-circle-line" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 text-red-600 text-xs">
          <i className="ri-error-warning-line" />
          <span>{error}</span>
        </div>
      )}

      {/* Participants */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Self */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">
          <Avatar name="Bạn" size="sm" />
          <span>Bạn</span>
          {isMuted && <i className="ri-mic-off-line text-red-500 ml-0.5" />}
        </div>

        {/* Connected peers */}
        {connectedPeers.map((peerId) => {
          const peer = peers[peerId];
          return (
            <div
              key={peerId}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium"
            >
              <Avatar name={peer?.userName || "Thành viên"} size="sm" />
              <span className="truncate max-w-[100px] inline-block">{peer?.userName || "Thành viên"}</span>
              {peer?.stream && peer.stream.getAudioTracks().some((t) => !t.enabled) && (
                <i className="ri-mic-off-line text-red-500 ml-0.5" />
              )}
            </div>
          );
        })}

        {/* Pending peers (đang kết nối) */}
        {pendingPeers.map((peerId) => (
          <div
            key={peerId}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-secondary-100 text-secondary-600 text-xs font-medium animate-pulse"
          >
            <Avatar name="Thành viên" size="sm" />
            <span className="truncate max-w-[100px] inline-block">Đang kết nối...</span>
          </div>
        ))}
      </div>

      {/* Audio elements for remote streams */}
      {Object.entries(peers).map(([peerId, peer]) =>
        peer.stream ? <AudioPlayer key={peerId} stream={peer.stream} /> : null
      )}

      {localStream && <AudioPlayer stream={localStream} muted />}
    </div>
  );
}