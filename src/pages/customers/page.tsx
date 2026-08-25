import { useState } from "react";
import Avatar from "@/components/base/Avatar";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { mapCustomer } from "@/lib/mappers";
import { platformMeta, formatDateTime } from "@/utils/ui";
import type { Customer } from "@/types";

interface CustomerRow {
  customer: Customer;
  staffName: string;
  convCount: number;
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");

  const { data: rows, loading, error, reload } = useQuery<CustomerRow[]>(async () => {
    const [custRes, tagRes, convRes, profRes] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("customer_tags").select("customer_id, tag"),
      supabase.from("conversations").select("customer_id, assigned_staff_id"),
      supabase.from("profiles").select("id, name"),
    ]);
    if (custRes.error) throw custRes.error;
    if (tagRes.error) throw tagRes.error;
    if (convRes.error) throw convRes.error;
    if (profRes.error) throw profRes.error;

    const tagsByCustomer: Record<string, string[]> = {};
    (tagRes.data ?? []).forEach((t: { customer_id: string; tag: string }) => {
      (tagsByCustomer[t.customer_id] ??= []).push(t.tag);
    });

    const nameMap: Record<string, string> = {};
    (profRes.data ?? []).forEach((p: { id: string; name: string }) => {
      nameMap[p.id] = p.name;
    });

    const assignedByCustomer: Record<string, string> = {};
    const convCount: Record<string, number> = {};
    (convRes.data ?? []).forEach((c: { customer_id: string; assigned_staff_id: string | null }) => {
      convCount[c.customer_id] = (convCount[c.customer_id] ?? 0) + 1;
      if (c.assigned_staff_id && !assignedByCustomer[c.customer_id]) {
        assignedByCustomer[c.customer_id] = c.assigned_staff_id;
      }
    });

    const list = (custRes.data ?? []).map((c) => mapCustomer(c, tagsByCustomer[c.id] ?? []));
    list.sort(
      (a, b) =>
        new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime()
    );

    return list.map((customer) => ({
      customer,
      staffName: nameMap[assignedByCustomer[customer.id] ?? ""] ?? "—",
      convCount: convCount[customer.id] ?? 0,
    }));
  });

  const filtered = (rows ?? []).filter((r) => {
    const c = r.customer;
    const q = search.trim().toLowerCase();
    if (q && !`${c.name} ${c.username} ${c.phone ?? ""}`.toLowerCase().includes(q)) return false;
    if (platform !== "all" && c.platform !== platform) return false;
    return true;
  });

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground-950">Khách hàng</h2>
          <p className="text-sm text-foreground-500 mt-0.5">
            {rows ? `${rows.length} khách hàng đã liên hệ.` : "Danh sách khách hàng."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, username, SĐT..."
              className="pl-9 pr-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Mọi nền tảng</option>
            <option value="facebook">Facebook</option>
            <option value="telegram">Telegram</option>
            <option value="tiktok">TikTok</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <>
        <div className="hidden md:block bg-background-50 rounded-lg border border-background-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="bg-background-100 text-left text-xs text-foreground-500">
                  <th className="px-4 py-3 font-semibold">Khách hàng</th>
                  <th className="px-4 py-3 font-semibold">Liên hệ</th>
                  <th className="px-4 py-3 font-semibold">Nhãn</th>
                  <th className="px-4 py-3 font-semibold">Nhân viên</th>
                  <th className="px-4 py-3 font-semibold">Liên hệ đầu</th>
                  <th className="px-4 py-3 font-semibold">Gần nhất</th>
                  <th className="px-4 py-3 font-semibold text-right">Hội thoại</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ customer: c, staffName, convCount }) => {
                  const meta = platformMeta[c.platform];
                  return (
                    <tr key={c.id} className="border-t border-background-100 hover:bg-background-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar name={c.name} size="md" />
                            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-background-50 bg-background-100">
                              <i className={`${meta.icon} text-[10px] ${meta.color}`} />
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground-900">{c.name}</p>
                            <p className="text-xs text-foreground-400">{c.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground-600">{c.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.length === 0 ? (
                            <span className="text-xs text-foreground-400">—</span>
                          ) : (
                            c.tags.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary-100 text-secondary-800"
                              >
                                {t}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground-600">{staffName}</td>
                      <td className="px-4 py-3 text-foreground-500 text-xs">
                        {formatDateTime(c.firstContactAt)}
                      </td>
                      <td className="px-4 py-3 text-foreground-500 text-xs">
                        {formatDateTime(c.lastInteractionAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground-900">{convCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

          <div className="md:hidden space-y-3">
            {filtered.map(({ customer: c, staffName, convCount }) => {
              const meta = platformMeta[c.platform];
              return (
                <div key={c.id} className="bg-background-50 rounded-lg border border-background-200 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground-900 truncate">{c.name}</p>
                      <p className="text-xs text-foreground-400 truncate">{c.username}</p>
                    </div>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center bg-background-100 shrink-0">
                      <i className={`${meta.icon} ${meta.color} text-sm`} />
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <p className="text-foreground-400">Liên hệ</p>
                      <p className="text-foreground-800 mt-0.5">{c.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-foreground-400">Hội thoại</p>
                      <p className="text-foreground-800 mt-0.5">{convCount}</p>
                    </div>
                    <div>
                      <p className="text-foreground-400">Nhân viên</p>
                      <p className="text-foreground-800 mt-0.5">{staffName}</p>
                    </div>
                    <div>
                      <p className="text-foreground-400">Gần nhất</p>
                      <p className="text-foreground-800 mt-0.5">{formatDateTime(c.lastInteractionAt)}</p>
                    </div>
                  </div>
                  {c.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary-100 text-secondary-800">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20 text-foreground-500">
      <i className="ri-loader-4-line text-2xl animate-spin mr-2" />
      <span className="text-sm">Đang tải...</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <i className="ri-error-warning-line text-3xl text-red-500" />
      <p className="mt-3 text-sm text-foreground-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 px-4 py-2 rounded-md bg-primary-500 text-white text-sm cursor-pointer whitespace-nowrap"
      >
        Thử lại
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
        <i className="ri-user-search-line text-2xl text-foreground-400" />
      </div>
      <p className="mt-4 font-heading font-semibold text-foreground-700">Chưa có khách hàng</p>
      <p className="mt-1 text-sm text-foreground-400">
        Khi khách hàng nhắn tin qua các kênh đã kết nối, họ sẽ xuất hiện ở đây.
      </p>
    </div>
  );
}