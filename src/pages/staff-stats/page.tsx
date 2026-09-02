import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { mapStaffDailyStat } from "@/lib/mappers";
import { upsertStaffDailyStat, updateStaffDailyStat, deleteStaffDailyStat } from "@/lib/actions";
import Modal from "@/components/base/Modal";
import type { StaffDailyStat } from "@/types";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthYearStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function StaffStats() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const [month, setMonth] = useState(monthYearStr(new Date()));
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffDailyStat | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffDailyStat | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const { data: staffList } = useQuery<{ id: string; name: string }[]>(async () => {
    if (!isAdmin) return [];
    const { data, error } = await supabase.from("profiles").select("id, name").eq("role", "staff").eq("active", true);
    if (error) throw error;
    return (data ?? []) as { id: string; name: string }[];
  });

  const {
    data: stats,
    loading,
    error,
    reload,
  } = useQuery<StaffDailyStat[]>(async () => {
    const [year, mon] = month.split("-").map(Number);
    const start = `${year}-${String(mon).padStart(2, "0")}-01`;
    const end = `${year}-${String(mon).padStart(2, "0")}-${getDaysInMonth(year, mon)}`;

    let query = supabase
      .from("staff_daily_stats")
      .select("*, profiles!staff_daily_stats_staff_id_fkey(name)")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });

    if (staffFilter !== "all" && isAdmin) {
      query = query.eq("staff_id", staffFilter);
    }

    const { data, error: e } = await query;
    if (e) throw e;
    return (data ?? []).map((row: Record<string, unknown>) => {
      const mapped = mapStaffDailyStat(row);
      const profile = row.profiles as { name?: string } | undefined;
      mapped.staffName = profile?.name ?? mapped.staffName ?? "";
      return mapped;
    });
  });

  const filteredStats = useMemo(() => {
    if (!stats) return [];
    if (staffFilter === "all" || !isAdmin) return stats;
    return stats.filter((s) => s.staffId === staffFilter);
  }, [stats, staffFilter, isAdmin]);

  const ownStats = useMemo(() => {
    if (!stats || !currentUser) return [];
    return stats.filter((s) => s.staffId === currentUser.id);
  }, [stats, currentUser]);

  const chartStats = useMemo(() => {
    return isAdmin ? filteredStats : ownStats;
  }, [isAdmin, filteredStats, ownStats]);

  const chartData = useMemo(() => {
    const days = getDaysInMonth(Number(month.split("-")[0]), Number(month.split("-")[1]));
    const map = new Map<string, { newCustomers: number; totalDeposits: number; totalBets: number }>();
    for (let i = 1; i <= days; i++) {
      const d = `${month}-${String(i).padStart(2, "0")}`;
      map.set(d, { newCustomers: 0, totalDeposits: 0, totalBets: 0 });
    }
    for (const s of chartStats) {
      const ex = map.get(s.date);
      if (ex) {
        ex.newCustomers += s.newCustomers;
        ex.totalDeposits += s.totalDeposits;
        ex.totalBets += s.totalBets;
      }
    }
    return Array.from(map.entries()).map(([date, vals]) => ({
      date: date.slice(8),
      fullDate: date,
      "Khách mới": vals.newCustomers,
      "Tổng nạp": vals.totalDeposits,
      "Tổng cược": vals.totalBets,
    }));
  }, [chartStats, month]);

  const individualChartData = useMemo(() => {
    if (staffFilter !== "all" || !stats) return [];
    const staffMap = new Map<string, { name: string; data: { day: string; newCustomers: number; totalDeposits: number; totalBets: number }[] }>();
    const days = getDaysInMonth(Number(month.split("-")[0]), Number(month.split("-")[1]));

    for (const s of stats) {
      if (!staffMap.has(s.staffId)) {
        staffMap.set(s.staffId, { name: s.staffName || "Nhân viên", data: [] });
      }
      const entry = staffMap.get(s.staffId)!;
      entry.data.push({
        day: s.date.slice(8),
        newCustomers: s.newCustomers,
        totalDeposits: s.totalDeposits,
        totalBets: s.totalBets,
      });
    }

    return Array.from(staffMap.entries()).map(([id, info]) => {
      const dayMap = new Map<string, { newCustomers: number; totalDeposits: number; totalBets: number }>();
      for (let i = 1; i <= days; i++) {
        const d = `${month}-${String(i).padStart(2, "0")}`;
        dayMap.set(d.slice(8), { newCustomers: 0, totalDeposits: 0, totalBets: 0 });
      }
      for (const d of info.data) {
        const existing = dayMap.get(d.day);
        if (existing) {
          existing.newCustomers += d.newCustomers;
          existing.totalDeposits += d.totalDeposits;
          existing.totalBets += d.totalBets;
        }
      }
      const data = Array.from(dayMap.entries()).map(([day, vals]) => ({
        day,
        "Khách mới": vals.newCustomers,
        "Tổng nạp": vals.totalDeposits,
        "Tổng cược": vals.totalBets,
      }));
      const totals = data.reduce((acc, d) => ({
        newCustomers: acc.newCustomers + d["Khách mới"],
        totalDeposits: acc.totalDeposits + d["Tổng nạp"],
        totalBets: acc.totalBets + d["Tổng cược"],
      }), { newCustomers: 0, totalDeposits: 0, totalBets: 0 });
      return { id, name: info.name, data, totals };
    });
  }, [stats, staffFilter, month]);

  const totals = useMemo(() => {
    return chartStats.reduce(
      (acc, s) => {
        acc.newCustomers += s.newCustomers;
        acc.totalDeposits += s.totalDeposits;
        acc.totalBets += s.totalBets;
        return acc;
      },
      { newCustomers: 0, totalDeposits: 0, totalBets: 0 }
    );
  }, [chartStats]);

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground-950">Số liệu nhân viên</h2>
          <p className="text-sm text-foreground-500 mt-0.5">
            {isAdmin ? "Theo dõi và thống kê số liệu của toàn bộ nhân viên." : "Nhập số liệu công việc hàng ngày của bạn."}
          </p>
        </div>
      </div>

      {!isAdmin && currentUser && (
        <StaffInputForm userId={currentUser.id} userName={currentUser.name} onNotify={notify} onReload={reload} />
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
          >
            <option value="all">Tất cả nhân viên</option>
            {(staffList ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isAdmin && (
        <div className="mb-5">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      )}

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <StatCard label="Tổng khách mới" value={totals.newCustomers.toLocaleString("vi-VN")} icon="ri-user-add-line" color="bg-primary-500" />
            <StatCard label="Tổng nạp" value={totals.totalDeposits.toLocaleString("vi-VN") + "đ"} icon="ri-money-cny-circle-line" color="bg-accent-500" />
            <StatCard label="Tổng cược" value={totals.totalBets.toLocaleString("vi-VN") + "đ"} icon="ri-coins-line" color="bg-secondary-500" />
          </div>

          <div className="bg-background-50 rounded-lg border border-background-200 p-4 mb-6">
            <h3 className="font-heading font-semibold text-foreground-900 mb-3">Biểu đồ theo ngày</h3>
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-300) / 0.5)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "oklch(var(--foreground-600))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "oklch(var(--foreground-600))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(var(--background-50))",
                      border: "1px solid oklch(var(--background-200))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(label: string, payload: Array<{ payload: { fullDate: string } }>) => {
                      const item = payload?.[0]?.payload;
                      return item?.fullDate ?? label;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Khách mới" fill="oklch(var(--primary-500))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Tổng nạp" fill="oklch(var(--accent-500))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Tổng cược" fill="oklch(var(--secondary-500))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {individualChartData.length > 0 && (
            <div className="mb-6">
              <h3 className="font-heading font-semibold text-foreground-900 mb-3">Biểu đồ từng nhân viên</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {individualChartData.map((staff) => (
                  <div key={staff.id} className="bg-background-50 rounded-lg border border-background-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-foreground-900">{staff.name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-foreground-500">
                        <span className="text-primary-600">{staff.totals.newCustomers} khách</span>
                        <span className="text-accent-600">{staff.totals.totalDeposits.toLocaleString("vi-VN")}đ</span>
                        <span className="text-secondary-600">{staff.totals.totalBets.toLocaleString("vi-VN")}đ</span>
                      </div>
                    </div>
                    <div className="w-full h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={staff.data} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-300) / 0.3)" />
                          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "oklch(var(--foreground-500))" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "oklch(var(--foreground-500))" }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "oklch(var(--background-50))",
                              border: "1px solid oklch(var(--background-200))",
                              borderRadius: 6,
                              fontSize: 11,
                            }}
                          />
                          <Bar dataKey="Khách mới" fill="oklch(var(--primary-500))" radius={[3, 3, 0, 0]} barSize={8} />
                          <Bar dataKey="Tổng nạp" fill="oklch(var(--accent-500))" radius={[3, 3, 0, 0]} barSize={8} />
                          <Bar dataKey="Tổng cược" fill="oklch(var(--secondary-500))" radius={[3, 3, 0, 0]} barSize={8} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-background-50 rounded-lg border border-background-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-background-100 text-left text-xs text-foreground-500">
                    <th className="px-4 py-3 font-semibold">Ngày</th>
                    {isAdmin && <th className="px-4 py-3 font-semibold">Nhân viên</th>}
                    <th className="px-4 py-3 font-semibold text-right">Khách mới</th>
                    <th className="px-4 py-3 font-semibold text-right">Tổng nạp</th>
                    <th className="px-4 py-3 font-semibold text-right">Tổng cược</th>
                    <th className="px-4 py-3 font-semibold text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-sm text-foreground-400">
                        Chưa có số liệu trong tháng này.
                      </td>
                    </tr>
                  ) : (
                    filteredStats.map((s) => (
                      <tr key={s.id} className="border-t border-background-100 hover:bg-background-50">
                        <td className="px-4 py-3 whitespace-nowrap">{s.date}</td>
                        {isAdmin && <td className="px-4 py-3">{s.staffName || "—"}</td>}
                        <td className="px-4 py-3 text-right">{s.newCustomers.toLocaleString("vi-VN")}</td>
                        <td className="px-4 py-3 text-right">{s.totalDeposits.toLocaleString("vi-VN")}đ</td>
                        <td className="px-4 py-3 text-right">{s.totalBets.toLocaleString("vi-VN")}đ</td>
                        <td className="px-4 py-3 text-center">
                          {(isAdmin || s.staffId === currentUser?.id) && (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditTarget(s)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-400 hover:bg-primary-500/10 hover:text-primary-500 cursor-pointer"
                                title="Sửa"
                              >
                                <i className="ri-edit-line text-sm" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(s)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-400 hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                                title="Xóa"
                              >
                                <i className="ri-delete-bin-line text-sm" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editTarget && (
        <EditModal
          stat={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={async (updated) => {
            setBusy(true);
            try {
              await updateStaffDailyStat(editTarget.id, updated);
              notify("Đã cập nhật số liệu.");
              setEditTarget(null);
              reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : "Cập nhật thất bại.");
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}

      {deleteTarget && (
        <Modal
          open
          title="Xóa số liệu"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await deleteStaffDailyStat(deleteTarget.id);
                    notify("Đã xóa số liệu.");
                    setDeleteTarget(null);
                    reload();
                  } catch (e) {
                    notify(e instanceof Error ? e.message : "Xóa thất bại.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Xóa
              </button>
            </>
          }
        >
          <p className="text-sm text-foreground-700">
            Xóa số liệu ngày <span className="font-semibold">{deleteTarget.date}</span>
            {deleteTarget.staffName && ` của ${deleteTarget.staffName}`}?
          </p>
        </Modal>
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

function StaffInputForm({ userId, userName, onNotify, onReload }: { userId: string; userName: string; onNotify: (msg: string) => void; onReload?: () => void }) {
  const [date, setDate] = useState(todayStr());
  const [newCustomers, setNewCustomers] = useState("");
  const [totalDeposits, setTotalDeposits] = useState("");
  const [totalBets, setTotalBets] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: existing } = useQuery<StaffDailyStat | null>(async () => {
    const { data, error } = await supabase
      .from("staff_daily_stats")
      .select("*")
      .eq("staff_id", userId)
      .eq("date", date)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapStaffDailyStat(data);
  }, [date]);

  useMemo(() => {
    if (existing) {
      setNewCustomers(String(existing.newCustomers));
      setTotalDeposits(String(existing.totalDeposits));
      setTotalBets(String(existing.totalBets));
    } else {
      setNewCustomers("");
      setTotalDeposits("");
      setTotalBets("");
    }
  }, [existing]);

  const submit = async () => {
    setBusy(true);
    try {
      await upsertStaffDailyStat({
        date,
        newCustomers: parseInt(newCustomers.replace(/[^0-9]/g, ""), 10) || 0,
        totalDeposits: parseInt(totalDeposits.replace(/[^0-9]/g, ""), 10) || 0,
        totalBets: parseInt(totalBets.replace(/[^0-9]/g, ""), 10) || 0,
      });
      onNotify("Đã lưu số liệu ngày " + date);
      onReload?.();
    } catch (e) {
      onNotify(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-5 mb-6">
      <h3 className="font-heading font-semibold text-foreground-900 mb-4">Nhập số liệu — {userName}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Ngày</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Khách mới</label>
          <input
            type="number"
            min={0}
            value={newCustomers}
            onChange={(e) => setNewCustomers(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Tổng nạp (VNĐ)</label>
          <input
            type="number"
            min={0}
            value={totalDeposits}
            onChange={(e) => setTotalDeposits(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Tổng cược (VNĐ)</label>
          <input
            type="number"
            min={0}
            value={totalBets}
            onChange={(e) => setTotalBets(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="px-4 py-2.5 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap disabled:opacity-50"
      >
        {busy ? "Đang lưu..." : existing ? "Cập nhật số liệu" : "Lưu số liệu"}
      </button>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} text-white flex items-center justify-center shrink-0`}>
        <i className={`${icon} text-lg`} />
      </div>
      <div>
        <p className="text-xs text-foreground-500">{label}</p>
        <p className="text-lg font-bold text-foreground-900">{value}</p>
      </div>
    </div>
  );
}

function Loading() {
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

function EditModal({
  stat,
  onClose,
  onSave,
  busy,
}: {
  stat: StaffDailyStat;
  onClose: () => void;
  onSave: (input: { newCustomers: number; totalDeposits: number; totalBets: number }) => void;
  busy: boolean;
}) {
  const [newCustomers, setNewCustomers] = useState(String(stat.newCustomers));
  const [totalDeposits, setTotalDeposits] = useState(String(stat.totalDeposits));
  const [totalBets, setTotalBets] = useState(String(stat.totalBets));

  const submit = () => {
    onSave({
      newCustomers: parseInt(newCustomers.replace(/[^0-9]/g, ""), 10) || 0,
      totalDeposits: parseInt(totalDeposits.replace(/[^0-9]/g, ""), 10) || 0,
      totalBets: parseInt(totalBets.replace(/[^0-9]/g, ""), 10) || 0,
    });
  };

  return (
    <Modal
      open
      title={`Sửa số liệu — ${stat.date}${stat.staffName ? ` (${stat.staffName})` : ""}`}
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
            disabled={busy}
            onClick={submit}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Khách mới</label>
          <input
            type="number"
            min={0}
            value={newCustomers}
            onChange={(e) => setNewCustomers(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Tổng nạp (VNĐ)</label>
          <input
            type="number"
            min={0}
            value={totalDeposits}
            onChange={(e) => setTotalDeposits(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Tổng cược (VNĐ)</label>
          <input
            type="number"
            min={0}
            value={totalBets}
            onChange={(e) => setTotalBets(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      </div>
    </Modal>
  );
}