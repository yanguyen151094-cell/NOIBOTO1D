import type { ChannelPlatform, ConversationStatus, PresenceStatus } from "@/types";

const AVATAR_COLORS = [
  "bg-primary-500",
  "bg-accent-500",
  "bg-secondary-600",
  "bg-primary-700",
  "bg-accent-600",
  "bg-secondary-500",
  "bg-primary-400",
  "bg-accent-400",
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export const platformMeta: Record<
  ChannelPlatform,
  { label: string; icon: string; color: string; bg: string }
> = {
  facebook: {
    label: "Facebook",
    icon: "ri-facebook-circle-fill",
    color: "text-[#1877F2]",
    bg: "bg-[#1877F2]/10",
  },
  telegram: {
    label: "Telegram",
    icon: "ri-telegram-fill",
    color: "text-[#26A5E4]",
    bg: "bg-[#26A5E4]/10",
  },
  tiktok: {
    label: "TikTok",
    icon: "ri-tiktok-fill",
    color: "text-foreground-900",
    bg: "bg-foreground-200/60",
  },
};

export const statusMeta: Record<
  ConversationStatus,
  { label: string; dot: string; pill: string }
> = {
  unread: {
    label: "Chưa đọc",
    dot: "bg-primary-500",
    pill: "bg-primary-100 text-primary-800",
  },
  unanswered: {
    label: "Chưa trả lời",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-800",
  },
  processing: {
    label: "Đang xử lý",
    dot: "bg-secondary-500",
    pill: "bg-secondary-100 text-secondary-800",
  },
  answered: {
    label: "Đã trả lời",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-800",
  },
  completed: {
    label: "Hoàn thành",
    dot: "bg-foreground-400",
    pill: "bg-foreground-200/70 text-foreground-700",
  },
};

export function waitColor(minutes: number): string {
  if (minutes < 5) return "text-emerald-600";
  if (minutes < 15) return "text-amber-600";
  if (minutes < 30) return "text-orange-600";
  return "text-red-600";
}

export function waitBadge(minutes: number): string {
  if (minutes < 5) return "bg-emerald-100 text-emerald-700";
  if (minutes < 15) return "bg-amber-100 text-amber-700";
  if (minutes < 30) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

export const presenceMeta: Record<PresenceStatus, { label: string; dot: string }> = {
  online: { label: "Đang online", dot: "bg-emerald-500" },
  busy: { label: "Bận", dot: "bg-amber-500" },
  away: { label: "Tạm nghỉ", dot: "bg-foreground-400" },
  offline: { label: "Offline", dot: "bg-foreground-300" },
};

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);
}