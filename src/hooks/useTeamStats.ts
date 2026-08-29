import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { TeamDailyStat } from "@/types";

export function useTeamStats() {
  const [stats, setStats] = useState<TeamDailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("team_daily_stats")
        .select("*")
        .order("date", { ascending: false });
      if (err) throw err;
      setStats(
        (data ?? []).map((s) => ({
          id: s.id,
          date: s.date,
          newCustomers: s.new_customers ?? 0,
          totalMoneySent: s.total_money_sent ?? 0,
          totalDeposits: s.total_deposits ?? 0,
          totalBets: s.total_bets ?? 0,
          registeredCustomers: s.registered_customers ?? 0,
          betRounds: s.bet_rounds ?? 0,
          createdBy: s.created_by,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }))
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = supabase
      .channel("team-daily-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_daily_stats" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [load]);

  return { stats, loading, error, reload: load };
}