import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TeamRoom, User } from "@/types";
import { mapUser } from "@/lib/mappers";

export interface TeamRoomsData {
  rooms: TeamRoom[];
  members: User[];
  loading: boolean;
  error: string;
  reload: () => void;
}

export function useTeamRooms(): TeamRoomsData {
  const [rooms, setRooms] = useState<TeamRoom[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [roomRes, memberRes, profRes] = await Promise.all([
        supabase.from("team_rooms").select("*").order("created_at"),
        supabase.from("team_room_members").select("room_id, user_id"),
        supabase.from("profiles").select("*").order("name"),
      ]);
      if (roomRes.error) throw roomRes.error;
      if (memberRes.error) throw memberRes.error;
      if (profRes.error) throw profRes.error;

      const memberIdsByRoom: Record<string, string[]> = {};
      (memberRes.data ?? []).forEach((m: { room_id: string; user_id: string }) => {
        (memberIdsByRoom[m.room_id] ??= []).push(m.user_id);
      });

      const roomList: TeamRoom[] = (roomRes.data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? "",
        createdBy: r.created_by ?? "",
        createdAt: r.created_at,
        memberIds: memberIdsByRoom[r.id] ?? [],
      }));

      setRooms(roomList);
      setMembers((profRes.data ?? []).map((p) => mapUser(p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải phòng trò chuyện.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("team-rooms-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_rooms" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "team_room_members" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { rooms, members, loading, error, reload: load };
}