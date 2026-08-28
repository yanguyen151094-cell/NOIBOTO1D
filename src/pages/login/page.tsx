import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const LOGO_URL = "https://static.readdy.ai/image/b107d501ab31adf698875488b112872d/f98b9a4e8bfd5d380f0a97483bd53113.png";
const SUPABASE_URL = "https://defffgyrdexrydrfnura.supabase.co";

export default function Login() {
  const { login, currentUser, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [networkOk, setNetworkOk] = useState<boolean | null>(null);

  // Health check on mount
  useEffect(() => {
    checkNetwork();
  }, []);

  async function checkNetwork() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        method: "GET",
        signal: controller.signal,
        mode: "cors",
      }).catch(async () => {
        // Fallback: try HEAD request to base URL
        return fetch(SUPABASE_URL, {
          method: "HEAD",
          signal: controller.signal,
          mode: "cors",
        });
      });
      clearTimeout(timeout);
      setNetworkOk(res.ok || res.status === 404 || res.status === 401 || res.status === 400);
    } catch {
      setNetworkOk(false);
    }
  }

  if (currentUser) {
    return <Navigate to={currentUser.role === "admin" ? "/" : "/inbox"} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDebug("");
    setSubmitting(true);

    const trimmedUsername = username.trim().toLowerCase();

    // Admin login: auto-create if needed, then sign in with default password
    if (trimmedUsername === "admin") {
      const adminPassword = "admin123";

      // Step 1: try login directly
      setDebug("Đang đăng nhập...");
      let result = await login("admin", adminPassword, true);
      if (result.ok) {
        setSubmitting(false);
        return;
      }

      // If failed due to invalid credentials, try to auto-create admin
      if (result.message.includes("không đúng") || result.message.includes("thất bại") || result.message.includes("Không thể kết nối")) {
        setDebug("Đang tạo tài khoản admin tự động...");
        const signupResult = await tryCreateAdmin(adminPassword);
        if (signupResult.ok) {
          setDebug("Tạo xong, đang đăng nhập lại...");
          result = await login("admin", adminPassword, true);
          if (result.ok) {
            setSubmitting(false);
            return;
          }
        } else if (signupResult.message.includes("đã tồn tại")) {
          setDebug("Tài khoản đã tồn tại, đang thử đăng nhập lại...");
          result = await login("admin", adminPassword, true);
          if (result.ok) {
            setSubmitting(false);
            return;
          }
        } else {
          setDebug(`Tạo tài khoản thất bại: ${signupResult.message}`);
        }
      }

      setSubmitting(false);
      setError(result.message || "Đăng nhập thất bại.");
      return;
    }

    // Normal user login
    const result = await login(username.trim(), password, true);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-full flex bg-background-50">
      {/* Brand panel */}
      <div
        className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #0f2a4a 40%, #1a3a5c 70%, #0a1628 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 25%, rgba(255,140,0,0.25) 0, transparent 35%), radial-gradient(circle at 85% 75%, rgba(59,130,246,0.2) 0, transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-4">
          <img src={LOGO_URL} alt="TỔ 1D" className="w-16 h-16 rounded-xl object-cover shadow-lg" />
          <div>
            <p className="font-heading font-extrabold text-2xl tracking-wide text-white">TỔ 1D</p>
            <p className="text-sm text-white/70">Hệ thống chăm sóc khách hàng đa kênh</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-heading text-3xl font-bold leading-snug text-white">
            Mọi hội thoại khách hàng, gom về một nơi.
          </h2>
          <p className="mt-4 text-white/80 leading-relaxed">
            Đọc và trả lời tin nhắn từ Facebook, TikTok và nhiều kênh khác ngay trên một hộp thư
            duy nhất. Không giới hạn số lượng Page hay tài khoản.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-white/85">
            {[
              "Hộp thư chung đa kênh, cập nhật realtime",
              "Phân quyền chặt chẽ cho từng nhân viên",
              "Theo dõi thời gian phản hồi & báo cáo hiệu suất",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <i className="ri-checkbox-circle-fill text-accent-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">&copy; 2026 TỔ 1D</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-foreground-500">
            <i className="ri-loader-4-line text-3xl animate-spin" />
            <p className="text-sm">Đang kiểm tra phiên đăng nhập...</p>
          </div>
        ) : (
          <div className="w-full max-w-sm animate-slide-up">
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <img src={LOGO_URL} alt="TỔ 1D" className="w-12 h-12 rounded-lg object-cover" />
              <p className="font-heading font-bold text-xl text-foreground-950">TỔ 1D</p>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <img src={LOGO_URL} alt="TỔ 1D" className="hidden lg:block w-12 h-12 rounded-lg object-cover" />
              <div>
                <h1 className="font-heading text-2xl font-bold text-foreground-950">Đăng nhập</h1>
                <p className="mt-0.5 text-sm text-foreground-500">
                  Nhập tài khoản của bạn để tiếp tục.
                </p>
              </div>
            </div>

            {/* Network status indicator */}
            {networkOk === false && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-md bg-red-500/10 border border-red-200/50 text-red-600 text-xs">
                <i className="ri-wifi-off-line shrink-0" />
                <div>
                  <p className="font-medium">Không thể kết nối đến máy chủ.</p>
                  <p className="mt-0.5">
                    Vui lòng kiểm tra mạng hoặc thử đổi DNS sang 8.8.8.8 (Google) hoặc 1.1.1.1 (Cloudflare).
                  </p>
                </div>
              </div>
            )}
            {networkOk === true && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-200/50 text-emerald-600 text-xs">
                <i className="ri-wifi-line shrink-0" />
                <span>Kết nối máy chủ OK.</span>
              </div>
            )}
            {networkOk === null && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-md bg-foreground-100 border border-foreground-200 text-foreground-500 text-xs">
                <i className="ri-loader-2-line animate-spin shrink-0" />
                <span>Đang kiểm tra kết nối...</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <i className="ri-user-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" />
                  <input
                    type="text"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập"
                    autoComplete="username"
                    className="w-full pl-9 pr-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    autoComplete="current-password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 hover:text-foreground-600 cursor-pointer"
                    aria-label="Hiện mật khẩu"
                  >
                    <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-red-500/10 border border-red-200/50 text-red-500 text-sm">
                  <i className="ri-error-warning-line shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {debug && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-500/10 border border-blue-200/50 text-blue-600 text-xs">
                  <i className="ri-loader-4-line animate-spin shrink-0" />
                  <span>{debug}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-md bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="ri-loader-4-line animate-spin" />
                    Đang đăng nhập...
                  </span>
                ) : (
                  "Đăng nhập"
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

async function tryCreateAdmin(password: string): Promise<{ ok: boolean; message: string }> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = "https://defffgyrdexrydrfnura.supabase.co";
  const key = "sb_publishable_UMuOwwpDwOZKrwWOSFJjvQ_tBoWq9eK";
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Retry helper for transient network errors
  const retry = async <T,>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> => {
    let lastErr: unknown;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (i < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    throw lastErr;
  };

  try {
    const { data, error } = await retry(() =>
      supabase.auth.signUp({
        email: "admin@cskh.local",
        password,
        options: {
          data: { username: "admin", name: "Quản trị viên", role: "admin" },
        },
      })
    );

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("already exists") || error.message.includes("User already registered")) {
        return { ok: false, message: "Tài khoản đã tồn tại." };
      }
      return { ok: false, message: error.message };
    }

    const userId = data.user?.id;
    if (!userId) {
      return { ok: false, message: "Không tạo được tài khoản." };
    }

    // Insert profile
    const { error: profileErr } = await retry(() =>
      supabase.from("profiles").insert({
        id: userId,
        username: "admin",
        name: "Quản trị viên",
        role: "admin",
        active: true,
        presence: "offline",
        avatar: null,
      })
    );

    if (profileErr) {
      return { ok: false, message: `Tạo profile thất bại: ${profileErr.message}` };
    }

    return { ok: true, message: "Tạo tài khoản thành công." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Failed to fetch") || msg.includes("fetch") || msg.includes("network") || msg.includes("NAME_NOT_RESOLVED") || msg.includes("Offline") || msg.includes("AbortError")) {
      return { ok: false, message: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại." };
    }
    return { ok: false, message: `Lỗi không xác định: ${msg}` };
  }
}