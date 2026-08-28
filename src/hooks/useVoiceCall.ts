import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface VoicePeerState {
  stream: MediaStream | null;
  userName: string;
}

interface VoiceCallReturn {
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

const STUN_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
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

  const broadcast = useCallback(
    (payload: Record<string, unknown>) => {
      channelRef.current?.send({ type: "broadcast", event: "karaoke-voice", payload });
    },
    []
  );

  const removePeer = useCallback((peerId: string) => {
    const pc = peersRef.current[peerId];
    if (pc) {
      pc.close();
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
      if (peersRef.current[peerId]) return;
      const pc = new RTCPeerConnection(STUN_SERVERS);
      peersRef.current[peerId] = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          broadcast({ kind: "ice", from: userId, to: peerId, candidate: e.candidate.toJSON() });
        }
      };

      pc.ontrack = (e) => {
        const [remoteStream] = e.streams;
        setPeers((prev) => ({ ...prev, [peerId]: { stream: remoteStream, userName: name } }));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          removePeer(peerId);
        }
      };
    },
    [broadcast, userId, removePeer]
  );

  const createOffer = useCallback(
    async (peerId: string) => {
      const pc = peersRef.current[peerId];
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      broadcast({ kind: "offer", from: userId, to: peerId, offer: offer.toJSON() });
    },
    [broadcast, userId]
  );

  const handleOffer = useCallback(
    async (from: string, offer: SessionDescriptionInit, name: string) => {
      addPeer(from, name);
      const pc = peersRef.current[from];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      broadcast({ kind: "answer", from: userId, to: from, answer: answer.toJSON() });
    },
    [addPeer, broadcast, userId]
  );

  const handleAnswer = useCallback(async (from: string, answer: SessionDescriptionInit) => {
    const pc = peersRef.current[from];
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const handleIce = useCallback(async (from: string, candidate: IceCandidateInit) => {
    const pc = peersRef.current[from];
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // ignore stale ICE
    }
  }, []);

  const join = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsActive(true);
      broadcast({ kind: "join", userId, userName });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Không thể truy cập microphone";
      setError(msg);
      setIsActive(false);
    }
  }, [broadcast, userId, userName]);

  const leave = useCallback(() => {
    broadcast({ kind: "leave", userId });
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setPeers({});
    setParticipants([]);
    participantsRef.current = new Set();
    setIsActive(false);
    setIsMuted(false);
  }, [broadcast, userId]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!roomId || !userId) return;
    const ch = supabase.channel(`karaoke-voice-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "karaoke-voice" }, ({ payload }: { payload?: Record<string, unknown> }) => {
      const p = payload ?? {};
      const kind = p.kind as string;
      const from = p.from as string | undefined;
      const to = p.to as string | undefined;

      if (to && to !== userId) return;

      if (kind === "join") {
        const peerId = p.userId as string;
        if (peerId === userId) return;
        const name = (p.userName as string) || "Thành viên";
        participantsRef.current.add(peerId);
        setParticipants(Array.from(participantsRef.current));
        if (userId < peerId) {
          addPeer(peerId, name);
          createOffer(peerId).catch(() => {});
        }
      } else if (kind === "leave") {
        const peerId = p.userId as string;
        if (peerId !== userId) removePeer(peerId);
      } else if (kind === "offer" && from && from !== userId) {
        const name = (p.userName as string) || "Thành viên";
        handleOffer(from, p.offer as SessionDescriptionInit, name).catch(() => {});
      } else if (kind === "answer" && from && from !== userId) {
        handleAnswer(from, p.answer as SessionDescriptionInit).catch(() => {});
      } else if (kind === "ice" && from && from !== userId) {
        handleIce(from, p.candidate as IceCandidateInit).catch(() => {});
      }
    });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [roomId, userId, addPeer, createOffer, handleOffer, handleAnswer, handleIce, removePeer]);

  useEffect(() => {
    return () => {
      Object.values(peersRef.current).forEach((pc) => pc.close());
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { isActive, isMuted, localStream, peers, participants, error, join, leave, toggleMute };
}