import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import StatCard from "@/components/base/StatCard";
import Avatar from "@/components/base/Avatar";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { mapChannel } from "@/lib/mappers";
import { platformMeta } from "@/utils/ui";

const RANGES = ["Hôm nay", "Hôm qua", "7 ngày", "30 ngày", "Tùy chỉnh"];

interface ReportData {
  totalMessages: number;
  unanswered: number;
  completed: number;
  avgResponseMinutes: number;
  ranking: { id: string; name: string; customersHandled: number; messagesReplied: number; avgResponseMinutes: number }[];
  channels: { id: string; name: string; platform: string; count: number }[];
  trend: { day: string; msg: number; replied: number }[];
}

export default function Reports() {
  const [range, setRange] = useState("7 ngày");
  const { data, loading, error, reload } = useQuery<ReportData>(async () => {
    const [convRes, msgRes, profRes, chRes, rteRes] = await Promise.all([
      supabase.from("conversations").select("status, channel_id, assigned_staff_id"),
      supabase.from("messages").select("sent_at, sender, staff_id"),
      supabase.from("profiles").select("id, name").eq("role", "staff"),
      supabase.from("channels").select("*"),
      supabase.from("response_time_events").select("wait_seconds, first_replier_id"),
    ]);
    if (convRes.error) throw convRes.error;
    if (msgRes.error) throw msgRes.error;
    if (profRes.error) throw profRes.error;
    if (chRes.error) throw chRes.error;
    if (rteRes.error) throw rteRes.error;

    const conversations = convRes.data ?? [];
    const messages = msgRes.data ?? [];
    const staff = profRes.data ?? [];
    const channels = (chRes.data ?? []).map(mapChannel);

    const totalMessages = messages.length;
    const unanswered = conversations.filter(
      (c) => c.status === "unanswered" || c.status === "unread"
    ).length;
    const completed = conversations.filter((c) => c.status === "completed").length;

    const waitSeconds = (rteRes.data ?? [])
      .map((r) => r.wait_seconds)
      .filter((n): n is number => n != null);
    const avgResponseMinutes =
      waitSeconds.length > 0
        ? Math.round(waitSeconds.reduce((a, b) => a + b, 0) / waitSeconds.length / 60)
        : 0;

    const customersHandled: Record<string, number> = {};
    conversations.forEach((c) => {
      if (c.assigned_staff_id) {
        customersHandled[c.assigned_staff_id] = (customersHandled[c.assigned_staff_id] ?? 0) + 1;
      }
    });
    const messagesReplied: Record<string, number> = {};
    messages.forEach((m) => {
      if (m.staff_id && m.sender === "staff") {
        messagesReplied[m.staff_id] = (messagesReplied[m.staff_id] ?? 0) + 1;
      }
    });
    const waitSum: Record<string, number> = {};
    const waitCount: Record<string, number> = {};
    (rteRes.data ?? []).forEach((r) => {
      if (r.first_replier_id && r.wait_seconds != null) {
        waitSum[r.first_replier_id] = (waitSum[r.first_replier_id] ?? 0) + r.wait_seconds;
        waitCount[r.first_replier_id] = (waitCount[r.first_replier_id] ?? 0) + 1;
      }
    });

    const ranking = staff
      .map((s) => ({
        id: s.id,
        name: s.name,
        customersHandled: customersHandled[s.id] ?? 0,
        messagesReplied: messagesReplied[s.id] ?? 0,
        avgResponseMinutes:
          waitCount[s.id] > 0 ? Math.round(waitSum[s.id] / waitCount[s.id] / 60) : 0,
      }))
      .sort((a, b) => b.customersHandled - a.customersHandled);

    const channelBreakdown = channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      platform: ch.platform,
      count: conversations.filter((c) => c.channel_id === ch.id).length,
    }));

    const now = new Date();
    const trend: { day: string; msg: number; replied: number }[] = [];
    for (let i = 13; i >= 0; i -= 2) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      let msg = 0;
      let replied = 0;
      messages.forEach((m) => {
        const t = new Date(m.sent_at).getTime();
        if (t >= dayStart && t < dayEnd) {
          msg += 1;
          if (m.sender === "staff") replied += 1;
        }
      });
      trend.push({ day: label, msg, replied });
    }

    return { totalMessages, unanswered, completed, avgResponseMinutes, ranking, channels: channelBreakdown, trend };
  });

  const ranked = data?.ranking ?? [];

  const downloadCSV = () => {
    const rows = [
      ["Nhân viên", "Khách đã xử lý", "Tin đã trả lời", "Phản hồi TB (phút)"],
      ...ranked.map((u) => [
        u.name,
        String(u.customersHandled),
        String(u.messagesReplied),
        String(u.avgResponseMinutes),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bao-cao-hieu-suat.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground-950">Báo cáo</h2>
          <p className="text-sm text-foreground-500 mt-0.5">Phân tích hiệu suất chăm sóc khách hàng.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-background-100 rounded-full p-1 max-w-full overflow-x-auto">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  range === r ? "bg-primary-500 text-white" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={downloadCSV}
            className="px-3 py-2 rounded-md bg-background-100 text-foreground-700 text-sm hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-download-line mr-1" />
            Xuất CSV
          </button>
        </div>
      </div>

      {range === "Tùy chỉnh" && (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-foreground-600">Từ ngày</label>
          <input type="date" className="px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm" />
          <label className="text-sm text-foreground-600">Đến ngày</label>
          <input type="date" className="px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm" />
        </div>
      )}

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
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard label="Tổng tin nhắn" value={data?.totalMessages ?? 0} icon="ri-chat-3-line" tone="primary" />
            <StatCard label="Chưa trả lời" value={data?.unanswered ?? 0} icon="ri-mail-unread-line" tone="warning" />
            <StatCard label="Đã hoàn thành" value={data?.completed ?? 0} icon="ri-check-double-line" tone="accent" />
            <StatCard label="Phản hồi TB" value={`${data?.avgResponseMinutes ?? 0} phút`} icon="ri-timer-line" />
          </div>

          <div className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5">
            <h3 className="font-heading font-semibold text-foreground-900 mb-4">
              Xu hướng tin nhắn & phản hồi
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.trend ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "oklch(var(--foreground-500))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "oklch(var(--foreground-500))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid oklch(var(--background-200))", fontSize: 12 }} />
                  <Line type="monotone" dataKey="msg" name="Tin nhắn" stroke="oklch(var(--primary-500))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="replied" name="Đã trả lời" stroke="oklch(var(--accent-500))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5">
              <h3 className="font-heading font-semibold text-foreground-900 mb-4">Hiệu suất nhân viên</h3>
              {ranked.length === 0 ? (
                <p className="text-sm text-foreground-400 py-8 text-center">Chưa có nhân viên.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[440px]">
                    <thead>
                      <tr className="text-left text-xs text-foreground-500 border-b border-background-100">
                        <th className="pb-2 font-semibold">Nhân viên</th>
                        <th className="pb-2 font-semibold text-right">Khách</th>
                        <th className="pb-2 font-semibold text-right">Tin trả lời</th>
                        <th className="pb-2 font-semibold text-right">TB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((s) => (
                        <tr key={s.id} className="border-b border-background-50">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <Avatar name={s.name} size="sm" />
                              <span className="text-foreground-900">{s.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-right text-foreground-900">{s.customersHandled}</td>
                          <td className="py-2.5 text-right text-foreground-900">{s.messagesReplied}</td>
                          <td className="py-2.5 text-right text-foreground-900">{s.avgResponseMinutes} phút</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5">
              <h3 className="font-heading font-semibold text-foreground-900 mb-4">Thống kê theo kênh</h3>
              {(data?.channels ?? []).length === 0 ? (
                <p className="text-sm text-foreground-400 py-8 text-center">Chưa có kênh nào.</p>
              ) : (
                <ul className="space-y-3">
                  {(data?.channels ?? []).map((ch) => {
                    const meta = platformMeta[ch.platform as "facebook" | "telegram" | "tiktok"];
                    const max = Math.max(...(data?.channels ?? []).map((x) => x.count), 1);
                    const pct = Math.round((ch.count / max) * 100);
                    return (
                      <li key={ch.id}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg}`}>
                            <i className={`${meta.icon} ${meta.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-foreground-900 truncate">{ch.name}</p>
                              <span className="text-xs text-foreground-500">{ch.count} hội thoại</span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-background-100 overflow-hidden">
                              <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}