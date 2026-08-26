import { supabase } from "@/lib/supabase";
import { mapChannel } from "@/lib/mappers";
import { useQuery } from "@/hooks/useQuery";
import type { Channel } from "@/types";
import { mockChannels } from "@/mocks/appData";

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

export function useChannels() {
  return useQuery<Channel[]>(async () => {
    try {
      const { data, error } = await supabase.from("channels").select("*").order("name");
      if (error) throw error;
      const channels = (data ?? []).map(mapChannel);

      const { data: convs, error: convError } = await supabase
        .from("conversations")
        .select("channel_id, status");
      if (convError) throw convError;

      const unread: Record<string, number> = {};
      (convs ?? []).forEach((c: { channel_id: string; status: string }) => {
        if (c.status === "unread" || c.status === "unanswered") {
          unread[c.channel_id] = (unread[c.channel_id] ?? 0) + 1;
        }
      });

      return channels.map((ch) => ({ ...ch, unread: unread[ch.id] ?? 0 }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAuthError(msg)) {
        return mockChannels.map((ch) => ({ ...ch, unread: 0 }));
      }
      throw err;
    }
  });
}