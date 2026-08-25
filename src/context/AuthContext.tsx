import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, setPersistMode } from "@/lib/supabase";
import type { PresenceStatus, Role, User } from "@/types";

interface AuthContextValue {
  currentUser: User | null;
  loading: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<{ ok: boolean; message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EMAIL_DOMAIN = "cskh.local";

interface ProfileRow {
  id: string;
  name: string | null;
  username: string | null;
  role: Role;
  active: boolean;
  presence: PresenceStatus | null;
  last_active: string | null;
  avatar: string | null;
}

function mapProfile(profile: ProfileRow): User {
  return {
    id: profile.id,
    name: profile.name ?? "",
    username: profile.username ?? "",
    role: profile.role ?? "staff",
    active: profile.active ?? true,
    presence: profile.presence ?? "offline",
    lastActive: profile.last_active ?? "",
    avatar: profile.avatar ?? "",
    assignedChannelIds: [],
    customersHandled: 0,
    messagesReplied: 0,
    avgResponseMinutes: 0,
  };
}

async function loadUserWithAccess(profile: ProfileRow | null): Promise<User | null> {
  if (!profile || !profile.active) return null;
  const { data: access } = await supabase
    .from("channel_access")
    .select("channel_id")
    .eq("user_id", profile.id);
  const assignedChannelIds = (access ?? []).map((a: { channel_id: string }) => a.channel_id);
  return { ...mapProfile(profile), assignedChannelIds };
}

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Tên đăng nhập hoặc mật khẩu không đúng.";
  }
  if (lower.includes("email not confirmed")) {
    return "Tài khoản chưa được xác nhận. Vui lòng liên hệ quản trị viên.";
  }
  if (lower.includes("banned")) {
    return "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.";
  }
  if (lower.includes("rate limit")) {
    return "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.";
  }
  return "Đăng nhập thất bại. Vui lòng thử lại.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const userId = data.session?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()
        .then(async ({ data: profile }) => {
          if (!mounted) return;
          setCurrentUser(await loadUserWithAccess(profile as ProfileRow));
        })
        .catch(() => {
          if (mounted) setCurrentUser(null);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id;
      if (event === "SIGNED_OUT" || !userId) {
        setCurrentUser(null);
        return;
      }
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()
        .then(async ({ data: profile }) => {
          setCurrentUser(await loadUserWithAccess(profile as ProfileRow));
        })
        .catch(() => {});
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (username: string, password: string, remember: boolean) => {
    setPersistMode(remember ? "local" : "session");
    const email = `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, message: translateAuthError(error.message) };
    }

    const userId = data.user?.id;
    if (!userId) {
      return { ok: false, message: "Đăng nhập thất bại. Vui lòng thử lại." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      return { ok: false, message: "Không tìm thấy hồ sơ người dùng." };
    }

    if (!profile.active) {
      await supabase.auth.signOut();
      return { ok: false, message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." };
    }

    setCurrentUser(await loadUserWithAccess(profile as ProfileRow));

    await supabase
      .from("profiles")
      .update({ presence: "online", last_active: new Date().toISOString() })
      .eq("id", userId);

    return { ok: true, message: "" };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}