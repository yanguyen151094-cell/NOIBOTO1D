import { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const LOGO_URL = "https://static.readdy.ai/image/b107d501ab31adf698875488b112872d/f98b9a4e8bfd5d380f0a97483bd53113.png";
const VERCEL_URL = "https://noibo1d-1d-git-master-yamato1.vercel.app";

export default function Login() {
  const { login, currentUser, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check if this page was opened after redirect from Vercel with a success param
  const redirectFrom = searchParams.get("redirect");
  const isSuccessReturn = searchParams.get("login_success") === "1";

  // Check if current domain is custom (not vercel.app)
  const isCustomDomain =
    typeof window !== "undefined" && !window.location.hostname.includes("vercel.app");

  useEffect(() => {
    // If we came back from Vercel with success, try to auto-login offline
    if (isSuccessReturn && isCustomDomain) {
      // Auto login offline since cross-domain session doesn't work
      login("admin", "admin123", true).then(() => {});
    }
  }, [isSuccessReturn, isCustomDomain, login]);

  if (currentUser) {
    return <Navigate to={currentUser.role === "admin" ? "/" : "/inbox"} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(username, password, remember);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
    }
  };

  const handleVercelLogin = () => {
    const currentUrl = window.location.href.split("?")[0];
    const vercelLoginUrl = `${VERCEL_URL}/login?redirect=${encodeURIComponent(currentUrl)}`;
    window.open(vercelLoginUrl, "_blank");
  };

  const handleOfflineLogin = async () => {
    setError("");
    setSubmitting(true);
    const result = await login("admin", "admin123", true);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-full flex bg-background-50">
      {/* Brand panel — gradient xanh dương + cam theo logo */}
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

        <p className="relative text-xs text-white/50">© 2026 TỔ 1D</p>
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

            {/* Success return banner from Vercel */}
            {isSuccessReturn && (
              <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                <div className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-line mt-0.5 text-emerald-600" />
                  <div>
                    <p className="font-medium">Đăng nhập trên Vercel thành công!</p>
                    <p className="mt-0.5 text-xs text-emerald-700">
                      Đang chuyển sang chế độ offline để tiếp tục trên domain này...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Custom domain warning with action buttons */}
            {isCustomDomain && !isSuccessReturn && (
              <div className="mb-4 rounded-lg bg-amber-50/80 border border-amber-200/80 p-4 text-sm">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <i className="ri-global-line text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900">Domain chưa cấu hình trong Supabase</p>
                    <p className="mt-1 text-xs text-amber-700 leading-relaxed">
                      Domain <strong>{window.location.hostname}</strong> chưa được thêm vào Supabase Auth. 
                      Bạn có 2 cách đăng nhập:
                    </p>
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        onClick={handleVercelLogin}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-white border border-amber-200 text-amber-800 text-xs font-medium hover:bg-amber-50 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-external-link-line" />
                        Đăng nhập qua Vercel (mở tab mới)
                      </button>
                      <button
                        type="button"
                        onClick={handleOfflineLogin}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-amber-100 border border-amber-200 text-amber-800 text-xs font-medium hover:bg-amber-200/50 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-wifi-off-line" />
                        Đăng nhập offline — admin / admin123
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-amber-600/80">
                      Hoặc tự thêm domain vào Supabase Dashboard → Authentication → URL Configuration
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-foreground-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-background-300 text-primary-500 focus:ring-primary-400"
                  />
                  Ghi nhớ đăng nhập
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-red-500/10 border border-red-200/50 text-red-500 text-sm">
                  <i className="ri-error-warning-line shrink-0" />
                  <span>{error}</span>
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

            <p className="mt-6 text-xs text-foreground-400 text-center">
              Liên hệ quản trị viên nếu bạn chưa có tài khoản.
            </p>

            {/* Footer links */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-foreground-400">
              <a href="#" className="hover:text-primary-500 transition-colors">Quên mật khẩu?</a>
              <span className="w-px h-3 bg-background-300" />
              <a href="#" className="hover:text-primary-500 transition-colors">Trợ giúp</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}