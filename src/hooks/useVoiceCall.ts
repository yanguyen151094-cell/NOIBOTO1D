import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface VoicePeerState {
  stream: MediaStream | null;
  userName: string;
}

export interface VoiceCallReturn {
  isActive: boolean;
  isMuted: boolean;
  localStream: MediaStream | null;
  peers: Record<string, VoicePeerState>;
  participants: string[];
  error: string | null;
  join: () => Promise<void>;
  leave: () => void;
  toggleMute: () => void;
}

type SessionDescriptionInit = {
  type?: string;
  sdp?: string;
};

type IceCandidateInit = {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ],
};

export function useVoiceCall(roomId: string, userId: string, userName: string): VoiceCallReturn {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, VoicePeerState>>({});
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const participantsRef = useRef<Set<string>>(new Set());

  // Refs để callback không phụ thuộc state thay đổi
  const userIdRef = useRef(userId);
  const userNameRef = useRef(userName);
  const isActiveRef = useRef(isActive);
  const isMutedRef = useRef(isMuted);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { userNameRef.current = userName; }, [userName]);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  const broadcast = useCallback((payload: Record<string, unknown>) => {
    try {
      channelRef.current?.send({ type: "broadcast", event: "karaoke-voice", payload });
    } catch {
      // Broadcast failures are best-effort; rely on reconnection to re-broadcast
    }
  }, []);

  const removePeer = useCallback((peerId: string) => {
    const pc = peersRef.current[peerId];
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch {
        // ignore
      }
      delete peersRef.current[peerId];
    }
    setPeers((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
    participantsRef.current.delete(peerId);
    setParticipants(Array.from(participantsRef.current));
  }, []);

  const addPeer = useCallback(
    (peerId: string, name: string) => {
      if (peersRef.current[peerId]) {
        // Peer already exists, just update name if needed
        setPeers((prev) => {
          if (prev[peerId] && prev[peerId].userName !== name) {
            return { ...prev, [peerId]: { ...prev[peerId], userName: name } };
          }
          return prev;
        });
        return;
      }
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peersRef.current[peerId] = pc;

      // Thêm track local stream nếu có
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, localStreamRef.current!);
          } catch {
            // Track already added or other issue
          }
        });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          broadcast({
            kind: "ice",
            from: userIdRef.current,
            to: peerId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (e) => {
        const [remoteStream] = e.streams;
        setPeers((prev) => ({ ...prev, [peerId]: { stream: remoteStream, userName: name } }));
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed" || state === "closed" || state === "disconnected") {
          // Đợi 3 giây trước khi remove để cho phép reconnect
          setTimeout(() => {
            if (peersRef.current[peerId]?.connectionState === "failed" ||
                peersRef.current[peerId]?.connectionState === "closed" ||
                peersRef.current[peerId]?.connectionState === "disconnected") {
              removePeer(peerId);
            }
          }, 3000);
        }
      };
    },
    [broadcast, removePeer]
  );

  const createOffer = useCallback(
    async (peerId: string) => {
      const pc = peersRef.current[peerId];
      if (!pc) return;
      try {
        // Đảm bảo có track trước khi tạo offer
        if (localStreamRef.current) {
          const senders = pc.getSenders();
          localStreamRef.current.getTracks().forEach((track) => {
            if (!senders.find((s) => s.track === track)) {
              try {
                pc.addTrack(track, localStreamRef.current!);
              } catch {
                // ignore
              }
            }
          });
        }
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        broadcast({
          kind: "offer",
          from: userIdRef.current,
          to: peerId,
          offer: { type: offer.type, sdp: offer.sdp },
        });
      } catch (e) {
        console.error("createOffer error", e);
      }
    },
    [broadcast]
  );

  const handleOffer = useCallback(
    async (from: string, offer: SessionDescriptionInit, name: string) => {
      addPeer(from, name);
      const pc = peersRef.current[from];
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer as any));
        // Đảm bảo track local đã thêm
        if (localStreamRef.current) {
          const senders = pc.getSenders();
          localStreamRef.current.getTracks().forEach((track) => {
            if (!senders.find((s) => s.track === track)) {
              try {
                pc.addTrack(track, localStreamRef.current!);
              } catch {
                // ignore
              }
            }
          });
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        broadcast({
          kind: "answer",
          from: userIdRef.current,
          to: from,
          answer: { type: answer.type, sdp: answer.sdp },
        });
      } catch (e) {
        console.error("handleOffer error", e);
      }
    },
    [addPeer, broadcast]
  );

  const handleAnswer = useCallback(async (from: string, answer: SessionDescriptionInit) => {
    const pc = peersRef.current[from];
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer as any));
    } catch (e) {
      console.error("handleAnswer error", e);
    }
  }, []);

  const handleIce = useCallback(async (from: string, candidate: IceCandidateInit) => {
    const pc = peersRef.current[from];
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate as any));
    } catch {
      // ignore stale ICE
    }
  }, []);

  const join = useCallback(async () => {
    if (!userIdRef.current) {
      setError("Chưa đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
          latency: 0.01,
        },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsActive(true);
      // Delay nhỏ để đảm bảo channel đã subscribe
      setTimeout(() => {
        broadcast({ kind: "join", userId: userIdRef.current, userName: userNameRef.current });
      }, 300);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Không thể truy cập microphone";
      setError(msg);
      setIsActive(false);
    }
  }, [broadcast]);

  const leave = useCallback(() => {
    broadcast({ kind: "leave", userId: userIdRef.current });
    Object.values(peersRef.current).forEach((pc) => {
      try { pc.close(); } catch { /* ignore */ }
    });
    peersRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setPeers({});
    setParticipants([]);
    participantsRef.current = new Set();
    setIsActive(false);
    setIsMuted(false);
  }, [broadcast]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, []);

  // Setup broadcast channel — chỉ phụ thuộc roomId (userId dùng ref)
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`karaoke-voice-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "karaoke-voice" }, ({ payload }: { payload?: Record<string, unknown> }) => {
      const p = payload ?? {};
      const kind = p.kind as string;
      const from = p.from as string | undefined;
      const to = p.to as string | undefined;

      // Bỏ qua tin nhắn không dành cho mình
      if (to && to !== userIdRef.current) return;
      // Bỏ qua tin nhắn của chính mình (self: false đã chặn, nhưng check thêm cho chắc)
      if (from && from === userIdRef.current) return;
      if (!kind) return;

      if (kind === "join") {
        const peerId = p.userId as string;
        if (!peerId || peerId === userIdRef.current) return;
        const name = (p.userName as string) || "Thành viên";
        participantsRef.current.add(peerId);
        setParticipants(Array.from(participantsRef.current));
        // LUÔN tạo offer khi có người mới vào — KHÔNG dùng điều kiện userId < peerId
        addPeer(peerId, name);
        createOffer(peerId).catch(() => {});
      } else if (kind === "leave") {
        const peerId = p.userId as string;
        if (!peerId || peerId === userIdRef.current) return;
        removePeer(peerId);
      } else if (kind === "offer" && from) {
        const name = (p.userName as string) || "Thành viên";
        handleOffer(from, p.offer as SessionDescriptionInit, name).catch(() => {});
      } else if (kind === "answer" && from) {
        handleAnswer(from, p.answer as SessionDescriptionInit).catch(() => {});
      } else if (kind === "ice" && from) {
        handleIce(from, p.candidate as IceCandidateInit).catch(() => {});
      }
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" && isActiveRef.current) {
        // Re-broadcast join khi reconnect
        broadcast({ kind: "join", userId: userIdRef.current, userName: userNameRef.current });
      }
    });

    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      Object.values(peersRef.current).forEach((pc) => {
        try { pc.close(); } catch { /* ignore */ }
      });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { isActive, isMuted, localStream, peers, participants, error, join, leave, toggleMute };
}