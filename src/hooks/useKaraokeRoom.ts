import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { KaraokeMessage, KaraokeRoom, KaraokeSong } from "@/types";
import { mapKaraokeMessage, mapKaraokeRoom, mapKaraokeSong } from "@/lib/mappers";

export interface KaraokeRoomData {
  room: KaraokeRoom | null;
  queue: KaraokeSong[];
  messages: KaraokeMessage[];
  loading: boolean;
  error: string;
  reload: () => void;
}

export function useKaraokeRoom(roomId: string | null): KaraokeRoomData {
  const [room, setRoom] = useState<KaraokeRoom | null>(null);
  const [queue, setQueue] = useState<KaraokeSong[]>([]);
  const [messages, setMessages] = useState<KaraokeMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!roomId) {
      setRoom(null);
      setQueue([]);
      setMessages([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [roomRes, queueRes, msgRes, profRes, memberRes] = await Promise.all([
        supabase.from("karaoke_rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("karaoke_queue").select("*").eq("room_id", roomId).order("created_at"),
        supabase.from("karaoke_messages").select("*").eq("room_id", roomId).order("sent_at"),
        supabase.from("profiles").select("id, name"),
        supabase.from("karaoke_room_members").select("user_id").eq("room_id", roomId),
      ]);
      if (roomRes.error) throw roomRes.error;
      if (queueRes.error) throw queueRes.error;
      if (msgRes.error) throw msgRes.error;
      if (profRes.error) throw profRes.error;
      if (memberRes.error) throw memberRes.error;

      const nameMap: Record<string, string> = {};
      (profRes.data ?? []).forEach((p: { id: string; name: string }) => {
        nameMap[p.id] = p.name;
      });

      const memberIds = (memberRes.data ?? []).map((m: { user_id: string }) => m.user_id);

      setRoom(roomRes.data ? mapKaraokeRoom(roomRes.data, memberIds) : null);
      setQueue((queueRes.data ?? []).map((q) => mapKaraokeSong(q)));
      setMessages(
        (msgRes.data ?? []).map((m) => ({
          ...mapKaraokeMessage(m),
          senderName: nameMap[m.sender_id] ?? "Nhân viên",
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải phòng hát.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`karaoke-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "karaoke_rooms", filter: `id=eq.${roomId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "karaoke_queue", filter: `room_id=eq.${roomId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "karaoke_messages", filter: `room_id=eq.${roomId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, load]);

  return { room, queue, messages, loading, error, reload: load };
}