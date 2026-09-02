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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg bg-background-50 rounded-xl border border-background-200 shadow-xl overflow-hidden animate-slide-up max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-background-200 flex items-center justify-between bg-foreground-950">
          <h3 className="font-heading font-semibold text-white text-sm">
            Thông báo dành cho bạn
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="overflow-y-auto cs-scroll p-5 space-y-4">
          {rewards.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <i className="ri-gift-2-line text-emerald-600 text-sm" />
                </div>
                <p className="text-sm font-semibold text-emerald-700">Thưởng gần đây</p>
              </div>
              <div className="space-y-2">
                {rewards.map((r) => (
                  <div key={r.id} className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                    <p className="text-sm font-medium text-foreground-900">{r.workName}</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Số tiền: {r.amount.toLocaleString("vi-VN")}đ
                    </p>
                    <p className="text-[11px] text-foreground-500 mt-1">
                      Ngân hàng: {r.bankName} · STK: {r.accountNumber}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {punishments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                  <i className="ri-alarm-warning-line text-red-600 text-sm" />
                </div>
                <p className="text-sm font-semibold text-red-700">Thông báo phạt chưa đọc</p>
              </div>
              <div className="space-y-2">
                {punishments.map((p) => (
                  <div key={p.id} className="bg-red-50 border border-red-100 rounded-lg p-3">
                    <p className="text-sm font-medium text-foreground-900">{p.reason}</p>
                    {p.amount > 0 && (
                      <p className="text-xs text-red-700 mt-0.5">
                        Số tiền phạt: {p.amount.toLocaleString("vi-VN")}đ
                      </p>
                    )}
                    <p className="text-[11px] text-foreground-500 mt-1">Ngày phạt: {p.punishmentDate}</p>
                    <button
                      type="button"
                      onClick={() => handleMarkRead(p.id)}
                      className="mt-2 px-3 py-1 rounded-md text-xs bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer whitespace-nowrap"
                    >
                      Đã đọc
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-background-200 bg-background-50">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-2.5 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}