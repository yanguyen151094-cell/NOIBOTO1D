import { supabase } from "@/lib/supabase";
import { mapCustomer } from "@/lib/mappers";
import { useQuery } from "@/hooks/useQuery";
import type { Customer } from "@/types";

export function useCustomers() {
  return useQuery<Customer[]>(async () => {
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
  });
}