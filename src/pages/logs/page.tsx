import { useState } from "react";
import Avatar from "@/components/base/Avatar";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { formatDateTime } from "@/utils/ui";

const CATEGORIES = [
  { key: "all", label: "Tất cả", icon: "ri-apps-2-line" },
  { key: "auth", label: "Đăng nhập", icon: "ri-login-box-line" },
  { key: "message", label: "Tin nhắn", icon: "ri-chat-3-line" },
  { key: "note", label: "Ghi chú", icon: "ri-sticky-note-line" },
  { key: "assign", label: "Phân công", icon: "ri-user-shared-line" },
  { key: "permission", label: "Phân quyền", icon: "ri-shield-keyhole-line" },
  { key: "channel", label: "Kênh", icon: "ri-plug-line" },
];

const CATEGORY_LABEL: Record<string, string> = {
  auth: "Đăng nhập",
  message: "Tin nhắn",
  note: "Ghi chú",
  assign: "Phân công",
  permission: "Phân quyền",
  channel: "Kênh",
  system: "Hệ thống",
};

export default function Logs() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const { data: logs, loading, error, reload } = useActivityLogs();

  const filtered = (logs ?? [])
    .filter((l) => (category === "all" ? true : l.category === category))
    .filter((l) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${l.actorName} ${l.action} ${l.detail}`.toLowerCase().includes(q);
    });

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground-950">Nhật ký hoạt động</h2>
          <p className="text-sm text-foreground-500 mt-0.5">
            Chỉ quản trị viên được xem · không thể chỉnh sửa hay xóa.
          </p>
        </div>
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm nhật ký..."
            className="pl-9 pr-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              category === c.key
                ? "bg-primary-500 text-white"
                : "bg-background-100 text-foreground-600 hover:bg-background-200"
            }`}
          >
            <i className={c.icon} />
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-foreground-500">
          <i className="ri-loader-4-line text-2xl animate-spin mr-2" />
          <span className="text-sm">Đang tải...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
            <i className="ri-file-list-3-line text-2xl text-foreground-400" />
          </div>
          <p className="mt-4 font-heading font-semibold text-foreground-700">Chưa có nhật ký</p>
          <p className="mt-1 text-sm text-foreground-400">
            Các hoạt động sẽ được ghi lại tự động tại đây.
          </p>
        </div>
      ) : (
        <>
        <div className="hidden md:block bg-background-50 rounded-lg border border-background-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-background-100 text-left text-xs text-foreground-500">
                  <th className="px-4 py-3 font-semibold">Người thực hiện</th>
                  <th className="px-4 py-3 font-semibold">Hành động</th>
                  <th className="px-4 py-3 font-semibold">Chi tiết</th>
                  <th className="px-4 py-3 font-semibold">Thời gian</th>
                  <th className="px-4 py-3 font-semibold">Thiết bị</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-t border-background-100 hover:bg-background-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={l.actorName} size="sm" />
                        <div>
                          <p className="font-medium text-foreground-900">{l.actorName}</p>
                          <p className="text-[11px] text-foreground-400">
                            {l.actorRole === "admin" ? "Tổ Trưởng ( OBICARE )" : "Nhân viên"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-background-100 text-foreground-600">
                        {CATEGORY_LABEL[l.category] ?? l.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground-600 max-w-xs truncate" title={l.detail}>
                      {l.detail}
                    </td>
                    <td className="px-4 py-3 text-foreground-500 text-xs">{formatDateTime(l.at)}</td>
                    <td className="px-4 py-3 text-foreground-500 text-xs">{l.device}</td>
                    <td className="px-4 py-3 text-foreground-400 text-xs font-mono">{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

          <div className="md:hidden space-y-3">
            {filtered.map((l) => (
              <div key={l.id} className="bg-background-50 rounded-lg border border-background-200 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={l.actorName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground-900 truncate">{l.actorName}</p>
                    <p className="text-[11px] text-foreground-400">{l.actorRole === "admin" ? "Tổ Trưởng ( OBICARE )" : "Nhân viên"}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-background-100 text-foreground-600 shrink-0">
                    {CATEGORY_LABEL[l.category] ?? l.category}
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground-600">{l.detail}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-foreground-400 flex-wrap gap-1">
                  <span>{formatDateTime(l.at)}</span>
                  <span>{l.device} · {l.ip}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}