import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mapAssignment, mapChannel, mapConversation, mapCustomer } from "@/lib/mappers";
import type { Channel, ConversationView, Customer } from "@/types";

export interface InboxData {
  channels: Channel[];
  conversations: ConversationView[];
  customers: Customer[];
  loading: boolean;
  error: string;
  reload: () => void;
}

export function useConversations(): InboxData {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [chRes, custRes, convRes, assignRes, profRes] = await Promise.all([
        supabase.from("channels").select("*").order("name"),
        supabase.from("customers").select("*"),
        supabase.from("conversations").select("*").order("last_message_at", { ascending: false }),
        supabase.from("conversation_assignments").select("conversation_id, staff_id, assigned_at"),
        supabase.from("profiles").select("id, name"),
      ]);
      if (chRes.error) throw chRes.error;
      if (custRes.error) throw custRes.error;
      if (convRes.error) throw convRes.error;
      if (assignRes.error) throw assignRes.error;
      if (profRes.error) throw profRes.error;

      const channelList = (chRes.data ?? []).map(mapChannel);
      const customerList = (custRes.data ?? []).map(mapCustomer);
      const customerMap = Object.fromEntries(customerList.map((c) => [c.id, c]));
      const channelMap = Object.fromEntries(channelList.map((c) => [c.id, c]));
      const nameMap: Record<string, string> = {};
      (profRes.data ?? []).forEach((p: { id: string; name: string }) => {
        nameMap[p.id] = p.name;
      });

      const assignmentsByConv: Record<string, { staffId: string; staffName: string; assignedAt: string }[]> = {};
      (assignRes.data ?? []).forEach(
        (a: { conversation_id: string; staff_id: string; assigned_at: string }) => {
          (assignmentsByConv[a.conversation_id] ??= []).push({
            staffId: a.staff_id,
            staffName: nameMap[a.staff_id] ?? "",
            assignedAt: a.assigned_at,
          });
        }
      );
      Object.values(assignmentsByConv).forEach((list) =>
        list.sort((x, y) => new Date(x.assignedAt).getTime() - new Date(y.assignedAt).getTime())
      );

      const convViews: ConversationView[] = (convRes.data ?? [])
        .map((c) => {
          const conversation = mapConversation(
            c,
            (assignmentsByConv[c.id] ?? []).map(mapAssignment)
          );
          const customer = customerMap[c.customer_id];
          const channel = channelMap[c.channel_id];
          if (!customer || !channel) return null;
          return { ...conversation, customer, channel };
        })
        .filter((c): c is ConversationView => c !== null);

      const unread: Record<string, number> = {};
      convViews.forEach((c) => {
        if (c.status === "unread" || c.status === "unanswered") {
          unread[c.channelId] = (unread[c.channelId] ?? 0) + 1;
        }
      });

      setChannels(channelList.map((ch) => ({ ...ch, unread: unread[ch.id] ?? 0 })));
      setConversations(convViews);
      setCustomers(customerList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu hộp thư.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { channels, conversations, customers, loading, error, reload: load };
}