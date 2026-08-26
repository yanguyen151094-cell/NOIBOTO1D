import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mapChannel, mapUser } from "@/lib/mappers";
import type { Channel, User } from "@/types";
import { mockStaffProfiles, mockChannels } from "@/mocks/appData";

export interface StaffData {
  staff: User[];
  channels: Channel[];
  loading: boolean;
  error: string;
  reload: () => void;
}

function isAuthError(message: string): boolean {
  return (
    message.includes("auth") ||
    message.includes("JWT") ||
    message.includes("session") ||
    message.includes("unauthorized") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("RLS") ||
    message.includes("network") ||
    message.includes("cors") ||
    message.includes("failed to fetch") ||
    message.includes("timeout") ||
    message.includes("offline")
  );
}

export function useStaff(): StaffData {
  const [staff, setStaff] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profRes, accessRes, chRes, convRes, msgRes, rteRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "staff").order("name"),
        supabase.from("channel_access").select("user_id, channel_id"),
        supabase.from("channels").select("*").order("name"),
        supabase.from("conversations").select("assigned_staff_id"),
        supabase.from("messages").select("staff_id").eq("sender", "staff"),
        supabase.from("response_time_events").select("first_replier_id, wait_seconds"),
      ]);
      if (profRes.error) throw profRes.error;
      if (accessRes.error) throw accessRes.error;
      if (chRes.error) throw chRes.error;
      if (convRes.error) throw convRes.error;
      if (msgRes.error) throw msgRes.error;
      if (rteRes.error) throw rteRes.error;

      const channelList = (chRes.data ?? []).map(mapChannel);
      setChannels(channelList);

      const accessByUser: Record<string, string[]> = {};
      (accessRes.data ?? []).forEach((a: { user_id: string; channel_id: string }) => {
        (accessByUser[a.user_id] ??= []).push(a.channel_id);
      });

      const customersHandled: Record<string, number> = {};
      (convRes.data ?? []).forEach((c: { assigned_staff_id: string | null }) => {
        if (c.assigned_staff_id) {
          customersHandled[c.assigned_staff_id] = (customersHandled[c.assigned_staff_id] ?? 0) + 1;
        }
      });

      const messagesReplied: Record<string, number> = {};
      (msgRes.data ?? []).forEach((m: { staff_id: string | null }) => {
        if (m.staff_id) {
          messagesReplied[m.staff_id] = (messagesReplied[m.staff_id] ?? 0) + 1;
        }
      });

      const waitSum: Record<string, number> = {};
      const waitCount: Record<string, number> = {};
      (rteRes.data ?? []).forEach(
        (r: { first_replier_id: string | null; wait_seconds: number | null }) => {
          if (r.first_replier_id && r.wait_seconds != null) {
            waitSum[r.first_replier_id] = (waitSum[r.first_replier_id] ?? 0) + r.wait_seconds;
            waitCount[r.first_replier_id] = (waitCount[r.first_replier_id] ?? 0) + 1;
          }
        }
      );

      const staffList = (profRes.data ?? []).map((p) => {
        const avgSeconds =
          waitCount[p.id] > 0 ? waitSum[p.id] / waitCount[p.id] : 0;
        return mapUser(p, accessByUser[p.id] ?? [], {
          customersHandled: customersHandled[p.id] ?? 0,
          messagesReplied: messagesReplied[p.id] ?? 0,
          avgResponseMinutes: Math.round(avgSeconds / 60),
        });
      });

      setStaff(staffList);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isAuthError(msg)) {
        setStaff(mockStaffProfiles.map((p) => ({ ...p })));
        setChannels(mockChannels.map((c) => ({ ...c })));
      } else {
        setError(e instanceof Error ? e.message : "Không thể tải danh sách nhân viên.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { staff, channels, loading, error, reload: load };
}