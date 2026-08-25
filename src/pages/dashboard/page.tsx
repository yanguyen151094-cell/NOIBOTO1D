import { useState } from "react";
import {
  BarChart,
  Bar,
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

const LOGO_URL = "https://static.readdy.ai/image/b107d501ab31adf698875488b112872d/f98b9a4e8bfd5d380f0a97483bd53113.png";

const RANGES = ["Hôm nay", "Hôm qua", "7 ngày", "30 ngày"];

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface DashboardData {
  totalMessagesToday: number;
  unanswered: number;
  processing: number;
  completed: number;
  avgResponseMinutes: number;
  replyRate: number;
  ranking: { id: string; name: string; customersHandled: number; avgResponseMinutes: number }[];
  channels: { id: string; name: string; platform: string; status: string; count: number }[];
  trend: { day: string; messages: number }[];
}

export default function Dashboard() {
  const [range, setRange] = useState("Hôm nay");
  const { data, loading, error, reload } = useQuery<DashboardData>(async () => {
    const [convRes, msgRes, profRes, chRes, rteRes] = await Promise.all([
      supabase.from("conversations").select("status, channel_id, assigned_staff_id"),
      supabase.from("messages").select("sent_at"),
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

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const totalMessagesToday = messages.filter(
      (m) => new Date(m.sent_at).getTime() >= startOfToday
    ).length;

    const unanswered = conversations.filter(
      (c) => c.status === "unanswered" || c.status === "unread"
    ).length;
    const processing = conversations.filter((c) => c.status === "processing").length;
    const completed = conversations.filter((c) => c.status === "completed").length;

    const waitSeconds = (rteRes.data ?? [])
      .map((r) => r.wait_seconds)
      .filter((n): n is number => n != null);
    const avgResponseMinutes =
      waitSeconds.length > 0
        ? Math.round(waitSeconds.reduce((a, b) => a + b, 0) / waitSeconds.length / 60)
        : 0;

    const totalAnswered = conversations.filter(
      (c) => c.status === "answered" || c.status === "completed"
    ).length;
    const replyRate =
      conversations.length > 0 ? Math.round((totalAnswered / conversations.length) * 100) : 0;

    const customersHandled: Record<string, number> = {};
    conversations.forEach((c) => {
      if (c.assigned_staff_id) {
        customersHandled[c.assigned_staff_id] = (customersHandled[c.assigned_staff_id] ?? 0) + 1;
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
        avgResponseMinutes:
          waitCount[s.id] > 0 ? Math.round(waitSum[s.id] / waitCount[s.id] / 60) : 0,
      }))
      .sort((a, b) => b.customersHandled - a.customersHandled);

    const channelBreakdown = channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      platform: ch.platform,
      status: ch.status,
      count: conversations.filter((c) => c.channel_id === ch.id).length,
    }));

    const trend: { day: string; messages: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const count = messages.filter((m) => {
        const t = new Date(m.sent_at).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      trend.push({ day: WEEKDAYS[d.getDay()], messages: count });
    }

    return {
      totalMessagesToday,
      unanswered,
      processing,
      completed,
      avgResponseMinutes,
      replyRate,
      ranking,
      channels: channelBreakdown,
      trend,
    };
  });

  const ranked = data?.ranking ?? [];

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="TỔ 1D" className="w-10 h-10 rounded-lg object-cover hidden sm:block" />
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground-950">Chào mừng trở lại, TỔ 1D</h2>
            <p className="text-sm text-foreground-500 mt-0.5">
              Tổng quan hoạt động chăm sóc khách hàng đa kênh.
            </p>
          </div>
        </div>
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
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
            <StatCard label="Tin nhắn hôm nay" value={data?.totalMessagesToday ?? 0} icon="ri-chat-3-line" tone="primary" />
            <StatCard label="Chưa trả lời" value={data?.unanswered ?? 0} icon="ri-mail-unread-line" tone="warning" />
            <StatCard label="Đang xử lý" value={data?.processing ?? 0} icon="ri-loader-4-line" tone="secondary" />
            <StatCard label="Đã hoàn thành" value={data?.completed ?? 0} icon="ri-check-double-line" tone="accent" />
            <StatCard label="Phản hồi TB" value={`${data?.avgResponseMinutes ?? 0} phút`} icon="ri-timer-line" />
            <StatCard label="Tỷ lệ trả lời" value={`${data?.replyRate ?? 0}%`} icon="ri-percent-line" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 bg-background-50 rounded-lg border border-background-200 p-4 md:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-foreground-900">
                  Lượng tin nhắn theo ngày
                </h3>
                <span className="text-xs text-foreground-400">Tuần gần nhất</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.trend ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "oklch(var(--foreground-500))", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "oklch(var(--foreground-500))", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "oklch(var(--background-100))" }}
                      contentStyle={{ borderRadius: 8, border: "1px solid oklch(var(--background-200))", fontSize: 12 }}
                    />
                    <Bar dataKey="messages" name="Tin nhắn" fill="oklch(var(--primary-500))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5">
              <h3 className="font-heading font-semibold text-foreground-900 mb-4">Xếp hạng nhân viên</h3>
              {ranked.length === 0 ? (
                <p className="text-sm text-foreground-400 py-8 text-center">Chưa có nhân viên.</p>
              ) : (
                <ul className="space-y-3">
                  {ranked.map((staff, idx) => (
                    <li key={staff.id} className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          idx === 0 ? "bg-accent-500 text-white" : "bg-background-100 text-foreground-600"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <Avatar name={staff.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground-900 truncate">{staff.name}</p>
                        <p className="text-xs text-foreground-500">{staff.customersHandled} khách đã xử lý</p>
                      </div>
                      <span className="text-xs font-semibold text-primary-700 whitespace-nowrap">
                        {staff.avgResponseMinutes} phút
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5">
            <h3 className="font-heading font-semibold text-foreground-900 mb-4">Thống kê theo kênh</h3>
            {(data?.channels ?? []).length === 0 ? (
              <p className="text-sm text-foreground-400 py-8 text-center">Chưa có kênh nào.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data?.channels ?? []).map((ch) => {
                  const meta = platformMeta[ch.platform as "facebook" | "telegram" | "tiktok"];
                  return (
                    <div key={ch.id} className="flex items-center gap-3 p-3 rounded-lg border border-background-200">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.bg}`}>
                        <i className={`${meta.icon} text-xl ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground-900 truncate">{ch.name}</p>
                        <p className="text-xs text-foreground-500">{ch.count} hội thoại</p>
                      </div>
                      {ch.status === "pending" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-foreground-200/70 text-foreground-600 whitespace-nowrap">
                          Chờ duyệt
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">
                          Đã kết nối
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}