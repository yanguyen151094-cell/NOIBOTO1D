import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTeamStats } from "@/hooks/useTeamStats";
import { upsertTeamDailyStat, deleteTeamDailyStat } from "@/lib/actions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  LabelList,
} from "recharts";
import type { TeamDailyStat } from "@/types";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("vi-VN");
}

export default function TeamStatsPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const { stats, loading, error, reload } = useTeamStats();

  const [showForm, setShowForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    newCustomers: 0,
    totalMoneySent: 0,
    totalDeposits: 0,
    totalBets: 0,
    registeredCustomers: 0,
  });

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const monthStats = useMemo(() => {
    return stats
      .filter((s) => s.date.startsWith(selectedMonth))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [stats, selectedMonth]);

  const totals = useMemo(() => {
    const base = monthStats.reduce(
      (acc, s) => ({
        newCustomers: acc.newCustomers + s.newCustomers,
        totalMoneySent: acc.totalMoneySent + s.totalMoneySent,
        totalDeposits: acc.totalDeposits + s.totalDeposits,
        totalBets: acc.totalBets + s.totalBets,
        registeredCustomers: acc.registeredCustomers + s.registeredCustomers,
        betRounds: 0,
      }),
      { newCustomers: 0, totalMoneySent: 0, totalDeposits: 0, totalBets: 0, registeredCustomers: 0, betRounds: 0 }
    );
    if (monthStats.length > 0) {
      base.betRounds = monthStats.reduce((sum, m) => sum + m.betRounds, 0) / monthStats.length;
    }
    return base;
  }, [monthStats]);

  const averages = useMemo(() => {
    const count = monthStats.length;
    if (count === 0) {
      return { newCustomers: 0, totalMoneySent: 0, totalDeposits: 0, totalBets: 0, registeredCustomers: 0, betRounds: 0 };
    }
    return {
      newCustomers: Math.round(totals.newCustomers / count),
      totalMoneySent: Math.round(totals.totalMoneySent / count),
      totalDeposits: Math.round(totals.totalDeposits / count),
      totalBets: Math.round(totals.totalBets / count),
      registeredCustomers: Math.round(totals.registeredCustomers / count),
      betRounds: totals.betRounds,
    };
  }, [monthStats, totals]);

  const chartData = useMemo(() => {
    return monthStats.map((s) => ({
      date: Number(s.date.slice(8)).toString(),
      "Khách mới": s.newCustomers,
      "Tổng nạp": s.totalDeposits,
      "Tổng cược": s.totalBets,
      "Khách đăng ký": s.registeredCustomers,
      "Tiền gửi": s.totalMoneySent,
      "Vòng cược": Number(s.betRounds.toFixed(2)),
    }));
  }, [monthStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await upsertTeamDailyStat({
        date: form.date,
        newCustomers: Number(form.newCustomers) || 0,
        totalMoneySent: Number(form.totalMoneySent) || 0,
        totalDeposits: Number(form.totalDeposits) || 0,
        totalBets: Number(form.totalBets) || 0,
        registeredCustomers: Number(form.registeredCustomers) || 0,
      });
      notify("Đã lưu số liệu tổ.");
      setShowForm(false);
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Lỗi.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa số liệu ngày này?")) return;
    setBusy(true);
    try {
      await deleteTeamDailyStat(id);
      notify("Đã xóa.");
      reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Lỗi.");
    } finally {
      setBusy(false);
    }
  };

  const months = useMemo(() => {
    const set = new Set<string>();
    stats.forEach((s) => set.add(s.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [stats]);

  if (loading) {
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

  const avgItems = [
    { label: "KHÁCH MỚI", value: averages.newCustomers },
    { label: "SL TIỀN GỬI", value: averages.totalMoneySent },
    { label: "TỔNG NẠP", value: averages.totalDeposits },
    { label: "TỔNG CƯỢC", value: averages.totalBets },
    { label: "ĐĂNG KÝ", value: averages.registeredCustomers },
    { label: "VÒNG CƯỢC", value: Number(averages.betRounds.toFixed(2)) },
  ];

  return (
    <div className="h-full flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-background-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-500 text-white flex items-center justify-center shrink-0">
            <i className="ri-bar-chart-grouped-line text-lg" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground-900">Số liệu tổ</p>
            <p className="text-[11px] text-foreground-500">
              {isAdmin ? "Điền số liệu tổng hợp của cả tổ" : "Xem số liệu tổng hợp của tổ"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-2 rounded-md bg-primary-500 text-white text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            {showForm ? "Đóng" : "Nhập số liệu"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto cs-scroll p-4">
        {/* Month selector */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
          >
            {months.length === 0 && (
              <option value={selectedMonth}>{selectedMonth}</option>
            )}
            {months.map((m) => (
              <option key={m} value={m}>
                Tháng {m.slice(5)}/{m.slice(0, 4)}
              </option>
            ))}
          </select>
        </div>

        {/* Form */}
        {showForm && isAdmin && (
          <form
            onSubmit={handleSubmit}
            className="mb-4 rounded-lg border border-background-200 bg-background-50 p-4 space-y-3"
          >
            <p className="text-sm font-semibold text-foreground-900">Nhập số liệu ngày</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground-700 mb-1">Ngày</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-700 mb-1">Khách mới</label>
                <input
                  type="number"
                  min={0}
                  value={form.newCustomers}
                  onChange={(e) => setForm((f) => ({ ...f, newCustomers: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-700 mb-1">Số lượng tiền gửi</label>
                <input
                  type="number"
                  min={0}
                  value={form.totalMoneySent}
                  onChange={(e) => setForm((f) => ({ ...f, totalMoneySent: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-700 mb-1">Tổng nạp</label>
                <input
                  type="number"
                  min={0}
                  value={form.totalDeposits}
                  onChange={(e) => setForm((f) => ({ ...f, totalDeposits: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-700 mb-1">Tổng cược</label>
                <input
                  type="number"
                  min={0}
                  value={form.totalBets}
                  onChange={(e) => setForm((f) => ({ ...f, totalBets: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-700 mb-1">Khách đăng ký</label>
                <input
                  type="number"
                  min={0}
                  value={form.registeredCustomers}
                  onChange={(e) => setForm((f) => ({ ...f, registeredCustomers: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {busy ? "Đang lưu..." : "Lưu số liệu"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-md bg-background-200 text-foreground-700 text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
            </div>
          </form>
        )}

        {/* ====== DASHBOARD: Charts + Averages ====== */}
        <div
          className="rounded-lg p-2 mb-4"
          style={{
            backgroundColor: "#facc15",
            backgroundImage: "radial-gradient(#d97706 1px, transparent 1px)",
            backgroundSize: "10px 10px",
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-2">
            {/* Charts grid */}
            <div className="grid grid-cols-2 grid-rows-3 gap-2">
              {/* Chart 1: Khách mới - Bar */}
              <div className="bg-yellow-50/90 rounded-md p-1 flex flex-col">
                <p className="text-[11px] font-bold text-center text-amber-900">Khách mới</p>
                <div className="flex-1 min-h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #d97706" }}
                        formatter={(value: number) => [formatNumber(value), "Khách mới"]}
                        labelFormatter={(label) => `Ngày ${label}`}
                      />
                      <Bar dataKey="Khách mới" fill="#60a5fa" radius={[2, 2, 0, 0]}>
                        <LabelList dataKey="Khách mới" position="top" fontSize={9} fill="#1f2937" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: SL Tiền gửi - Bar */}
              <div className="bg-yellow-50/90 rounded-md p-1 flex flex-col">
                <p className="text-[11px] font-bold text-center text-amber-900">SL tiền gửi</p>
                <div className="flex-1 min-h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #d97706" }}
                        formatter={(value: number) => [formatNumber(value), "Tiền gửi"]}
                        labelFormatter={(label) => `Ngày ${label}`}
                      />
                      <Bar dataKey="Tiền gửi" fill="#60a5fa" radius={[2, 2, 0, 0]}>
                        <LabelList dataKey="Tiền gửi" position="top" fontSize={9} fill="#1f2937" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Tổng nạp - Line */}
              <div className="bg-yellow-50/90 rounded-md p-1 flex flex-col">
                <p className="text-[11px] font-bold text-center text-amber-900">Tổng nạp</p>
                <div className="flex-1 min-h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #d97706" }}
                        formatter={(value: number) => [formatNumber(value), "Tổng nạp"]}
                        labelFormatter={(label) => `Ngày ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="Tổng nạp"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#ef4444" }}
                        activeDot={{ r: 5 }}
                      >
                        <LabelList dataKey="Tổng nạp" position="top" fontSize={9} fill="#ef4444" />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4: Cược hợp lệ - Line */}
              <div className="bg-yellow-50/90 rounded-md p-1 flex flex-col">
                <p className="text-[11px] font-bold text-center text-amber-900">Cược hợp lệ</p>
                <div className="flex-1 min-h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #d97706" }}
                        formatter={(value: number) => [formatNumber(value), "Tổng cược"]}
                        labelFormatter={(label) => `Ngày ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="Tổng cược"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#ef4444" }}
                        activeDot={{ r: 5 }}
                      >
                        <LabelList dataKey="Tổng cược" position="top" fontSize={9} fill="#ef4444" />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 5: Đăng ký - Bar */}
              <div className="bg-yellow-50/90 rounded-md p-1 flex flex-col">
                <p className="text-[11px] font-bold text-center text-amber-900">Đăng ký</p>
                <div className="flex-1 min-h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #d97706" }}
                        formatter={(value: number) => [formatNumber(value), "Khách đăng ký"]}
                        labelFormatter={(label) => `Ngày ${label}`}
                      />
                      <Bar dataKey="Khách đăng ký" fill="#60a5fa" radius={[2, 2, 0, 0]}>
                        <LabelList dataKey="Khách đăng ký" position="top" fontSize={9} fill="#1f2937" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 6: Vòng cược - Bar */}
              <div className="bg-yellow-50/90 rounded-md p-1 flex flex-col">
                <p className="text-[11px] font-bold text-center text-amber-900">Vòng cược</p>
                <div className="flex-1 min-h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={{ stroke: "#d97706" }} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #d97706" }}
                        formatter={(value: number) => [value.toFixed(2), "Vòng cược"]}
                        labelFormatter={(label) => `Ngày ${label}`}
                      />
                      <Bar dataKey="Vòng cược" fill="#60a5fa" radius={[2, 2, 0, 0]}>
                        <LabelList dataKey="Vòng cược" position="top" fontSize={9} fill="#1f2937" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right panel: SỐ LIỆU TRUNG BÌNH */}
            <div className="bg-yellow-50/90 rounded-md overflow-hidden flex flex-col">
              <div className="bg-cyan-500 text-white text-center py-2 px-3">
                <p className="text-[11px] font-bold">SỐ LIỆU TRUNG BÌNH</p>
              </div>
              <div className="flex-1 flex flex-col">
                {avgItems.map((item) => (
                  <div key={item.label} className="grid grid-cols-2 border-b border-amber-200 last:border-0 flex-1">
                    <div className="bg-sky-200 flex items-center justify-center px-2 py-2">
                      <p className="text-[11px] font-bold text-sky-900 whitespace-nowrap">{item.label}</p>
                    </div>
                    <div className="bg-yellow-300 flex items-center justify-center px-2 py-2">
                      <p className="text-base font-bold text-amber-900">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-background-200 bg-background-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-background-200">
            <p className="text-sm font-semibold text-foreground-900">Chi tiết theo ngày</p>
          </div>
          {monthStats.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-foreground-500">Chưa có số liệu tháng này</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-background-100">
                    <th className="px-3 py-2 text-left text-xs font-medium text-foreground-600">Ngày</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-foreground-600">Khách mới</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-foreground-600">Tiền gửi</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-foreground-600">Tổng nạp</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-foreground-600">Tổng cược</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-foreground-600">Đăng ký</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-foreground-600">Vòng cược</th>
                    {isAdmin && <th className="px-3 py-2 text-center text-xs font-medium text-foreground-600">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-background-200">
                  {monthStats.map((s) => (
                    <tr key={s.id} className="hover:bg-background-50/50">
                      <td className="px-3 py-2 text-foreground-900">{s.date}</td>
                      <td className="px-3 py-2 text-right text-foreground-700">{s.newCustomers}</td>
                      <td className="px-3 py-2 text-right text-foreground-700">{formatNumber(s.totalMoneySent)}</td>
                      <td className="px-3 py-2 text-right text-foreground-700">{formatNumber(s.totalDeposits)}</td>
                      <td className="px-3 py-2 text-right text-foreground-700">{formatNumber(s.totalBets)}</td>
                      <td className="px-3 py-2 text-right text-foreground-700">{s.registeredCustomers}</td>
                      <td className="px-3 py-2 text-right text-foreground-700 font-medium">{s.betRounds.toFixed(2)}</td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            className="text-red-500 hover:text-red-600 text-xs cursor-pointer"
                          >
                            Xóa
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-background-50 text-sm px-4 py-2.5 rounded-lg animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}