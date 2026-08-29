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
  const pendingIceRef = useRef<Record<string, IceCandidateInit[]>>({});
  const userIdRef = useRef(userId);
  const userNameRef = useRef(userName);
  const isActiveRef = useRef(isActive);
  const isSubscribedRef = useRef(false);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { userNameRef.current = userName; }, [userName]);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const removePeer = useCallback((peerId: string) => {
    const pc = peersRef.current[peerId];
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch { /* ignore */ }
      delete peersRef.current[peerId];
    }
    delete pendingIceRef.current[peerId];
    setPeers((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
    participantsRef.current.delete(peerId);
    setParticipants(Array.from(participantsRef.current));
  }, []);

  const safeBroadcast = useCallback((payload: Record<string, unknown>) => {
    if (!isSubscribedRef.current || !channelRef.current) return;
    try {
      channelRef.current.send({ type: "broadcast", event: "karaoke-voice", payload });
    } catch { /* ignore */ }
  }, []);

  const ensurePeer = useCallback((peerId: string, name: string): RTCPeerConnection => {
    let pc = peersRef.current[peerId];
    if (pc) {
      setPeers((prev) => {
        if (prev[peerId] && prev[peerId].userName !== name) {
          return { ...prev, [peerId]: { ...prev[peerId], userName: name } };
        }
        return prev;
      });
      return pc;
    }

    pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[peerId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStreamRef.current!);
        } catch { /* ignore */ }
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        safeBroadcast({
          kind: "ice",
          from: userIdRef.current,
          to: peerId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      const [remoteStream] = e.streams;
      setPeers((prev) => ({
        ...prev,
        [peerId]: { stream: remoteStream, userName: name },
      }));
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed" || state === "closed" || state === "disconnected") {
        setTimeout(() => {
          if (peersRef.current[peerId]?.connectionState === state) {
            removePeer(peerId);
          }
        }, 3000);
      }
    };

    participantsRef.current.add(peerId);
    setParticipants(Array.from(participantsRef.current));
    return pc;
  }, [removePeer, safeBroadcast]);

  const createOffer = useCallback(async (peerId: string) => {
    const pc = peersRef.current[peerId];
    if (!pc) return;
    // Chỉ tạo offer khi signaling state là stable (tránh duplicate)
    if (pc.signalingState !== "stable") return;
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      safeBroadcast({
        kind: "offer",
        from: userIdRef.current,
        to: peerId,
        offer: { type: offer.type, sdp: offer.sdp },
      });
    } catch (e) {
      console.error("createOffer error", e);
    }
  }, [safeBroadcast]);

  const handleOffer = useCallback(async (from: string, offer: SessionDescriptionInit, name: string) => {
    const pc = ensurePeer(from, name);
    // Chỉ xử lý offer khi peer đang ở stable state
    if (pc.signalingState !== "stable") return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer as any));

      // Flush ICE candidates đã queue trước đó
      const queue = pendingIceRef.current[from] ?? [];
      for (const c of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c as any));
        } catch { /* ignore */ }
      }
      delete pendingIceRef.current[from];

      // Đảm bảo local tracks đã thêm
      if (localStreamRef.current) {
        const senders = pc.getSenders();
        localStreamRef.current.getTracks().forEach((track) => {
          if (!senders.find((s) => s.track === track)) {
            try {
              pc.addTrack(track, localStreamRef.current!);
            } catch { /* ignore */ }
          }
        });
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      safeBroadcast({
        kind: "answer",
        from: userIdRef.current,
        to: from,
        answer: { type: answer.type, sdp: answer.sdp },
      });
    } catch (e) {
      console.error("handleOffer error", e);
    }
  }, [ensurePeer, safeBroadcast]);

  const handleAnswer = useCallback(async (from: string, answer: SessionDescriptionInit) => {
    const pc = peersRef.current[from];
    if (!pc) return;
    // Chỉ xử lý answer nếu chúng ta đã gửi offer (have-local-offer)
    if (pc.signalingState !== "have-local-offer") return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer as any));
    } catch (e) {
      console.error("handleAnswer error", e);
    }
  }, []);

  const handleIce = useCallback(async (from: string, candidate: IceCandidateInit) => {
    const pc = peersRef.current[from];
    if (!pc || !pc.remoteDescription) {
      // Queue ICE để xử lý sau khi có remoteDescription
      if (!pendingIceRef.current[from]) pendingIceRef.current[from] = [];
      pendingIceRef.current[from].push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate as any));
    } catch { /* ignore */ }
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

      // Delay để đảm bảo channel đã subscribed
      setTimeout(() => {
        if (!isActiveRef.current) return;
        safeBroadcast({ kind: "join", userId: userIdRef.current, userName: userNameRef.current });
        safeBroadcast({ kind: "who_is_here", userId: userIdRef.current });
      }, 500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Không thể truy cập microphone";
      setError(msg);
      setIsActive(false);
    }
  }, [safeBroadcast]);

  const leave = useCallback(() => {
    safeBroadcast({ kind: "leave", userId: userIdRef.current });
    Object.values(peersRef.current).forEach((pc) => {
      try { pc.close(); } catch { /* ignore */ }
    });
    peersRef.current = {};
    pendingIceRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setPeers({});
    setParticipants([]);
    participantsRef.current = new Set();
    setIsActive(false);
    setIsMuted(false);
  }, [safeBroadcast]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, []);

  // Setup broadcast channel
  useEffect(() => {
    if (!roomId) return;
    isSubscribedRef.current = false;
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
      // Bỏ qua tin nhắn của chính mình
      if (from && from === userIdRef.current) return;
      if (!kind) return;

      if (kind === "join") {
        const peerId = p.userId as string;
        if (!peerId) return;
        const name = (p.userName as string) || "Thành viên";
        ensurePeer(peerId, name);
        // User có ID nhỏ hơn tạo offer (tránh glare — cả 2 cùng tạo offer)
        if (userIdRef.current < peerId) {
          createOffer(peerId).catch(() => {});
        }
        // Phản hồi presence để peer mới biết mình tồn tại
        safeBroadcast({
          kind: "i_am_here",
          userId: userIdRef.current,
          userName: userNameRef.current,
          to: peerId,
        });
      } else if (kind === "leave") {
        const peerId = p.userId as string;
        if (peerId) removePeer(peerId);
      } else if (kind === "offer" && from) {
        const name = (p.userName as string) || "Thành viên";
        handleOffer(from, p.offer as SessionDescriptionInit, name).catch(() => {});
      } else if (kind === "answer" && from) {
        handleAnswer(from, p.answer as SessionDescriptionInit).catch(() => {});
      } else if (kind === "ice" && from) {
        handleIce(from, p.candidate as IceCandidateInit).catch(() => {});
      } else if (kind === "who_is_here") {
        if (isActiveRef.current) {
          safeBroadcast({
            kind: "i_am_here",
            userId: userIdRef.current,
            userName: userNameRef.current,
          });
        }
      } else if (kind === "i_am_here") {
        const peerId = p.userId as string;
        if (!peerId || peerId === userIdRef.current) return;
        const name = (p.userName as string) || "Thành viên";
        ensurePeer(peerId, name);
        // User có ID nhỏ hơn tạo offer
        if (userIdRef.current < peerId) {
          createOffer(peerId).catch(() => {});
        }
      }
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        isSubscribedRef.current = true;
        if (isActiveRef.current) {
          // Re-broadcast join khi reconnect
          safeBroadcast({ kind: "join", userId: userIdRef.current, userName: userNameRef.current });
          safeBroadcast({ kind: "who_is_here", userId: userIdRef.current });
        }
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        isSubscribedRef.current = false;
      }
    });

    channelRef.current = ch;

    return () => {
      isSubscribedRef.current = false;
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Periodic re-broadcast mỗi 10 giây để duy trì discovery
  useEffect(() => {
    if (!isActive || !roomId) return;
    const interval = setInterval(() => {
      if (isActiveRef.current && isSubscribedRef.current) {
        safeBroadcast({ kind: "join", userId: userIdRef.current, userName: userNameRef.current });
      }
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, roomId]);

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