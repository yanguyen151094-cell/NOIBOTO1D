import { useMemo, useState } from "react";
import ChannelList from "./components/ChannelList";
import ConversationList from "./components/ConversationList";
import ChatView from "./components/ChatView";
import CustomerPanel from "./components/CustomerPanel";
import { useAuth } from "@/context/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useInternalNotes } from "@/hooks/useInternalNotes";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { assignConversation, sendMessage, setConversationStatus } from "@/lib/actions";
import type { ConversationView } from "@/types";

type MobileStage = "channels" | "list" | "chat";

interface StaffOption {
  id: string;
  name: string;
  username: string;
}

export default function Inbox() {
  const { currentUser } = useAuth();
  const { channels, conversations, loading, error, reload } = useConversations();
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [stage, setStage] = useState<MobileStage>("channels");
  const [sending, setSending] = useState(false);

  const { messages, reload: reloadMessages } = useMessages(selectedId);
  const { notes, addNote } = useInternalNotes(selectedId);

  const { data: staffOptions } = useQuery<StaffOption[]>(async () => {
    const { data, error: e } = await supabase
      .from("profiles")
      .select("id, name, username")
      .eq("role", "staff")
      .eq("active", true)
      .order("name");
    if (e) throw e;
    return (data ?? []) as StaffOption[];
  });

  const visibleChannels = channels;

  const isAdmin = currentUser?.role === "admin";
  const myChannelIds = useMemo(() => {
    const set = new Set(currentUser?.assignedChannelIds ?? []);
    (channels ?? []).forEach((ch) => {
      if (ch.ownerId && ch.ownerId === currentUser?.id) set.add(ch.id);
    });
    return set;
  }, [currentUser?.assignedChannelIds, currentUser?.id, channels]);

  const enriched: ConversationView[] = useMemo(
    () =>
      conversations.filter((c) => (selectedChannel === "all" ? true : c.channelId === selectedChannel)),
    [conversations, selectedChannel]
  );

  const selected = enriched.find((c) => c.id === selectedId) ?? null;
  const canChat = !!isAdmin || (selected ? myChannelIds.has(selected.channelId) : true);

  const totalUnread = visibleChannels.reduce((sum, ch) => sum + ch.unread, 0);

  const handleAssign = async (id: string, staffId: string) => {
    try {
      await assignConversation(id, staffId);
      reload();
    } catch {
      // ignore
    }
  };

  const handleStatusChange = async (id: string, status: ConversationView["status"]) => {
    try {
      await setConversationStatus(id, status);
      reload();
    } catch {
      // ignore
    }
  };

  const handleSend = async (content: string) => {
    if (!selectedId || !currentUser) return;
    setSending(true);
    try {
      await sendMessage(selectedId, content, currentUser.name);
      reloadMessages();
      reload();
    } finally {
      setSending(false);
    }
  };

  const handleSendAttachment = async (type: "image" | "file" | "video", url: string, caption?: string) => {
    if (!selectedId || !currentUser) return;
    setSending(true);
    try {
      await sendMessage(selectedId, caption || "", currentUser.name, type, url);
      reloadMessages();
      reload();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex">
      {/* Desktop: 3 columns */}
      <div className="hidden md:flex w-full h-full">
        <div className="w-60 shrink-0 border-r border-background-200">
          <ChannelList
            channels={visibleChannels}
            selectedId={selectedChannel}
            onSelect={(id) => {
              setSelectedChannel(id);
              setSelectedId(null);
            }}
            totalUnread={totalUnread}
            isAdmin={!!isAdmin}
            myChannelIds={myChannelIds}
          />
        </div>
        <div className="w-80 shrink-0 border-r border-background-200">
          <ConversationList
            conversations={enriched}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="flex-1 min-w-0">
          {selected ? (
            <ChatView
              conversation={selected}
              messages={messages}
              currentUser={currentUser!}
              staffOptions={staffOptions ?? []}
              notes={notes}
              onSend={handleSend}
              onSendAttachment={handleSendAttachment}
              onAddNote={addNote}
              onToggleInfo={() => setShowInfo((v) => !v)}
              onAssign={handleAssign}
              onStatusChange={handleStatusChange}
              readOnly={!canChat}
            />
          ) : (
            <EmptyState />
          )}
        </div>
        {showInfo && selected && (
          <div className="w-72 shrink-0 border-l border-background-200 animate-fade-in">
            <CustomerPanel
              customer={selected.customer}
              conversation={selected}
              channel={selected.channel}
            />
          </div>
        )}
      </div>

      {/* Mobile: 3 steps */}
      <div className="md:hidden w-full h-full flex flex-col">
        {stage === "channels" && (
          <ChannelList
            channels={visibleChannels}
            selectedId={selectedChannel}
            onSelect={(id) => {
              setSelectedChannel(id);
              setSelectedId(null);
              setStage("list");
            }}
            totalUnread={totalUnread}
            isAdmin={!!isAdmin}
            myChannelIds={myChannelIds}
          />
        )}
        {stage === "list" && (
          <ConversationList
            conversations={enriched}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setStage("chat");
            }}
            onBack={() => setStage("channels")}
          />
        )}
        {stage === "chat" && selected && (
          <ChatView
            conversation={selected}
            messages={messages}
            currentUser={currentUser!}
            staffOptions={staffOptions ?? []}
            notes={notes}
            onSend={handleSend}
            onSendAttachment={handleSendAttachment}
            onAddNote={addNote}
            onBack={() => setStage("list")}
            onToggleInfo={() => setShowInfo((v) => !v)}
            onAssign={handleAssign}
            onStatusChange={handleStatusChange}
            readOnly={!canChat}
          />
        )}
      </div>

      {/* Mobile customer info overlay */}
      {showInfo && selected && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowInfo(false)} />
          <div className="relative w-80 max-w-[85%] bg-background-50 h-full animate-fade-in">
            <CustomerPanel
              customer={selected.customer}
              conversation={selected}
              channel={selected.channel}
            />
          </div>
        </div>
      )}

      {/* Global loading / error */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-background-50/80 z-40">
          <i className="ri-loader-4-line text-3xl animate-spin text-foreground-400" />
        </div>
      )}
      {!loading && error && (
        <div className="fixed inset-0 flex items-center justify-center bg-background-50/80 z-40">
          <div className="text-center px-6">
            <i className="ri-error-warning-line text-3xl text-red-500" />
            <p className="mt-3 text-sm text-foreground-600">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-4 px-4 py-2 rounded-md bg-primary-500 text-white text-sm cursor-pointer whitespace-nowrap"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {sending && (
        <span className="sr-only">Đang gửi tin nhắn...</span>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
        <i className="ri-chat-3-line text-2xl text-foreground-400" />
      </div>
      <p className="mt-4 font-heading font-semibold text-foreground-700">
        Chọn một hội thoại để bắt đầu
      </p>
      <p className="mt-1 text-sm text-foreground-400">
        Chọn khách hàng từ danh sách bên trái để xem và trả lời tin nhắn.
      </p>
    </div>
  );
}