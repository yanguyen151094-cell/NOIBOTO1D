import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { addInternalNote } from "@/lib/actions";

export interface InternalNote {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
}

export function useInternalNotes(conversationId: string | null) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) {
      setNotes([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("internal_notes")
        .select("id, content, author_id, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const authorIds = Array.from(new Set((data ?? []).map((n) => n.author_id as string)));
      const nameMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", authorIds);
        (profs ?? []).forEach((p: { id: string; name: string }) => {
          nameMap[p.id] = p.name;
        });
      }
      setNotes(
        (data ?? []).map((n) => ({
          id: n.id,
          content: n.content,
          authorName: nameMap[n.author_id] ?? "Nhân viên",
          createdAt: n.created_at,
        }))
      );
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  const addNote = async (content: string) => {
    if (!conversationId) return;
    await addInternalNote(conversationId, content);
    await load();
  };

  return { notes, loading, addNote };
}