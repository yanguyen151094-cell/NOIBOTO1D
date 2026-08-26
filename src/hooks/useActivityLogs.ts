import { supabase } from "@/lib/supabase";
import { mapActivityLog } from "@/lib/mappers";
import { useQuery } from "@/hooks/useQuery";
import type { ActivityLog } from "@/types";
import { mockActivityLogs } from "@/mocks/appData";

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

export function useActivityLogs() {
  return useQuery<ActivityLog[]>(async () => {
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map(mapActivityLog);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAuthError(msg)) {
        return mockActivityLogs.map((l) => ({ ...l }));
      }
      throw err;
    }
  });
}