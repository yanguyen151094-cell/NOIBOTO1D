import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { KaraokeSongRequest } from "@/types";

export function useKaraokeRequests(roomId: string | null) {
  const [requests, setRequests] = useState<KaraokeSongRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!roomId || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("karaoke_song_requests")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });
      if (err) throw err;
      setRequests(
        (data ?? []).map((r) => ({
          id: r.id,
          roomId: r.room_id,
          videoId: r.video_id,
          title: r.title,
          thumbnail: r.thumbnail,
          requestedBy: r.requested_by,
          requestedByName: r.requested_by_name,
          status: r.status,
          createdAt: r.created_at,
        }))
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải yêu cầu.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!roomId) return;
    const sub = supabase
      .channel(`karaoke-requests-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "karaoke_song_requests", filter: `room_id=eq.${roomId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [roomId, load]);

  return { requests, loading, error, reload: load };
}