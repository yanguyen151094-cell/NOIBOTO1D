import { useState } from "react";
import Avatar from "@/components/base/Avatar";
import type { ConversationView } from "@/types";
import { platformMeta, statusMeta, waitBadge, formatRelative } from "@/utils/ui";

interface ConversationListProps {
  conversations: ConversationView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack?: () => void;
}

const STATUS_FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "unread", label: "Chưa đọc" },
  { key: "unanswered", label: "Chưa trả lời" },
  { key: "processing", label: "Đang xử lý" },
  { key: "answered", label: "Đã trả lời" },
  { key: "completed", label: "Hoàn thành" },
];

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onBack,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");

  const filtered = conversations
    .filter((c) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const hay = `${c.customer.name} ${c.customer.username} ${c.customer.phone ?? ""} ${c.lastMessage}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (status !== "all" && c.status !== status) return false;
      if (platform !== "all" && c.channel.platform !== platform) return false;
      return true;
    })
    .sort((a, b) => b.waitMinutes - a.waitMinutes);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-background-200 space-y-2">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-600 hover:bg-background-100 cursor-pointer"
              aria-label="Quay lại"
            >
              <i className="ri-arrow-left-line" />
            </button>
          )}
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, username, SĐT, nội dung..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-background-300 bg-background-50 text-xs text-foreground-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Mọi nền tảng</option>
            <option value="facebook">Facebook</option>
            <option value="telegram">Telegram</option>
            <option value="tiktok">TikTok</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-background-300 bg-background-50 text-xs text-foreground-700 focus:outline-none cursor-pointer"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto cs-scroll">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-foreground-400">
            Không tìm thấy hội thoại nào.
          </div>
        ) : (
          filtered.map((c) => {
            const meta = platformMeta[c.channel.platform];
            const st = statusMeta[c.status];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={`w-full flex items-start gap-3 px-3 py-3 text-left border-b border-background-100 transition-colors cursor-pointer ${
                  selectedId === c.id ? "bg-primary-50" : "hover:bg-background-50"
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar name={c.customer.name} size="md" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-background-50 ${meta.bg}`}
                  >
                    <i className={`${meta.icon} text-[9px] ${meta.color}`} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground-900 truncate">
                      {c.customer.name}
                    </p>
                    <span className="text-[11px] text-foreground-400 whitespace-nowrap">
                      {formatRelative(c.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground-600 truncate mt-0.5">{c.lastMessage}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${st.pill}`}>
                      {st.label}
                    </span>
                    {c.waitMinutes > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${waitBadge(c.waitMinutes)}`}>
                        Chờ {c.waitMinutes} phút
                      </span>
                    )}
                    {c.assignedStaffId && (
                      <span className="text-[10px] text-foreground-400">
                        {c.assignments[c.assignments.length - 1]?.staffName}
                      </span>
                    )}
                  </div>
                </div>
                {c.unreadCount > 0 && (
                  <span className="min-w-[18px] h-4 px-1 rounded-full bg-primary-500 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}