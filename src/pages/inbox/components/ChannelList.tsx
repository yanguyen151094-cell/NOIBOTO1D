import type { Channel } from "@/types";
import { platformMeta } from "@/utils/ui";

interface ChannelListProps {
  channels: Channel[];
  selectedId: string;
  onSelect: (id: string) => void;
  totalUnread: number;
  isAdmin: boolean;
  myChannelIds: Set<string>;
}

export default function ChannelList({ channels, selectedId, onSelect, totalUnread, isAdmin, myChannelIds }: ChannelListProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-background-200">
        <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide">Kênh</p>
      </div>
      <div className="flex-1 overflow-y-auto cs-scroll p-2">
        <button
          type="button"
          onClick={() => onSelect("all")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
            selectedId === "all" ? "bg-primary-50" : "hover:bg-background-100"
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-primary-500 text-white flex items-center justify-center shrink-0">
            <i className="ri-apps-2-line text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground-900 truncate">Tất cả các kênh</p>
          </div>
          {totalUnread > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary-500 text-white text-xs font-semibold flex items-center justify-center">
              {totalUnread}
            </span>
          )}
        </button>

        {channels.map((ch) => {
          const meta = platformMeta[ch.platform];
          const readOnly = !isAdmin && !myChannelIds.has(ch.id);
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => onSelect(ch.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                selectedId === ch.id ? "bg-primary-50" : "hover:bg-background-100"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                <i className={`${meta.icon} text-lg ${meta.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground-900 truncate">{ch.name}</p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      ch.status === "connected"
                        ? "bg-emerald-500"
                        : ch.status === "pending"
                        ? "bg-amber-500"
                        : "bg-foreground-300"
                    }`}
                  />
                  <span className="text-[11px] text-foreground-500">
                    {ch.status === "connected"
                      ? "Đã kết nối"
                      : ch.status === "pending"
                      ? "Chờ duyệt"
                      : "Chưa kết nối"}
                  </span>
                  {readOnly && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-foreground-400">
                      <i className="ri-lock-line" />
                      Chỉ xem
                    </span>
                  )}
                </div>
              </div>
              {ch.unread > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary-500 text-white text-xs font-semibold flex items-center justify-center">
                  {ch.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}