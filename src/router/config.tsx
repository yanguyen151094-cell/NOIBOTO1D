import type { RouteObject } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/login/page";
import AppLayout from "@/components/feature/AppLayout";
import Dashboard from "@/pages/dashboard/page";
import Inbox from "@/pages/inbox/page";
import Customers from "@/pages/customers/page";
import Staff from "@/pages/staff/page";
import Channels from "@/pages/channels/page";
import Reports from "@/pages/reports/page";
import Logs from "@/pages/logs/page";
import Settings from "@/pages/settings/page";
import Team from "@/pages/team/page";
import CustomerNotes from "@/pages/customer-notes/page";
import Accounts from "@/pages/accounts/page";
import Evaluations from "@/pages/evaluations/page";
import Wall from "@/pages/wall/page";
import Announcements from "@/pages/announcements/page";
import Plans from "@/pages/plans/page";
import Rewards from "@/pages/rewards/page";
import Karaoke from "@/pages/karaoke/page";
import StaffStats from "@/pages/staff-stats/page";
import StaffPunishments from "@/pages/staff-punishments/page";
import Movies from "@/pages/movies/page";
import TeamStats from "@/pages/team-stats/page";
import StaffRanking from "@/pages/staff-ranking/page";

const routes: RouteObject[] = [
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "inbox", element: <Inbox /> },
      { path: "team", element: <Team /> },
      { path: "karaoke", element: <Karaoke /> },
      { path: "movies", element: <Movies /> },
      { path: "wall", element: <Wall /> },
      { path: "announcements", element: <Announcements /> },
      { path: "plans", element: <Plans /> },
      { path: "rewards", element: <Rewards /> },
      { path: "customers", element: <Customers /> },
      { path: "customer-notes", element: <CustomerNotes /> },
      { path: "accounts", element: <Accounts /> },
      { path: "evaluations", element: <Evaluations /> },
      { path: "staff-stats", element: <StaffStats /> },
      { path: "staff-ranking", element: <StaffRanking /> },
      { path: "team-stats", element: <TeamStats /> },
      { path: "staff-punishments", element: <StaffPunishments /> },
      { path: "staff", element: <Staff /> },
      { path: "channels", element: <Channels /> },
      { path: "reports", element: <Reports /> },
      { path: "logs", element: <Logs /> },
      { path: "settings", element: <Settings /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;