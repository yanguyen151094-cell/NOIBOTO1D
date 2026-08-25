import { useState } from "react";
import Avatar from "@/components/base/Avatar";
import { useAuth } from "@/context/AuthContext";

export default function Settings() {
  const { currentUser } = useAuth();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [sound, setSound] = useState(true);
  const [browserNotif, setBrowserNotif] = useState(true);
  const [longWaitAlert, setLongWaitAlert] = useState(true);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const changePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!currentPw || !newPw || !confirmPw) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("Mật khẩu mới không khớp.");
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    notify("Đã đổi mật khẩu thành công.");
  };

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <h2 className="font-heading text-xl font-bold text-foreground-950 mb-5">Cài đặt</h2>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Account */}
        <div className="bg-background-50 rounded-lg border border-background-200 p-5">
          <h3 className="font-heading font-semibold text-foreground-900 mb-4">Tài khoản</h3>
          <div className="flex items-center gap-3 mb-5">
            <Avatar name={currentUser?.name ?? "?"} size="lg" />
            <div>
              <p className="font-medium text-foreground-900">{currentUser?.name}</p>
              <p className="text-sm text-foreground-500">@{currentUser?.username}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 mt-1 inline-block">
                {currentUser?.role === "admin" ? "Ghe OBICARE" : "Nhân viên"}
              </span>
            </div>
          </div>

          <form onSubmit={changePassword} className="space-y-3">
            <p className="text-sm font-medium text-foreground-700">Đổi mật khẩu</p>
            <Input
              label="Mật khẩu hiện tại"
              type="password"
              value={currentPw}
              onChange={setCurrentPw}
              placeholder="••••••••"
            />
            <Input
              label="Mật khẩu mới"
              type="password"
              value={newPw}
              onChange={setNewPw}
              placeholder="••••••••"
            />
            <Input
              label="Xác nhận mật khẩu mới"
              type="password"
              value={confirmPw}
              onChange={setConfirmPw}
              placeholder="••••••••"
            />
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 text-red-400 text-sm">
                <i className="ri-error-warning-line" />
                {error}
              </div>
            )}
            <button
              type="submit"
              className="px-4 py-2.5 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
            >
              Lưu mật khẩu
            </button>
          </form>
        </div>

        {/* Notifications */}
        <div className="bg-background-50 rounded-lg border border-background-200 p-5">
          <h3 className="font-heading font-semibold text-foreground-900 mb-4">Thông báo</h3>
          <div className="space-y-1">
            <Toggle
              label="Âm thanh khi có tin nhắn mới"
              desc="Phát âm thanh nhẹ khi khách gửi tin nhắn."
              value={sound}
              onChange={setSound}
            />
            <Toggle
              label="Thông báo trình duyệt"
              desc="Hiện thông báo khi có tin nhắn mới (nếu đã cấp quyền)."
              value={browserNotif}
              onChange={setBrowserNotif}
            />
            <Toggle
              label="Cảnh báo khách chờ lâu"
              desc="Nhắc khi khách chờ quá thời gian quy định."
              value={longWaitAlert}
              onChange={setLongWaitAlert}
            />
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-background-50 text-sm px-4 py-2.5 rounded-lg shadow-sm animate-slide-up">
          <i className="ri-check-line mr-1 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-foreground-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
    </div>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-background-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground-900">{label}</p>
        <p className="text-xs text-foreground-500 mt-0.5">{desc}</p>
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