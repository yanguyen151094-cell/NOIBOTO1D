import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://defffgyrdexrydrfnura.supabase.co";
const supabaseAnonKey = "sb_publishable_UMuOwwpDwOZKrwWOSFJjvQ_tBoWq9eK";

const REMEMBER_KEY = "cskh_remember";

let persistMode: "local" | "session" =
  typeof window !== "undefined" && localStorage.getItem(REMEMBER_KEY) === "0"
    ? "session"
    : "local";

function currentStore(): Storage {
  return persistMode === "local" ? localStorage : sessionStorage;
}

export function setPersistMode(mode: "local" | "session") {
  persistMode = mode;
  try {
    localStorage.setItem(REMEMBER_KEY, mode === "local" ? "1" : "0");
  } catch {
    // ignore storage errors
  }
}

const storageAdapter = {
  getItem: (key: string) => currentStore().getItem(key),
  setItem: (key: string, value: string) => currentStore().setItem(key, value),
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    flowType: "pkce",
    detectSessionInUrl: false,
    storage: storageAdapter,
  },
});