import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useKaraokeRooms } from "@/hooks/useKaraokeRooms";
import { createKaraokeRoom } from "@/lib/actions";
import RoomView from "./components/RoomView";

const DEFAULT_ROOM_NAME = "Phòng Karaoke Chung";

export default function Karaoke() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const { rooms, loading, error, reload } = useKaraokeRooms();
  const [autoCreating, setAutoCreating] = useState(false);
  const [toast, setToast] = useState("");

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // Tự động tạo phòng mặc định nếu admin và chưa có phòng nào
  useEffect(() => {
    if (!isAdmin || rooms.length > 0 || autoCreating) return;
    setAutoCreating(true);
    createKaraokeRoom(DEFAULT_ROOM_NAME)
      .then(() => {
        notify("Đã tạo phòng karaoke chung.");
        reload();
      })
      .catch((e) => {
        notify(e instanceof Error ? e.message : "Tạo phòng thất bại.");
      })
      .finally(() => setAutoCreating(false));
  }, [isAdmin, rooms.length, autoCreating, reload]);

  const room = rooms[0] ?? null;

  if (loading || autoCreating) {
    return (
      <div className="h-full flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-foreground-400 text-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-foreground-600">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-3 px-4 py-2 rounded-md bg-primary-500 text-white text-sm cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
          <i className="ri-mic-line text-2xl text-foreground-400" />
        </div>
        <p className="mt-4 font-heading font-semibold text-foreground-700">
          Chưa có phòng karaoke
        </p>
        <p className="mt-1 text-sm text-foreground-400">
          {isAdmin
            ? "Đang tạo phòng chung..."
            : "Vui lòng chờ Tổ Trưởng tạo phòng karaoke."}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col min-w-0">
        <RoomView
          roomId={room.id}
          roomName={room.name}
          memberCount={room.memberIds.length}
          onBack={() => {}}
        />
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-background-50 text-sm px-4 py-2.5 rounded-lg animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}