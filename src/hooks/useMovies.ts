import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Movie } from "@/types";

export function useMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("movies")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setMovies(
        (data ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          videoUrl: m.video_url,
          thumbnail: m.thumbnail,
          category: m.category,
          createdBy: m.created_by,
          createdAt: m.created_at,
        }))
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = supabase
      .channel("movies")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movies" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [load]);

  return { movies, loading, error, reload: load };
}