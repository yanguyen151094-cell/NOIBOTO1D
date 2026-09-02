import { useCallback, useEffect, useRef, useState } from "react";
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

interface SignalPayload {
  to?: string;
  from?: string;
  name?: string;
  type?: "offer" | "answer" | "ice";
  sdp?: any;
  candidate?: any;
}

interface PresenceItem {
  userId?: string;
  name?: string;
}

// STUN công cộng của Google - hoàn toàn miễn phí, không cần tài khoản.
const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useVoiceCall(roomId: string, userId: string, userName: string): VoiceCallReturn {
  const [isActive, setIsActive] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, VoicePeerState>>({});
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamMapRef = useRef<Map<string, MediaStream>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const namesRef = useRef<Record<string, string>>({});

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

  const syncPeersState = useCallback(() => {
    const next: Record<string, VoicePeerState> = {};
    const ids: string[] = [];
    pcMapRef.current.forEach((_pc, peerId) => {
      next[peerId] = {
        stream: remoteStreamMapRef.current.get(peerId) ?? null,
        userName: namesRef.current[peerId] ?? "Thành viên",
        isMuted: false,
      };
      ids.push(peerId);
    });
    setPeers(next);
    setParticipants(ids);
  }, []);

  const broadcast = useCallback((payload: SignalPayload) => {
    channelRef.current?.send({ type: "broadcast", event: "voice-signal", payload });
  }, []);

  const closePeer = useCallback(
    (peerId: string) => {
      const pc = pcMapRef.current.get(peerId);
      if (pc) {
        try {
          pc.close();
        } catch {
          // ignore
        }
        pcMapRef.current.delete(peerId);
      }
      remoteStreamMapRef.current.delete(peerId);
      syncPeersState();
    },
    [syncPeersState]
  );

  const createPeerConnection = useCallback(
    (peerId: string, peerName?: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcMapRef.current.set(peerId, pc);
      if (peerName) namesRef.current[peerId] = peerName;

      const remoteStream = new MediaStream();
      remoteStreamMapRef.current.set(peerId, remoteStream);

      pc.ontrack = (event) => {
        event.streams.forEach((s) => {
          s.getTracks().forEach((t) => {
            if (!remoteStream.getTracks().includes(t)) {
              remoteStream.addTrack(t);
            }
          });
        });
        syncPeersState();
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          broadcast({
            to: peerId,
            from: userIdRef.current,
            name: userNameRef.current,
            type: "ice",
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed" || state === "closed") {
          if (pcMapRef.current.get(peerId) === pc) {
            closePeer(peerId);
          }
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current as MediaStream));
      }

      return pc;
    },
    [broadcast, closePeer, syncPeersState]
  );

  const sendOffer = useCallback(
    async (peerId: string) => {
      if (pcMapRef.current.has(peerId)) return;
      const pc = createPeerConnection(peerId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        broadcast({
          to: peerId,
          from: userIdRef.current,
          name: userNameRef.current,
          type: "offer",
          sdp: pc.localDescription ?? undefined,
        });
      } catch {
        closePeer(peerId);
      }
    },
    [createPeerConnection, broadcast, closePeer]
  );

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (!payload || !payload.from || payload.from === userIdRef.current) return;
      const from = payload.from;
      const name = payload.name;

      if (payload.type === "offer") {
        let pc = pcMapRef.current.get(from);
        if (!pc) pc = createPeerConnection(from, name);
        try {
          if (payload.sdp) await pc.setRemoteDescription(payload.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          broadcast({
            to: from,
            from: userIdRef.current,
            name: userNameRef.current,
            type: "answer",
            sdp: pc.localDescription ?? undefined,
          });
        } catch {
          closePeer(from);
        }
      } else if (payload.type === "answer") {
        const pc = pcMapRef.current.get(from);
        if (pc && payload.sdp) {
          try {
            await pc.setRemoteDescription(payload.sdp);
          } catch {
            // ignore
          }
        }
      } else if (payload.type === "ice") {
        const pc = pcMapRef.current.get(from);
        if (pc && payload.candidate) {
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch {
            // ignore
          }
        }
      }
    },
    [createPeerConnection, broadcast, closePeer]
  );

  const ensureConnections = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const state = channel.presenceState<Record<string, PresenceItem>>();
    const online = new Set<string>();
    Object.values(state).forEach((presences) => {
      (presences as unknown as PresenceItem[]).forEach((p) => {
        if (p.userId && p.userId !== userIdRef.current) {
          online.add(p.userId);
          if (p.name) namesRef.current[p.userId] = p.name;
        }
      });
    });

    // Đóng kết nối với người đã rời phòng
    pcMapRef.current.forEach((_pc, peerId) => {
      if (!online.has(peerId)) closePeer(peerId);
    });

    // Thiết lập kết nối mới: userId nhỏ hơn (theo thứ tự chuỗi) sẽ chủ động tạo offer
    online.forEach((peerId) => {
      if (pcMapRef.current.has(peerId)) return;
      if (userIdRef.current && userIdRef.current < peerId) {
        sendOffer(peerId);
      }
    });

    syncPeersState();
  }, [closePeer, sendOffer, syncPeersState]);

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

      // 1. Xin quyền micro
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (e) {
        const errName = (e as DOMException)?.name;
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          throw new Error("PERMISSION_DENIED");
        }
        if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          throw new Error("DEVICE_NOT_FOUND");
        }
        throw new Error("MIC_ERROR");
      }
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Mở kênh tín hiệu (Supabase Realtime) để trao đổi offer/answer/ice
      const channel = supabase.channel(`voice-call-${roomIdRef.current}`, {
        config: {
          presence: { key: userIdRef.current },
          broadcast: { self: false },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => ensureConnections())
        .on("presence", { event: "leave" }, () => ensureConnections())
        .on("broadcast", { event: "voice-signal" }, ({ payload }) => {
          handleSignal(payload as SignalPayload);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            channel.track({ userId: userIdRef.current, name: userNameRef.current });
          }
        });

      channelRef.current = channel;

      setIsActive(true);
      setIsMuted(false);
      setIsJoining(false);
      joiningRef.current = false;
    } catch (e) {
      const err = e instanceof Error ? e.message : "Không thể kết nối.";
      let msg = err;
      if (err === "PERMISSION_DENIED") {
        msg =
          "Trình duyệt đã chặn micro. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ và bật 'Micro' (Cho phép), rồi bấm Tham gia lại.";
      } else if (err === "DEVICE_NOT_FOUND") {
        msg = "Không tìm thấy micro trên thiết bị. Hãy kiểm tra micro đã cắm/bật chưa.";
      } else if (err === "MIC_ERROR") {
        msg = "Không thể truy cập micro. Vui lòng thử lại sau.";
      }
      setError(msg);
      setIsJoining(false);
      joiningRef.current = false;
      setIsActive(false);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
    }
  }, [ensureConnections, handleSignal]);

  const leave = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    pcMapRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {
        // ignore
      }
    });
    pcMapRef.current.clear();
    remoteStreamMapRef.current.clear();
    namesRef.current = {};

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setPeers({});
    setParticipants([]);
    setIsActive(false);
    setIsJoining(false);
    joiningRef.current = false;
    setIsMuted(false);
    setError(null);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setIsMuted(next);
  }, [isMuted]);

  // Dọn dẹp khi thoát trang
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcMapRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch {
          // ignore
        }
      });
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
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