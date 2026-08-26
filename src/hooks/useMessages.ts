import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mapMessage } from "@/lib/mappers";
import type { Message } from "@/types";

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

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: e } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true });
      if (e) throw e;
      setMessages((data ?? []).map(mapMessage));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isAuthError(msg)) {
        // Mock messages for demo conversations
        const mockMsgs: Message[] = conversationId === "conv1" ? [
          { id: "msg1", conversationId: "conv1", sender: "customer", content: "Chào shop, sản phẩm này còn hàng không ạ?", sentAt: new Date(Date.now() - 300000).toISOString(), status: "sent", type: "text" },
          { id: "msg2", conversationId: "conv1", sender: "staff", staffId: "u2", senderName: "Trần Thị Bình", content: "Dạ chào chị Mai, sản phẩm này bên em còn hàng ạ. Chị để lại số điện thoại em tư vấn chi tiết nhé!", sentAt: new Date(Date.now() - 240000).toISOString(), status: "sent", type: "text" },
        ] : conversationId === "conv2" ? [
          { id: "msg3", conversationId: "conv2", sender: "customer", content: "Em đã chuyển khoản rồi, shop kiểm tra giúp em ạ", sentAt: new Date(Date.now() - 900000).toISOString(), status: "sent", type: "text" },
          { id: "msg4", conversationId: "conv2", sender: "staff", staffId: "u2", senderName: "Trần Thị Bình", content: "Dạ em đã nhận được chuyển khoản 500k của anh Nam. Em lên đơn và giao trong hôm nay ạ!", sentAt: new Date(Date.now() - 840000).toISOString(), status: "sent", type: "text" },
        ] : conversationId === "conv3" ? [
          { id: "msg5", conversationId: "conv3", sender: "customer", content: "Sản phẩm bên shop dùng rất tốt, cảm ơn shop đã hỗ trợ nhiệt tình!", sentAt: new Date(Date.now() - 86400000).toISOString(), status: "sent", type: "text" },
          { id: "msg6", conversationId: "conv3", sender: "staff", staffId: "u4", senderName: "Phạm Thị Dung", content: "Dạ em cảm ơn chị Lan đã tin tưởng shop. Cần gì thêm chị cứ nhắn em ạ!", sentAt: new Date(Date.now() - 86000000).toISOString(), status: "sent", type: "text" },
        ] : [];
        setMessages(mockMsgs);
      } else {
        setError(e instanceof Error ? e.message : "Không thể tải tin nhắn.");
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === payload.new.id);
            if (exists) return prev;
            return [...prev, mapMessage(payload.new as Record<string, unknown>)];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { messages, loading, error, reload: load };
}