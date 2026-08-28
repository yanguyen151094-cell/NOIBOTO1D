import { useState } from "react";
import Modal from "@/components/base/Modal";
import { useAuth } from "@/context/AuthContext";
import { useKaraokeRooms } from "@/hooks/useKaraokeRooms";
import { createKaraokeRoom, deleteKaraokeRoom } from "@/lib/actions";
import RoomView from "./components/RoomView";

export default function Karaoke() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const { rooms, loading, error, reload } = useKaraokeRooms();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [mobileRoom, setMobileRoom] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
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

  const handleCreate = async (name: string) => {
    setBusy(true);
    try {
      const roomId = await createKaraokeRoom(name);
      setCreateOpen(false);
      setSelectedRoomId(roomId);
      setMobileRoom(true);
      notify(`Đã tạo phòng "${name}".`);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Tạo phòng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (roomId: string) => {
    setBusy(true);
    try {
      await deleteKaraokeRoom(roomId);
      if (selectedRoomId === roomId) setSelectedRoomId(null);
      notify("Đã xóa phòng hát.");
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Xóa phòng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex">
      {/* Room list */}
      <div
        className={`${
          mobileRoom ? "hidden" : "flex"
        } md:flex w-full md:w-72 shrink-0 flex-col border-r border-background-200`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-background-200">
          <div>
            <p className="text-sm font-semibold text-foreground-900">Phòng hát karaoke</p>
            <p className="text-[11px] text-foreground-500">Cùng hát, cùng vui 🎤</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="w-9 h-9 rounded-lg bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 cursor-pointer"
            title="Tạo phòng"
          >
            <i className="ri-add-line" />
          </button>
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
                <i className="ri-mic-line text-xl text-foreground-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground-700">Chưa có phòng hát nào</p>
              <p className="mt-1 text-xs text-foreground-400">
                Nhấn nút "+" để tạo phòng hát đầu tiên cho team.
              </p>
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
                <div className="w-9 h-9 rounded-lg bg-accent-500 text-white flex items-center justify-center shrink-0">
                  <i className="ri-mic-line text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground-900 truncate">{room.name}</p>
                  <p className="text-[11px] text-foreground-500">{room.memberIds.length} thành viên</p>
                </div>
                {room.currentTitle && (
                  <span className="text-[10px] text-accent-700 bg-accent-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <i className="ri-music-2-fill mr-0.5" />
                    Đang hát
                  </span>
                )}
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

      {/* Room view */}
      <div className={`${mobileRoom ? "flex" : "hidden"} md:flex flex-1 flex-col min-w-0`}>
        {selectedRoom ? (
          <RoomView
            roomId={selectedRoom.id}
            roomName={selectedRoom.name}
            memberCount={selectedRoom.memberIds.length}
            onBack={() => setMobileRoom(false)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
              <i className="ri-mic-line text-2xl text-foreground-400" />
            </div>
            <p className="mt-4 font-heading font-semibold text-foreground-700">Chọn một phòng hát</p>
            <p className="mt-1 text-sm text-foreground-400">
              Chọn phòng bên trái để vào hát cùng đồng nghiệp.
            </p>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateRoomModal
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onDone={handleCreate}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-background-50 text-sm px-4 py-2.5 rounded-lg animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}

function CreateRoomModal({
  busy,
  onClose,
  onDone,
}: {
  busy: boolean;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <Modal
      open
      title="Tạo phòng hát karaoke"
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
            onClick={() => onDone(name.trim())}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang tạo..." : "Tạo phòng"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Tên phòng hát</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && !busy && onDone(name.trim())}
            placeholder="Ví dụ: Phòng hát TỔ 1D 🎤"
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <p className="text-xs text-foreground-400">
          Mọi người trong team đều có thể vào phòng này để cùng nghe và hát.
        </p>
      </div>
    </Modal>
  );
}