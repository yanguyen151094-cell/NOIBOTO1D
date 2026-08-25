import { supabase } from "@/lib/supabase";
import { mapActivityLog } from "@/lib/mappers";
import { useQuery } from "@/hooks/useQuery";
import type { ActivityLog } from "@/types";

export function useActivityLogs() {
  return useQuery<ActivityLog[]>(async () => {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map(mapActivityLog);
  });
}