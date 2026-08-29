import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Tổng quan", icon: "ri-dashboard-line", adminOnly: true },
  { to: "/inbox", label: "Hộp thư", icon: "ri-mail-line" },
  { to: "/team", label: "Phòng trò chuyện", icon: "ri-chat-smile-2-line" },
  { to: "/karaoke", label: "Phòng hát", icon: "ri-mic-line" },
  { to: "/wall", label: "Tường cá nhân", icon: "ri-article-line" },
  { to: "/announcements", label: "Thông báo", icon: "ri-megaphone-line" },
  { to: "/plans", label: "Kế hoạch", icon: "ri-task-line" },
  { to: "/rewards", label: "Nhận thưởng", icon: "ri-coin-line" },
  { to: "/customers", label: "Khách hàng", icon: "ri-user-line" },
  { to: "/customer-notes", label: "Ghi chú khách", icon: "ri-sticky-note-line" },
  { to: "/accounts", label: "Kho tài khoản", icon: "ri-key-2-line" },
  { to: "/evaluations", label: "Đánh giá", icon: "ri-star-line" },
  { to: "/staff-stats", label: "Số liệu nhân viên", icon: "ri-bar-chart-grouped-line" },
  { to: "/staff-punishments", label: "Nhận phạt", icon: "ri-alarm-warning-line" },
  { to: "/staff", label: "Nhân viên", icon: "ri-team-line", adminOnly: true },
  { to: "/channels", label: "Kết nối kênh", icon: "ri-plug-line" },
  { to: "/reports", label: "Báo cáo", icon: "ri-bar-chart-line", adminOnly: true },
  { to: "/logs", label: "Nhật ký", icon: "ri-file-list-3-line", adminOnly: true },
  { to: "/settings", label: "Cài đặt", icon: "ri-settings-3-line" },
];

const LOGO_URL = "https://static.readdy.ai/image/b107d501ab31adf698875488b112872d/f98b9a4e8bfd5d380f0a97483bd53113.png";

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-background-200">
        <img src={LOGO_URL} alt="TỔ 1D" className="w-9 h-9 rounded-lg object-cover shrink-0" />
        <div className="leading-tight">
          <p className="font-heading font-bold text-foreground-950 text-[15px] whitespace-nowrap">
            TỔ 1D
          </p>
          <p className="text-[11px] text-foreground-500 whitespace-nowrap">
            Chăm sóc khách hàng đa kênh
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto cs-scroll py-3 px-3">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-primary-500 text-white"
                      : "text-foreground-700 hover:bg-background-100"
                  }`
                }
              >
                <i className={`${item.icon} text-base w-5 flex items-center justify-center`} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-3 border-t border-background-200">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-background-100">
          <i className="ri-database-2-line text-foreground-500" />
          <p className="text-[11px] text-foreground-500 leading-snug">
            Dữ liệu được lưu trên <span className="font-semibold">Supabase</span>
          </p>
        </div>
      </div>
    </div>
  );
}