import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface StaffRankingItem {
  id: string;
  name: string;
  avatar: string;
  active: boolean;
  newCustomers: number;
  totalDeposits: number;
  totalBets: number;
  score: number;
}

export const RANKING_WEIGHTS = {
  newCustomer: 20,
  depositPerMillion: 1,
  betPerMillion: 1,
};

interface StatsRow {
  staff_id: string;
  new_customers: number;
  total_deposits: number;
  total_bets: number;
}

interface ProfileRow {
  id: string;
  name: string;
  avatar: string | null;
  active: boolean;
}

export function useStaffRanking() {
  const [items, setItems] = useState<StaffRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profRes, statsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,name,avatar,active")
          .eq("role", "staff")
          .order("name"),
        supabase
          .from("staff_daily_stats")
          .select("staff_id,new_customers,total_deposits,total_bets"),
      ]);
      if (profRes.error) throw profRes.error;
      if (statsRes.error) throw statsRes.error;

      const profiles = (profRes.data ?? []) as ProfileRow[];

      const agg = new Map<string, { newCustomers: number; totalDeposits: number; totalBets: number }>();
      ((statsRes.data ?? []) as StatsRow[]).forEach((s) => {
        const cur = agg.get(s.staff_id) ?? { newCustomers: 0, totalDeposits: 0, totalBets: 0 };
        cur.newCustomers += Number(s.new_customers ?? 0);
        cur.totalDeposits += Number(s.total_deposits ?? 0);
        cur.totalBets += Number(s.total_bets ?? 0);
        agg.set(s.staff_id, cur);
      });

      const list: StaffRankingItem[] = profiles.map((p) => {
        const a = agg.get(p.id) ?? { newCustomers: 0, totalDeposits: 0, totalBets: 0 };
        const score =
          a.newCustomers * RANKING_WEIGHTS.newCustomer +
          (a.totalDeposits / 1_000_000) * RANKING_WEIGHTS.depositPerMillion +
          (a.totalBets / 1_000_000) * RANKING_WEIGHTS.betPerMillion;
        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar ?? "",
          active: p.active,
          newCustomers: a.newCustomers,
          totalDeposits: a.totalDeposits,
          totalBets: a.totalBets,
          score: Math.round(score * 10) / 10,
        };
      });

      list.sort((a, b) => b.score - a.score || b.totalBets - a.totalBets);
      setItems(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải bảng xếp hạng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}