import { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/feature/Sidebar";
import Topbar from "@/components/feature/Topbar";
import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/types";

const TITLES: Record<string, string> = {
  "/": "Tổng quan",
  "/inbox": "Hộp thư chung",
  "/team": "Phòng trò chuyện",
  "/customers": "Khách hàng",
  "/staff": "Quản lý nhân viên",
  "/channels": "Kết nối kênh",
  "/reports": "Báo cáo",
  "/logs": "Nhật ký hoạt động",
  "/settings": "Cài đặt",
  "/customer-notes": "Ghi chú khách hàng",
  "/accounts": "Kho tài khoản",
  "/evaluations": "Đánh giá",
};

export default function AppLayout() {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pushToast, setPushToast] = useState<AppNotification | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel("realtime-push-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const n = payload.new as Record<string, unknown>;
          setPushToast({
            id: n.id as string,
            type: n.type as string,
            title: n.title as string,
            content: n.content as string,
            isRead: (n.is_read as boolean) ?? false,
            createdAt: n.created_at as string,
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!pushToast) return;
    const t = setTimeout(() => setPushToast(null), 5000);
    return () => clearTimeout(t);
  }, [pushToast]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background-50">
        <div className="flex flex-col items-center gap-3 text-foreground-500">
          <i className="ri-loader-4-line text-3xl animate-spin" />
          <p className="text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const title = TITLES[location.pathname] ?? "TỔ 1D";

  return (
    <div className="h-full flex bg-background-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-background-50 border-r border-background-200">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-background-50 animate-fade-in">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      {pushToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-background-50 rounded-lg border border-background-200 p-4 shadow-sm animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
              <i className="ri-notification-3-line text-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground-900">{pushToast.title}</p>
              <p className="text-sm text-foreground-600 mt-0.5 break-words">{pushToast.content}</p>
            </div>
            <button
              type="button"
              onClick={() => setPushToast(null)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-foreground-400 hover:bg-background-100 cursor-pointer shrink-0"
              aria-label="Đóng"
            >
              <i className="ri-close-line" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}