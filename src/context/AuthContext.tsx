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

// Offline admin credentials for emergency fallback
const OFFLINE_ADMIN = {
  username: "admin",
  password: "admin123",
  id: "3f4e19d1-016a-462f-ac80-a4488c5eff45",
  name: "Quản trị viên",
  role: "admin" as Role,
};

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
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("cors") || lower.includes("failed to fetch")) {
    return "Không thể kết nối đến máy chủ xác thực. Nếu bạn đang dùng domain tùy chỉnh, hãy thử đăng nhập offline với tài khoản admin / admin123.";
  }
  return "Đăng nhập thất bại. Vui lòng thử lại.";
}

function getOfflineAdminUser(): User {
  return {
    id: OFFLINE_ADMIN.id,
    name: OFFLINE_ADMIN.name,
    username: OFFLINE_ADMIN.username,
    role: OFFLINE_ADMIN.role,
    active: true,
    presence: "online",
    lastActive: new Date().toISOString(),
    avatar: "",
    assignedChannelIds: [],
    customersHandled: 0,
    messagesReplied: 0,
    avgResponseMinutes: 0,
  };
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
        // Check offline login
        const offlineUser = localStorage.getItem("offline_user");
        if (offlineUser) {
          try {
            const parsed = JSON.parse(offlineUser) as User;
            setCurrentUser(parsed);
          } catch {
            localStorage.removeItem("offline_user");
          }
        }
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

  const login = async (username: string, password: string, remember: boolean): Promise<{ ok: boolean; message: string }> => {
    setPersistMode(remember ? "local" : "session");
    const normalizedUsername = username.trim().toLowerCase();
    const email = `${normalizedUsername}@${EMAIL_DOMAIN}`;

    // Offline fallback check FIRST — if username/password match offline admin, always allow
    if (normalizedUsername === OFFLINE_ADMIN.username && password === OFFLINE_ADMIN.password) {
      console.warn("[Auth] Using offline admin login (domain bypass)");
      const offlineUser = getOfflineAdminUser();
      setCurrentUser(offlineUser);
      if (remember) {
        localStorage.setItem("offline_user", JSON.stringify(offlineUser));
      }
      return { ok: true, message: "" };
    }

    try {
      // Try Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error("[Auth] Supabase login error:", error.message, error);
        // If the user typed admin/admin123 but Supabase still errored (e.g. CORS/domain block), fallback
        if (normalizedUsername === OFFLINE_ADMIN.username && password === OFFLINE_ADMIN.password) {
          const offlineUser = getOfflineAdminUser();
          setCurrentUser(offlineUser);
          if (remember) {
            localStorage.setItem("offline_user", JSON.stringify(offlineUser));
          }
          return { ok: true, message: "" };
        }
        return { ok: false, message: translateAuthError(error.message) };
      }

      const userId = data.user?.id;
      if (!userId) {
        // Fallback for missing userId but no error (rare)
        if (normalizedUsername === OFFLINE_ADMIN.username && password === OFFLINE_ADMIN.password) {
          const offlineUser = getOfflineAdminUser();
          setCurrentUser(offlineUser);
          if (remember) {
            localStorage.setItem("offline_user", JSON.stringify(offlineUser));
          }
          return { ok: true, message: "" };
        }
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

      // Check if we should redirect back to a custom domain
      if (typeof window !== "undefined") {
        const redirectUrl = new URLSearchParams(window.location.search).get("redirect");
        if (redirectUrl && window.location.hostname.includes("vercel.app")) {
          // Redirect back to custom domain with success flag
          const separator = redirectUrl.includes("?") ? "&" : "?";
          window.location.href = `${redirectUrl}${separator}login_success=1`;
          return { ok: true, message: "" };
        }
      }

      return { ok: true, message: "" };
    } catch (err) {
      console.error("[Auth] Unexpected login error:", err);
      // If network/CORS error, fallback to offline admin if credentials match
      if (normalizedUsername === OFFLINE_ADMIN.username && password === OFFLINE_ADMIN.password) {
        const offlineUser = getOfflineAdminUser();
        setCurrentUser(offlineUser);
        if (remember) {
          localStorage.setItem("offline_user", JSON.stringify(offlineUser));
        }
        return { ok: true, message: "" };
      }
      return { ok: false, message: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng hoặc thử lại." };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("offline_user");
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