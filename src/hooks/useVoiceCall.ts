import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  LocalAudioTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";

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

export function useVoiceCall(roomId: string, userId: string, userName: string): VoiceCallReturn {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, VoicePeerState>>({});
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const userIdRef = useRef(userId);
  const userNameRef = useRef(userName);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  const handleTrackSubscribed = useCallback(
    (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Audio) return;
      const stream = new MediaStream([track.mediaStreamTrack]);
      setPeers((prev) => ({
        ...prev,
        [participant.identity]: { stream, userName: participant.name || "Thành viên" },
      }));
    },
    []
  );

  const handleTrackUnsubscribed = useCallback(
    (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Audio) return;
      setPeers((prev) => {
        const next = { ...prev };
        delete next[participant.identity];
        return next;
      });
    },
    []
  );

  const handleParticipantConnected = useCallback((participant: RemoteParticipant) => {
    setParticipants((prev) =>
      prev.includes(participant.identity)
        ? prev
        : [...prev, participant.identity]
    );
    setPeers((prev) => {
      if (prev[participant.identity]) return prev;
      return {
        ...prev,
        [participant.identity]: {
          stream: null,
          userName: participant.name || "Thành viên",
        },
      };
    });
  }, []);

  const handleParticipantDisconnected = useCallback((participant: RemoteParticipant) => {
    setParticipants((prev) => prev.filter((id) => id !== participant.identity));
    setPeers((prev) => {
      const next = { ...prev };
      delete next[participant.identity];
      return next;
    });
  }, []);

  const handleDisconnected = useCallback(() => {
    setIsActive(false);
    setLocalStream(null);
    setPeers({});
    setParticipants([]);
  }, []);

  const join = useCallback(async () => {
    if (!userIdRef.current) {
      setError("Chưa đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }
    try {
      setError(null);
      const roomName = `karaoke-${roomId}`;
      const identity = userIdRef.current;
      const name = userNameRef.current || "Thành viên";

      // Lấy token từ edge function (bảo mật, không lộ API secret)
      const { data, error: fnError } = await supabase.functions.invoke("livekit-token", {
        body: { roomName, identity, name },
      });

      if (fnError || !data?.token || !data?.url) {
        throw new Error(fnError?.message || "Không lấy được token kết nối.");
      }

      // Tạo local audio track với khử tiếng vang
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      localTrackRef.current = audioTrack;

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.on(RoomEvent.Disconnected, handleDisconnected);

      await room.connect(data.url, data.token);

      // Publish audio lên room
      await room.localParticipant.publishTrack(audioTrack);

      // Thêm những người đã có sẵn trong room
      room.remoteParticipants.forEach((participant) => {
        handleParticipantConnected(participant);
        participant.trackPublications.forEach((publication) => {
          if (publication.track && publication.track.kind === Track.Kind.Audio) {
            handleTrackSubscribed(publication.track, publication, participant);
          }
        });
      });

      setLocalStream(new MediaStream([audioTrack.mediaStreamTrack]));
      setIsActive(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Không thể kết nối cuộc gọi.";
      setError(msg);
      setIsActive(false);
      if (localTrackRef.current) {
        try {
          localTrackRef.current.stop();
        } catch {
          /* ignore */
        }
        localTrackRef.current = null;
      }
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch {
          /* ignore */
        }
        roomRef.current = null;
      }
    }
  }, [roomId, handleTrackSubscribed, handleTrackUnsubscribed, handleParticipantConnected, handleParticipantDisconnected, handleDisconnected]);

  const leave = useCallback(() => {
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch {
        /* ignore */
      }
      roomRef.current = null;
    }
    if (localTrackRef.current) {
      try {
        localTrackRef.current.stop();
      } catch {
        /* ignore */
      }
      localTrackRef.current = null;
    }
    setLocalStream(null);
    setPeers({});
    setParticipants([]);
    setIsActive(false);
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    const track = localTrackRef.current;
    if (!track) return;
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        track.mute();
      } else {
        track.unmute();
      }
      return next;
    });
  }, []);

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      try {
        roomRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        localTrackRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { isActive, isMuted, localStream, peers, participants, error, join, leave, toggleMute };
}