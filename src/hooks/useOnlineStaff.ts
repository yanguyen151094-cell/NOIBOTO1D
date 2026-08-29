import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

export function useOnlineStaff() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, username, role, presence, last_active, avatar, active")
        .eq("active", true)
        .order("last_active", { ascending: false });
      if (error) throw error;
      setUsers(
        (data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          username: p.username,
          role: p.role,
          active: p.active,
          presence: p.presence ?? "offline",
          lastActive: p.last_active ?? "",
          avatar: p.avatar ?? "",
          assignedChannelIds: [],
          customersHandled: 0,
          messagesReplied: 0,
          avgResponseMinutes: 0,
        }))
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const sub = supabase
      .channel("online-staff")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [load]);

  return { users, loading, reload: load };
}