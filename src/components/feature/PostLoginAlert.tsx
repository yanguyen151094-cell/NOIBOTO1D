import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { mapStaffPunishment, mapReward } from "@/lib/mappers";
import type { StaffPunishment, Reward } from "@/types";

const SHOWN_KEY = "post_login_alert_shown";

export default function PostLoginAlert() {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [punishments, setPunishments] = useState<StaffPunishment[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === "admin") return;
    if (sessionStorage.getItem(SHOWN_KEY)) return;

    const load = async () => {
      setLoading(true);
      try {
        const [punRes, rewRes] = await Promise.all([
          supabase
            .from("staff_punishments")
            .select("*, profiles!staff_punishments_staff_id_fkey(name)")
            .eq("staff_id", currentUser.id)
            .eq("is_read", false)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("staff_rewards")
            .select("*")
            .eq("staff_id", currentUser.id)
            .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        const pList = (punRes.data ?? []).map((row: Record<string, unknown>) => {
          const mapped = mapStaffPunishment(row);
          const profile = row.profiles as { name?: string } | undefined;
          mapped.staffName = profile?.name ?? mapped.staffName ?? "";
          return mapped;
        });
        const rList = (rewRes.data ?? []).map((row: Record<string, unknown>) => mapReward(row));

        setPunishments(pList);
        setRewards(rList);

        if (pList.length > 0 || rList.length > 0) {
          setOpen(true);
          sessionStorage.setItem(SHOWN_KEY, "1");
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentUser]);

  const handleMarkRead = async (id: string) => {
    try {
      await supabase.from("staff_punishments").update({ is_read: true }).eq("id", id);
      setPunishments((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  };

  const hasItems = punishments.length > 0 || rewards.length > 0;

  if (!open || loading || !hasItems) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-2xl bg-background-50 rounded-2xl border border-background-200 shadow-2xl overflow-hidden animate-slide-up max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-background-200 flex items-center justify-between bg-gradient-to-r from-foreground-950 to-foreground-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <i className="ri-notification-3-line text-white text-lg" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-white text-base">
                Thông báo dành cho bạn
              </h3>
              <p className="text-xs text-white/60 mt-0.5">
                {punishments.length > 0 && rewards.length > 0
                  ? `Bạn có ${punishments.length} thông báo phạt và ${rewards.length} thưởng`
                  : punishments.length > 0
                  ? `Bạn có ${punishments.length} thông báo phạt`
                  : `Bạn có ${rewards.length} thưởng gần đây`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto cs-scroll p-6 space-y-5">
          {rewards.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <i className="ri-gift-2-line text-emerald-600 text-lg" />
                </div>
                <p className="text-base font-bold text-emerald-700">Thưởng gần đây</p>
                <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                  {rewards.length} lần
                </span>
              </div>
              <div className="space-y-3">
                {rewards.map((r) => (
                  <div key={r.id} className="bg-emerald-50/80 border-2 border-emerald-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-foreground-900">{r.workName}</p>
                    <p className="text-sm text-emerald-700 mt-1.5 font-semibold">
                      Số tiền: {r.amount.toLocaleString("vi-VN")}đ
                    </p>
                    <p className="text-xs text-foreground-500 mt-2">
                      Ngân hàng: <span className="font-medium text-foreground-700">{r.bankName}</span> · STK: <span className="font-medium text-foreground-700">{r.accountNumber}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {punishments.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                  <i className="ri-alarm-warning-line text-red-600 text-lg" />
                </div>
                <p className="text-base font-bold text-red-700">Thông báo phạt chưa đọc</p>
                <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-semibold">
                  {punishments.length} lần
                </span>
              </div>
              <div className="space-y-3">
                {punishments.map((p) => (
                  <div key={p.id} className="bg-red-50/80 border-2 border-red-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-foreground-900 leading-relaxed">{p.reason}</p>
                    {p.amount > 0 && (
                      <p className="text-sm text-red-700 mt-1.5 font-semibold">
                        Số tiền phạt: {p.amount.toLocaleString("vi-VN")}đ
                      </p>
                    )}
                    <p className="text-xs text-foreground-500 mt-2">
                      Ngày phạt: <span className="font-medium text-foreground-700">{p.punishmentDate}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleMarkRead(p.id)}
                      className="mt-3 px-4 py-2 rounded-lg text-xs bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer whitespace-nowrap font-semibold transition-colors"
                    >
                      Đánh dấu đã đọc
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-background-200 bg-background-50">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-3 rounded-xl bg-primary-500 text-white text-sm font-bold hover:bg-primary-600 cursor-pointer whitespace-nowrap transition-colors"
          >
            Đã hiểu — Đóng thông báo
          </button>
        </div>
      </div>
    </div>
  );
}