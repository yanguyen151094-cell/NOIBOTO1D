import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { KaraokeRoom, User } from "@/types";
import { mapKaraokeRoom, mapUser } from "@/lib/mappers";
import { mockStaffProfiles } from "@/mocks/appData";

export interface KaraokeRoomsData {
  rooms: KaraokeRoom[];
  members: User[];
  loading: boolean;
  error: string;
  reload: () => void;
}

function isAuthError(message: string): boolean {
  return (
    message.includes("auth") ||
    message.includes("JWT") ||
    message.includes("session") ||
    message.includes("unauthorized") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("RLS") ||
    message.includes("network") ||
    message.includes("cors") ||
    message.includes("failed to fetch") ||
    message.includes("timeout") ||
    message.includes("offline")
  );
}

export function useKaraokeRooms(): KaraokeRoomsData {
  const [rooms, setRooms] = useState<KaraokeRoom[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const initialLoadDone = useRef(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [roomRes, memberRes, profRes] = await Promise.all([
        supabase.from("karaoke_rooms").select("*").order("created_at"),
        supabase.from("karaoke_room_members").select("room_id, user_id"),
        supabase.from("profiles").select("*").order("name"),
      ]);
      if (roomRes.error) throw roomRes.error;
      if (memberRes.error) throw memberRes.error;
      if (profRes.error) throw profRes.error;

      const memberIdsByRoom: Record<string, string[]> = {};
      (memberRes.data ?? []).forEach((m: { room_id: string; user_id: string }) => {
        (memberIdsByRoom[m.room_id] ??= []).push(m.user_id);
      });

      const roomList: KaraokeRoom[] = (roomRes.data ?? []).map((r) =>
        mapKaraokeRoom(r, memberIdsByRoom[r.id] ?? [])
      );

      setRooms(roomList);
      setMembers((profRes.data ?? []).map((p) => mapUser(p)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isAuthError(msg)) {
        setRooms([]);
        setMembers(mockStaffProfiles.map((p) => mapUser(p)));
      } else {
        setError(e instanceof Error ? e.message : "Không thể tải phòng hát.");
      }
    } finally {
      if (showLoading) setLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("karaoke-rooms-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "karaoke_rooms" }, () => load(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "karaoke_room_members" }, () => load(false))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { rooms, members, loading, error, reload: () => load(true) };
}