import { useState } from "react";
import Avatar from "@/components/base/Avatar";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const LOGO_URL = "https://static.readdy.ai/image/b107d501ab31adf698875488b112872d/f98b9a4e8bfd5d380f0a97483bd53113.png";

export default function Settings() {
  const { currentUser } = useAuth();
  const isOffline = !!localStorage.getItem("offline_user");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [sound, setSound] = useState(() => localStorage.getItem("pref_sound") !== "false");
  const [browserNotif, setBrowserNotif] = useState(() => localStorage.getItem("pref_notif") !== "false");
  const [longWaitAlert, setLongWaitAlert] = useState(() => localStorage.getItem("pref_wait_alert") !== "false");

  const notify = (msg: string, type: "success" | "error" = "success") => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (!currentPw || !newPw || !confirmPw) {
      setPwError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    if (newPw.length < 6) {
      setPwError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Mật khẩu mới không khớp.");
      return;
    }

    if (isOffline) {
      setPwError("Đang dùng chế độ offline — không thể đổi mật khẩu. Vui lòng đăng nhập qua Supabase.");
      return;
    }

    setPwLoading(true);
    try {
      // Re-sign in to verify current password
      const email = `${currentUser?.username}@cskh.local`;
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
      if (signInErr) {
        setPwError("Mật khẩu hiện tại không đúng.");
        setPwLoading(false);
        return;
      }
      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      if (updateErr) {
        setPwError(updateErr.message);
        setPwLoading(false);
        return;
      }
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      notify("Đã đổi mật khẩu thành công!");
    } catch {
      setPwError("Đổi mật khẩu thất bại. Vui lòng thử lại.");
    } finally {
      setPwLoading(false);
    }
  };

  const handleToggleSound = (v: boolean) => {
    setSound(v);
    localStorage.setItem("pref_sound", String(v));
  };

  const handleToggleBrowserNotif = async (v: boolean) => {
    setBrowserNotif(v);
    localStorage.setItem("pref_notif", String(v));
    if (v && "Notification" in window) {
      await Notification.requestPermission();
    }
  };

  const handleToggleLongWait = (v: boolean) => {
    setLongWaitAlert(v);
    localStorage.setItem("pref_wait_alert", String(v));
  };

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <h2 className="font-heading text-xl font-bold text-foreground-950 mb-5">Cài đặt</h2>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Account */}
        <div className="bg-background-50 rounded-lg border border-background-200 p-5">
          <h3 className="font-heading font-semibold text-foreground-900 mb-4">Tài khoản</h3>
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-background-100">
            <Avatar name={currentUser?.name ?? "?"} size="lg" />
            <div>
              <p className="font-semibold text-foreground-900">{currentUser?.name}</p>
              <p className="text-sm text-foreground-500">@{currentUser?.username}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 mt-1.5 inline-flex items-center gap-1">
                <i className="ri-shield-check-line" />
                {currentUser?.role === "admin" ? "Ghe OBICARE" : "Nhân viên"}
              </span>
            </div>
          </div>

          {isOffline && (
            <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
              <i className="ri-wifi-off-line shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Chế độ offline</p>
                <p className="text-xs mt-0.5 text-amber-700">
                  Bạn đang dùng chế độ offline. Đổi mật khẩu cần đăng nhập qua Supabase.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={changePassword} className="space-y-3">
            <p className="text-sm font-semibold text-foreground-800">Đổi mật khẩu</p>
            <PasswordInput label="Mật khẩu hiện tại" value={currentPw} onChange={setCurrentPw} />
            <PasswordInput label="Mật khẩu mới (ít nhất 6 ký tự)" value={newPw} onChange={setNewPw} />
            <PasswordInput label="Xác nhận mật khẩu mới" value={confirmPw} onChange={setConfirmPw} />
            {pwError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-200/50 text-red-500 text-sm">
                <i className="ri-error-warning-line shrink-0" />
                <span>{pwError}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={pwLoading || isOffline}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap disabled:opacity-50 transition-colors"
            >
              {pwLoading ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <i className="ri-lock-password-line" />
                  Lưu mật khẩu
                </>
              )}
            </button>
          </form>
        </div>

        {/* Notifications */}
        <div className="space-y-4">
          <div className="bg-background-50 rounded-lg border border-background-200 p-5">
            <h3 className="font-heading font-semibold text-foreground-900 mb-1">Thông báo</h3>
            <p className="text-xs text-foreground-500 mb-4">Cấu hình cách hệ thống thông báo cho bạn.</p>
            <div className="space-y-1">
              <Toggle
                label="Âm thanh khi có tin nhắn mới"
                desc="Phát âm thanh nhẹ khi khách gửi tin nhắn."
                icon="ri-volume-up-line"
                value={sound}
                onChange={handleToggleSound}
              />
              <Toggle
                label="Thông báo trình duyệt"
                desc="Hiện popup khi có tin nhắn mới (cần cấp quyền)."
                icon="ri-notification-3-line"
                value={browserNotif}
                onChange={handleToggleBrowserNotif}
              />
              <Toggle
                label="Cảnh báo khách chờ lâu"
                desc="Nhắc khi khách chờ quá thời gian quy định."
                icon="ri-timer-flash-line"
                value={longWaitAlert}
                onChange={handleToggleLongWait}
              />
            </div>
          </div>

          {/* App info */}
          <div className="bg-background-50 rounded-lg border border-background-200 p-5">
            <h3 className="font-heading font-semibold text-foreground-900 mb-4">Thông tin ứng dụng</h3>
            <div className="flex items-center gap-3 mb-4">
              <img src={LOGO_URL} alt="TỔ 1D" className="w-12 h-12 rounded-lg object-cover" />
              <div>
                <p className="font-semibold text-foreground-900">TỔ 1D</p>
                <p className="text-xs text-foreground-500">Hệ thống chăm sóc khách hàng đa kênh</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <InfoRow icon="ri-code-s-slash-line" label="Phiên bản" value="2.0.0" />
              <InfoRow icon="ri-database-2-line" label="Backend" value="SaaS Supabase" />
              <InfoRow
                icon="ri-global-line"
                label="Domain"
                value={window.location.hostname}
              />
              <InfoRow
                icon={isOffline ? "ri-wifi-off-line" : "ri-wifi-line"}
                label="Chế độ"
                value={isOffline ? "Offline (admin)" : "Online (Supabase Auth)"}
              />
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg shadow-sm animate-slide-up whitespace-nowrap ${
            toast.type === "success"
              ? "bg-foreground-950 text-background-50"
              : "bg-red-600 text-white"
          }`}
        >
          <i className={toast.type === "success" ? "ri-check-line text-emerald-400" : "ri-error-warning-line"} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm text-foreground-700 mb-1.5">{label}</label>
      <div className="relative">
        <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="w-full pl-9 pr-9 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 hover:text-foreground-600 cursor-pointer"
        >
          <i className={show ? "ri-eye-off-line" : "ri-eye-line"} />
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  desc,
  icon,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  icon: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-background-100 last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-background-100 flex items-center justify-center shrink-0 mt-0.5">
          <i className={`${icon} text-foreground-500`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground-900">{label}</p>
          <p className="text-xs text-foreground-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
          value ? "bg-primary-500" : "bg-background-300"
        }`}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
            value ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-background-100 last:border-0">
      <i className={`${icon} text-foreground-400 w-4`} />
      <span className="text-foreground-500 flex-1">{label}</span>
      <span className="text-foreground-700 font-medium">{value}</span>
    </div>
  );
}