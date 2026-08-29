import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface VoicePeerState {
  stream: MediaStream | null;
  userName: string;
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

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface SignalPayload {
  type: "join" | "offer" | "answer" | "ice-candidate" | "leave";
  from: string;
  name?: string;
  to?: string;
  data?: unknown;
}

export function useVoiceCall(roomId: string, userId: string, userName: string): VoiceCallReturn {
  const [isActive, setIsActive] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, VoicePeerState>>();
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const connectionsRef = useRef<Record<string, RTCPeerConnection>>();
  const peerNamesRef = useRef<Record<string, string>>();
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

  const createPeerConnection = useCallback(
    (peerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // Add local audio tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Send ICE candidates
      pc.onicecandidate = (event) => {
        if (!event.candidate || !channelRef.current) return;
        channelRef.current.send({
          type: "broadcast",
          event: "voice-signal",
          payload: {
            type: "ice-candidate",
            from: userIdRef.current,
            to: peerId,
            data: event.candidate.toJSON(),
          },
        });
      };

      // Receive remote tracks
      pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        setPeers((prev) => ({
          ...prev,
          [peerId]: {
            stream,
            userName: peerNamesRef.current[peerId] || "Thành viên",
          },
        }));
        setParticipants((prev) =>
          prev.includes(peerId) ? prev : [...prev, peerId]
        );
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
          setPeers((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
          setParticipants((prev) => prev.filter((id) => id !== peerId));
          try {
            pc.close();
          } catch {
            /* ignore */
          }
          delete connectionsRef.current[peerId];
        }
      };

      connectionsRef.current[peerId] = pc;
      return pc;
    },
    []
  );

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (!payload || payload.from === userIdRef.current) return;
      if (payload.to && payload.to !== userIdRef.current) return;

      if (payload.name) {
        peerNamesRef.current[payload.from] = payload.name;
      }

      try {
        switch (payload.type) {
          case "join": {
            // Someone joined — create offer for them
            if (peerNamesRef.current[payload.from] !== payload.name) {
              peerNamesRef.current[payload.from] = payload.name || "Thành viên";
            }
            const pc = createPeerConnection(payload.from);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channelRef.current?.send({
              type: "broadcast",
              event: "voice-signal",
              payload: {
                type: "offer",
                from: userIdRef.current,
                to: payload.from,
                data: offer,
              },
            });
            break;
          }
          case "offer": {
            const pc = createPeerConnection(payload.from);
            await pc.setRemoteDescription(
              new RTCSessionDescription(payload.data as any)
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channelRef.current?.send({
              type: "broadcast",
              event: "voice-signal",
              payload: {
                type: "answer",
                from: userIdRef.current,
                to: payload.from,
                data: answer,
              },
            });
            break;
          }
          case "answer": {
            const pc = connectionsRef.current[payload.from];
            if (pc) {
              await pc.setRemoteDescription(
                new RTCSessionDescription(payload.data as any)
              );
            }
            break;
          }
          case "ice-candidate": {
            const pc = connectionsRef.current[payload.from];
            if (pc) {
              await pc.addIceCandidate(
                new RTCIceCandidate(payload.data as any)
              );
            }
            break;
          }
          case "leave": {
            const pc = connectionsRef.current[payload.from];
            if (pc) {
              try {
                pc.close();
              } catch {
                /* ignore */
              }
              delete connectionsRef.current[payload.from];
            }
            delete peerNamesRef.current[payload.from];
            setPeers((prev) => {
              const next = { ...prev };
              delete next[payload.from];
              return next;
            });
            setParticipants((prev) => prev.filter((id) => id !== payload.from));
            break;
          }
        }
      } catch (e) {
        console.error("[WebRTC] signal error:", e);
      }
    },
    [createPeerConnection]
  );

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

      // Get local audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Subscribe to signaling channel
      const ch = supabase.channel(`webrtc-voice-${roomIdRef.current}`, {
        config: { broadcast: { self: false } },
      });
      ch.on(
        "broadcast",
        { event: "voice-signal" },
        ({ payload }: { payload?: SignalPayload }) => {
          if (payload) handleSignal(payload);
        }
      );
      ch.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          // Broadcast join so others create offers for us
          ch.send({
            type: "broadcast",
            event: "voice-signal",
            payload: {
              type: "join",
              from: userIdRef.current,
              name: userNameRef.current || "Thành viên",
            },
          });
        }
      });
      channelRef.current = ch;

      setIsActive(true);
      setIsJoining(false);
      joiningRef.current = false;
    } catch (e) {
      const err = e as DOMException;
      let msg = "Không thể kết nối micro.";
      if (err?.name === "NotAllowedError" || (e instanceof Error && e.message === "Permission denied")) {
        msg = "Trình duyệt đã chặn quyền micro. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ và bật 'Micro' (Cho phép), rồi bấm Tham gia lại.";
      } else if (err?.name === "NotFoundError") {
        msg = "Không tìm thấy micro trên thiết bị. Hãy kiểm tra lại micro đã cắm/bật chưa.";
      } else if (err?.name === "NotReadableError") {
        msg = "Micro đang bị ứng dụng khác sử dụng. Hãy đóng ứng dụng đang dùng micro rồi thử lại.";
      } else if (err?.name === "SecurityError") {
        msg = "Trang chưa chạy trên kết nối bảo mật (HTTPS), nên trình duyệt chặn micro. Hãy mở trang bằng HTTPS.";
      } else if (e instanceof Error && e.message) {
        msg = e.message;
      }
      console.error("[WebRTC] join error:", msg);
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
  }, [handleSignal]);

  const leave = useCallback(() => {
    // Notify others
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: "broadcast",
          event: "voice-signal",
          payload: {
            type: "leave",
            from: userIdRef.current,
          },
        });
      } catch {
        /* ignore */
      }
      try {
        supabase.removeChannel(channelRef.current);
      } catch {
        /* ignore */
      }
      channelRef.current = null;
    }

    // Close all peer connections
    Object.values(connectionsRef.current).forEach((pc) => {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    });
    connectionsRef.current = {};
    peerNamesRef.current = {};

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
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
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    const next = !audioTrack.enabled;
    audioTrack.enabled = next;
    setIsMuted(!next);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {
          /* ignore */
        }
        channelRef.current = null;
      }
      Object.values(connectionsRef.current).forEach((pc) => {
        try {
          pc.close();
        } catch {
          /* ignore */
        }
      });
      connectionsRef.current = {};
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
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