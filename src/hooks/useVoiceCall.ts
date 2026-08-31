import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTC, {
  type IAgoraRTCClient,
  type IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { supabase } from "@/lib/supabase";

export interface VoicePeerState {
  stream: MediaStream | null;
  userName: string;
  isMuted: boolean;
}

export interface VoiceCallReturn {
  isActive: boolean;
  isJoining: boolean;
  isMuted: boolean;
  localStream: MediaStream | null;
  peers: Record<string, VoicePeerState>;
  participants: string[];
  error: string | null;
  join: () => Promise<void>;
  leave: () => void;
  toggleMute: () => void;
}

function streamFromTrack(track: MediaStreamTrack | undefined | null): MediaStream | null {
  if (!track) return null;
  return new MediaStream([track]);
}

export function useVoiceCall(roomId: string, userId: string, userName: string): VoiceCallReturn {
  const [isActive, setIsActive] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, VoicePeerState>>({});
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const nameMapRef = useRef<Record<string, string>>({});

  const userIdRef = useRef(userId);
  const userNameRef = useRef(userName);
  const roomIdRef = useRef(roomId);
  const joiningRef = useRef(false);
  const activeRef = useRef(false);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  useEffect(() => {
    activeRef.current = isActive;
  }, [isActive]);

  const refreshPeers = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    const next: Record<string, VoicePeerState> = {};
    const ids: string[] = [];
    client.remoteUsers.forEach((user) => {
      const uid = String(user.uid);
      const stream = streamFromTrack(user.audioTrack?.getMediaStreamTrack());
      next[uid] = {
        stream,
        userName: nameMapRef.current[uid] ?? "Thành viên",
        isMuted: false,
      };
      ids.push(uid);
    });
    setPeers(next);
    setParticipants(ids);
  }, []);

  const join = useCallback(async () => {
    if (joiningRef.current || activeRef.current) return;
    if (!userIdRef.current) {
      setError("Chưa đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }
    try {
      setError(null);
      setIsJoining(true);
      joiningRef.current = true;

      // Lấy tên thành viên để hiển thị đúng tên người hát (không bắt buộc)
      try {
        const profRes = await supabase.from("profiles").select("id, name");
        const map: Record<string, string> = {};
        (profRes.data ?? []).forEach((p: { id: string; name: string }) => {
          map[p.id] = p.name;
        });
        nameMapRef.current = map;
      } catch {
        // Bỏ qua lỗi lấy tên, vẫn kết nối bình thường
      }

      const { data, error: tokenError } = await supabase.functions.invoke("agora-token", {
        body: {
          channelName: roomIdRef.current,
          uid: userIdRef.current,
        },
      });
      if (tokenError || !data?.token || !data?.appId) {
        throw new Error(
          tokenError?.message ||
            "Không thể lấy token kết nối. Hãy kiểm tra cấu hình Agora (App ID, App Certificate) trong Edge Function Secrets."
        );
      }

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
        refreshPeers();
      });
      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "audio") {
          user.audioTrack?.stop();
        }
        refreshPeers();
      });
      client.on("user-joined", () => refreshPeers());
      client.on("user-left", () => refreshPeers());

      await client.join(data.appId, roomIdRef.current, data.token, userIdRef.current);

      const localTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        AGC: true,
      });
      await client.publish(localTrack);

      clientRef.current = client;
      localTrackRef.current = localTrack;
      setLocalStream(streamFromTrack(localTrack.getMediaStreamTrack()));

      refreshPeers();
      setIsActive(true);
      setIsMuted(false);
      setIsJoining(false);
      joiningRef.current = false;
    } catch (e) {
      const err = e instanceof Error ? e.message : "Không thể kết nối.";
      let msg = err;
      if (err.includes("PERMISSION_DENIED") || err.includes("NotAllowed") || err.includes("denied")) {
        msg =
          "Trình duyệt đã chặn quyền micro. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ và bật 'Micro' (Cho phép), rồi bấm Tham gia lại.";
      } else if (err.includes("DEVICE_NOT_FOUND") || err.includes("NotFound")) {
        msg = "Không tìm thấy micro trên thiết bị. Hãy kiểm tra lại micro đã cắm/bật chưa.";
      } else {
        msg = "Không thể kết nối đến máy chủ Agora. Hãy kiểm tra cấu hình (App ID, App Certificate).";
      }
      setError(msg);
      setIsJoining(false);
      joiningRef.current = false;
      setIsActive(false);
      if (clientRef.current) {
        clientRef.current.leave();
        clientRef.current = null;
      }
      if (localTrackRef.current) {
        localTrackRef.current.close();
        localTrackRef.current = null;
      }
    }
  }, [refreshPeers]);

  const leave = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.leave();
      clientRef.current = null;
    }
    if (localTrackRef.current) {
      localTrackRef.current.close();
      localTrackRef.current = null;
    }
    setLocalStream(null);
    setPeers({});
    setParticipants([]);
    setIsActive(false);
    setIsJoining(false);
    joiningRef.current = false;
    setIsMuted(false);
    setError(null);
  }, []);

  const toggleMute = useCallback(() => {
    const track = localTrackRef.current;
    if (!track) return;
    const nextMuted = !isMuted;
    track.setEnabled(!nextMuted);
    setIsMuted(nextMuted);
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.leave();
        clientRef.current = null;
      }
      if (localTrackRef.current) {
        localTrackRef.current.close();
        localTrackRef.current = null;
      }
    };
  }, []);

  return {
    isActive,
    isJoining,
    isMuted,
    localStream,
    peers,
    participants,
    error,
    join,
    leave,
    toggleMute,
  };
}