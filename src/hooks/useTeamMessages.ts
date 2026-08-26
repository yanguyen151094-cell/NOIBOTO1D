import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TeamMessage } from "@/types";
import { mockTeamMessages } from "@/mocks/appData";

export function useTeamMessages(roomId: string | null) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const load = useCallback(async () => {
    if (!roomId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [msgRes, profRes] = await Promise.all([
        supabase
          .from("team_messages")
          .select("*")
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true }),
        supabase.from("profiles").select("id, name"),
      ]);
      if (msgRes.error) throw msgRes.error;
      if (profRes.error) throw profRes.error;

      const nameMap: Record<string, string> = {};
      (profRes.data ?? []).forEach((p: { id: string; name: string }) => {
        nameMap[p.id] = p.name;
      });

      setMessages(
        (msgRes.data ?? []).map((m) => ({
          id: m.id,
          roomId: m.room_id,
          senderId: m.sender_id,
          senderName: nameMap[m.sender_id] ?? "Nhân viên",
          content: m.content,
          sentAt: m.sent_at,
        }))
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isAuthError(msg)) {
        setMessages((mockTeamMessages[roomId] ?? []).map((m) => ({ ...m })));
      } else {
        setError(e instanceof Error ? e.message : "Không thể tải tin nhắn.");
      }
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
      .channel(`team-messages-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const m = payload.new as { id: string; room_id: string; sender_id: string; content: string; sent_at: string };
          const { data: prof } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", m.sender_id)
            .maybeSingle();
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [
              ...prev,
              {
                id: m.id,
                roomId: m.room_id,
                senderId: m.sender_id,
                senderName: prof?.name ?? "Nhân viên",
                content: m.content,
                sentAt: m.sent_at,
              },
            ];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return { messages, loading, error, reload: load };
}