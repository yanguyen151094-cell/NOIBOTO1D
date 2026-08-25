import { supabase } from "@/lib/supabase";
import { mapChannel } from "@/lib/mappers";
import { useQuery } from "@/hooks/useQuery";
import type { Channel } from "@/types";

export function useChannels() {
  return useQuery<Channel[]>(async () => {
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
  });
}