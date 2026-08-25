import { useRef, useState } from "react";
import Modal from "@/components/base/Modal";
import { useAuth } from "@/context/AuthContext";
import { useTeamRooms } from "@/hooks/useTeamRooms";
import { useTeamMessages } from "@/hooks/useTeamMessages";
import { createTeamRoom, deleteTeamRoom, addTeamMembers, sendTeamMessage } from "@/lib/actions";
import { formatTime } from "@/utils/ui";

const CUTE_EMOJIS = [
  "😀", "😂", "🥰", "😍", "😘", "😊", "😇", "🤗", "🤭", "😅", "🥳", "😎", "🤓", "🥺", "😴", "🤯",
  "👍", "👏", "🙏", "💪", "🤝", "✌️", "❤️", "💖", "💕", "🎉", "🎊", "✨", "🔥", "⭐", "🌻", "🍀",
];

export default function Team() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const { rooms, members, loading, error, reload } = useTeamRooms();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const { messages } = useTeamMessages(selectedRoomId);
  const [mobileRoom, setMobileRoom] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedRoomId(id);
    setMobileRoom(true);
  };

  const handleCreate = async (name: string, description: string, memberIds: string[]) => {
    setBusy(true);
    try {
      await createTeamRoom(name, description, memberIds);
      setCreateOpen(false);
      notify(`Đã tạo phòng "${name}".`);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Tạo phòng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddMembers = async (roomId: string, memberIds: string[]) => {
    setBusy(true);
    try {
      await addTeamMembers(roomId, memberIds);
      setMembersOpen(false);
      notify("Đã thêm thành viên.");
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Thêm thành viên thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (roomId: string) => {
    setBusy(true);
    try {
      await deleteTeamRoom(roomId);
      if (selectedRoomId === roomId) setSelectedRoomId(null);
      notify("Đã xóa phòng.");
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Xóa phòng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (content: string) => {
    if (!selectedRoomId) return;
    try {
      await sendTeamMessage(selectedRoomId, content);
    } catch {
      notify("Gửi tin nhắn thất bại.");
    }
  };

  return (
    <div className="h-full flex">
      {/* Rooms list */}
      <div
        className={`${
          mobileRoom ? "hidden" : "flex"
        } md:flex w-full md:w-72 shrink-0 flex-col border-r border-background-200`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-background-200">
          <div>
            <p className="text-sm font-semibold text-foreground-900">Phòng trò chuyện</p>
            <p className="text-[11px] text-foreground-500">Trao đổi nội bộ đội ngũ</p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="w-9 h-9 rounded-lg bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 cursor-pointer"
              title="Tạo phòng"
            >
              <i className="ri-add-line" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto cs-scroll p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-foreground-400">
              <i className="ri-loader-4-line animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-foreground-600">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-3 px-4 py-2 rounded-md bg-primary-500 text-white text-sm cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-background-100 flex items-center justify-center mx-auto">
                <i className="ri-chat-smile-2-line text-xl text-foreground-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground-700">Chưa có phòng nào</p>
              {isAdmin && (
                <p className="mt-1 text-xs text-foreground-400">
                  Nhấn nút "+" để tạo phòng trò chuyện nhóm.
                </p>
              )}
            </div>
          ) : (
            rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => handleSelect(room.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selectedRoomId === room.id ? "bg-primary-50" : "hover:bg-background-100"
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-secondary-500 text-white flex items-center justify-center shrink-0">
                  <i className="ri-chat-smile-2-line text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground-900 truncate">{room.name}</p>
                  <p className="text-[11px] text-foreground-500">{room.memberIds.length} thành viên</p>
                </div>
                {isAdmin && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(room.id);
                    }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-400 hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                  >
                    <i className="ri-delete-bin-line text-sm" />
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`${mobileRoom ? "flex" : "hidden"} md:flex flex-1 flex-col min-w-0`}>
        {selectedRoom ? (
          <ChatArea
            room={selectedRoom}
            messages={messages}
            currentUserId={currentUser!.id}
            onBack={() => setMobileRoom(false)}
            onSend={handleSend}
            onOpenMembers={() => setMembersOpen(true)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
              <i className="ri-chat-smile-2-line text-2xl text-foreground-400" />
            </div>
            <p className="mt-4 font-heading font-semibold text-foreground-700">Chọn một phòng</p>
            <p className="mt-1 text-sm text-foreground-400">
              Chọn phòng bên trái để bắt đầu trò chuyện với đồng nghiệp.
            </p>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateRoomModal
          members={members}
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onDone={handleCreate}
        />
      )}

      {membersOpen && selectedRoom && (
        <MembersModal
          room={selectedRoom}
          members={members}
          busy={busy}
          onClose={() => setMembersOpen(false)}
          onAdd={handleAddMembers}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-background-50 text-sm px-4 py-2.5 rounded-lg shadow-sm animate-slide-up">
          <i className="ri-check-line mr-1 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

function ChatArea({
  room,
  messages,
  currentUserId,
  onBack,
  onSend,
  onOpenMembers,
}: {
  room: { id: string; name: string; memberIds: string[] };
  messages: { id: string; senderId: string; senderName: string; content: string; sentAt: string }[];
  currentUserId: string;
  onBack: () => void;
  onSend: (content: string) => void;
  onOpenMembers: () => void;
}) {
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
    setShowEmoji(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <>
      <div className="flex items-center gap-3 px-3 md:px-4 py-3 border-b border-background-200">
        <button
          type="button"
          onClick={onBack}
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-foreground-600 hover:bg-background-100 cursor-pointer"
          aria-label="Quay lại"
        >
          <i className="ri-arrow-left-line" />
        </button>
        <div className="w-9 h-9 rounded-lg bg-secondary-500 text-white flex items-center justify-center shrink-0">
          <i className="ri-chat-smile-2-line text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground-900 truncate">{room.name}</p>
          <p className="text-[11px] text-foreground-500">{room.memberIds.length} thành viên</p>
        </div>
        <button
          type="button"
          onClick={onOpenMembers}
          className="px-2.5 py-1.5 rounded-md bg-background-100 text-foreground-700 text-xs hover:bg-background-200 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-group-line mr-1" />
          Thành viên
        </button>
      </div>

      <div className="flex-1 overflow-y-auto cs-scroll px-3 md:px-5 py-4 space-y-3 bg-background-50">
        {messages.length === 0 && (
          <p className="text-center text-sm text-foreground-400 py-10">
            Chưa có tin nhắn. Hãy bắt đầu trò chuyện với đồng nghiệp! 👋
          </p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {!mine && <span className="text-[10px] text-foreground-400 mb-0.5 px-1">{m.senderName}</span>}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    mine
                      ? "bg-secondary-500 text-white rounded-br-md"
                      : "bg-background-100 text-foreground-900 rounded-bl-md"
                  }`}
                >
                  {m.content}
                </div>
                <span className="text-[10px] text-foreground-400 mt-1 px-1">{formatTime(m.sentAt)}</span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {showEmoji && (
        <div className="px-3 py-2 border-t border-background-200 bg-background-50 flex gap-1 flex-wrap">
          {CUTE_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setInput((v) => v + e)}
              className="w-8 h-8 rounded-md text-lg hover:bg-background-100 cursor-pointer"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 md:px-4 py-3 border-t border-background-200 bg-background-50">
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-100 cursor-pointer"
          title="Biểu tượng cảm xúc"
        >
          <i className="ri-emotion-line text-lg" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Nhập tin nhắn..."
          className="flex-1 px-3.5 py-2.5 rounded-full border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          type="button"
          onClick={send}
          className="w-10 h-10 rounded-full bg-secondary-500 text-white flex items-center justify-center hover:bg-secondary-600 cursor-pointer shrink-0"
          aria-label="Gửi"
        >
          <i className="ri-send-plane-fill" />
        </button>
      </div>
    </>
  );
}

function CreateRoomModal({
  members,
  busy,
  onClose,
  onDone,
}: {
  members: { id: string; name: string; role: string }[];
  busy: boolean;
  onClose: () => void;
  onDone: (name: string, description: string, memberIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const staffMembers = members.filter((m) => m.role === "staff");

  return (
    <Modal
      open
      title="Tạo phòng trò chuyện"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => onDone(name.trim(), description.trim(), selected)}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang tạo..." : "Tạo phòng"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Tên phòng</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Phòng họp đội CSKH"
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Mô tả (tùy chọn)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Trao đổi công việc hằng ngày"
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Thành viên</label>
          {staffMembers.length === 0 ? (
            <p className="text-xs text-foreground-400">Chưa có nhân viên nào.</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto cs-scroll">
              {staffMembers.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(m.id)}
                    onChange={() => toggle(m.id)}
                    className="w-4 h-4 rounded border-background-300 text-primary-500 focus:ring-primary-400"
                  />
                  {m.name}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MembersModal({
  room,
  members,
  busy,
  onClose,
  onAdd,
}: {
  room: { id: string; name: string; memberIds: string[] };
  members: { id: string; name: string; role: string }[];
  busy: boolean;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const staffMembers = members.filter((m) => m.role === "staff");
  const available = staffMembers.filter((m) => !room.memberIds.includes(m.id));

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Modal
      open
      title={`Thành viên - ${room.name}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => onAdd(selected)}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang thêm..." : "Thêm thành viên"}
          </button>
        </>
      }
    >
      {available.length === 0 ? (
        <p className="text-sm text-foreground-500">Tất cả nhân viên đã có trong phòng.</p>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto cs-scroll">
          {available.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                onChange={() => toggle(m.id)}
                className="w-4 h-4 rounded border-background-300 text-primary-500 focus:ring-primary-400"
              />
              {m.name}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}