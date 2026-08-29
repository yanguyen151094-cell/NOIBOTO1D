import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStaff } from "@/hooks/useOnlineStaff";
import Avatar from "@/components/base/Avatar";
import { supabase } from "@/lib/supabase";
import { updatePresence, markNotificationRead, markAllNotificationsRead } from "@/lib/actions";
import { mapNotification } from "@/lib/mappers";
import { presenceMeta, formatRelative } from "@/utils/ui";
import type { AppNotification, PresenceStatus } from "@/types";

interface TopbarProps {
  title: string;
  onMenuClick: () => void;
}

const LOGO_URL = "https://static.readdy.ai/image/b107d501ab31adf698875488b112872d/f98b9a4e8bfd5d380f0a97483bd53113.png";

export default function Topbar({ title, onMenuClick }: TopbarProps) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { users: onlineUsers } = useOnlineStaff();
  const [menuOpen, setMenuOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const isAdmin = currentUser?.role === "admin";
  const [presence, setPresence] = useState<PresenceStatus>("online");

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (!error && active) {
        setNotifications((data ?? []).map(mapNotification));
      }
    };
    load();
    const channel = supabase
      .channel("topbar-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        load
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const changePresence = async (p: PresenceStatus) => {
    setPresence(p);
    setPresenceOpen(false);
    try {
      await updatePresence(p);
    } catch {
      // ignore
    }
  };

  const onlineCount = onlineUsers.filter((u) => u.presence === "online" || u.presence === "busy").length;

  return (
    <header className="h-16 flex items-center justify-between gap-3 px-4 md:px-6 bg-background-50 border-b border-background-200">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-foreground-700 hover:bg-background-100 cursor-pointer"
          aria-label="Mở menu"
        >
          <i className="ri-menu-line text-xl" />
        </button>
        <img src={LOGO_URL} alt="TỔ 1D" className="md:hidden w-8 h-8 rounded-md object-cover" />
        <h1 className="font-heading text-lg font-bold text-foreground-950 truncate whitespace-nowrap">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Online staff */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOnlineOpen((v) => !v)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-100 hover:bg-background-200 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-foreground-700 whitespace-nowrap">
              {onlineCount} đang online
            </span>
            <i className="ri-arrow-down-s-line text-foreground-500" />
          </button>
          {onlineOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-background-50 rounded-lg border border-background-200 shadow-sm py-1 z-30 animate-fade-in max-h-72 overflow-y-auto cs-scroll">
              <p className="px-3 py-2 text-xs font-semibold text-foreground-500 border-b border-background-100">
                Nhân viên đang online
              </p>
              {onlineUsers.length === 0 ? (
                <p className="px-3 py-4 text-xs text-foreground-400 text-center">Chưa có ai online</p>
              ) : (
                onlineUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-background-100">
                    <div className="relative">
                      <Avatar name={u.name} size="sm" />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background-50 ${
                          u.presence === "online"
                            ? "bg-emerald-500"
                            : u.presence === "busy"
                              ? "bg-red-500"
                              : u.presence === "away"
                                ? "bg-amber-500"
                                : "bg-foreground-300"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground-900 truncate">{u.name}</p>
                      <p className="text-[10px] text-foreground-500">
                        {u.presence === "online"
                          ? "Đang làm nhiệm vụ"
                          : u.presence === "busy"
                            ? "Đang bận"
                            : u.presence === "away"
                              ? "Tạm vắng"
                              : "Offline"}
                        {u.lastActive && ` · ${formatRelative(u.lastActive)}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-foreground-600 hover:bg-background-100 cursor-pointer"
            aria-label="Thông báo"
          >
            <i className="ri-notification-3-line text-xl" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="fixed top-16 left-3 right-3 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80 bg-background-50 rounded-lg border border-background-200 shadow-sm z-30 animate-fade-in overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-background-100">
                <p className="text-sm font-semibold text-foreground-900">Thông báo</p>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      markAllNotificationsRead().then(() => {
                        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                      });
                    }}
                    className="text-xs text-primary-700 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto cs-scroll">
                {notifications.length === 0 ? (
                  <p className="text-sm text-foreground-400 py-10 text-center">
                    Chưa có thông báo.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        markNotificationRead(n.id).then(() => {
                          setNotifications((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
                          );
                        });
                      }}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-background-100 cursor-pointer ${
                        n.isRead ? "bg-background-50" : "bg-accent-100/50"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center shrink-0 mt-0.5">
                        <i className="ri-star-fill" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground-900">{n.title}</p>
                        <p className="text-xs text-foreground-500 mt-0.5">{n.content}</p>
                        <p className="text-[11px] text-foreground-400 mt-1">
                          {formatRelative(n.createdAt)}
                        </p>
                      </div>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-accent-500 shrink-0 mt-1.5" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {!isAdmin && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPresenceOpen((v) => !v)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-100 hover:bg-background-200 cursor-pointer"
            >
              <span className={`w-2 h-2 rounded-full ${presenceMeta[presence].dot}`} />
              <span className="text-sm text-foreground-700 whitespace-nowrap">
                {presenceMeta[presence].label}
              </span>
              <i className="ri-arrow-down-s-line text-foreground-500" />
            </button>
            {presenceOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-background-50 rounded-lg border border-background-200 shadow-sm py-1 z-30 animate-fade-in">
                {(Object.keys(presenceMeta) as PresenceStatus[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changePresence(key)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground-700 hover:bg-background-100 cursor-pointer"
                  >
                    <span className={`w-2 h-2 rounded-full ${presenceMeta[key].dot}`} />
                    {presenceMeta[key].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-background-100 cursor-pointer"
          >
            <Avatar name={currentUser?.name || "?"} size="sm" online />
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-sm font-semibold text-foreground-900 whitespace-nowrap">
                {currentUser?.name}
              </p>
              <p className="text-[11px] text-foreground-500 whitespace-nowrap">
                {isAdmin ? "Tổ Trưởng ( OBICARE )" : "Nhân viên"}
              </p>
            </div>
            <i className="ri-arrow-down-s-line text-foreground-500 hidden sm:block" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-background-50 rounded-lg border border-background-200 shadow-sm py-1 z-30 animate-fade-in">
              <div className="px-4 py-2.5 border-b border-background-100">
                <p className="text-sm font-semibold text-foreground-900">{currentUser?.name}</p>
                <p className="text-[11px] text-foreground-500">
                  {isAdmin ? "Tổ Trưởng ( OBICARE )" : "Nhân viên"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { navigate("/settings"); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground-700 hover:bg-background-100 cursor-pointer"
              >
                <i className="ri-settings-3-line" />
                Cài đặt
              </button>
              <button
                type="button"
                onClick={() => { navigate("/wall"); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground-700 hover:bg-background-100 cursor-pointer"
              >
                <i className="ri-user-line" />
                Tường cá nhân
              </button>
              <div className="border-t border-background-100 mt-1 pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 cursor-pointer"
                >
                  <i className="ri-logout-box-r-line" />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}