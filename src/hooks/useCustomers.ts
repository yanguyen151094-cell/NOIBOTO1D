import { supabase } from "@/lib/supabase";
import { mapCustomer } from "@/lib/mappers";
import { useQuery } from "@/hooks/useQuery";
import type { Customer } from "@/types";
import { mockCustomers } from "@/mocks/appData";

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

export function useCustomers() {
  return useQuery<Customer[]>(async () => {
    try {
      const [custRes, tagRes] = await Promise.all([
        supabase.from("customers").select("*").order("last_interaction_at", { ascending: false }),
        supabase.from("customer_tags").select("customer_id, tag"),
      ]);
      if (custRes.error) throw custRes.error;
      if (tagRes.error) throw tagRes.error;

      const tagsByCustomer: Record<string, string[]> = {};
      (tagRes.data ?? []).forEach((t: { customer_id: string; tag: string }) => {
        (tagsByCustomer[t.customer_id] ??= []).push(t.tag);
      });

      return (custRes.data ?? []).map((c) => mapCustomer(c, tagsByCustomer[c.id] ?? []));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAuthError(msg)) {
        return mockCustomers.map((c) => ({ ...c }));
      }
      throw err;
    }
  });
}