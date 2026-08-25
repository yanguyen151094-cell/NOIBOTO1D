export type Role = "admin" | "staff";

export type PresenceStatus = "online" | "busy" | "away" | "offline";

export type ChannelPlatform = "facebook" | "telegram" | "tiktok";

export type ChannelStatus = "connected" | "disconnected" | "pending";

export type ConversationStatus =
  | "unread"
  | "unanswered"
  | "processing"
  | "answered"
  | "completed";

export type MessageStatus = "sending" | "sent" | "failed";

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  active: boolean;
  presence: PresenceStatus;
  lastActive: string;
  avatar: string;
  assignedChannelIds: string[];
  customersHandled: number;
  messagesReplied: number;
  avgResponseMinutes: number;
}

export interface Channel {
  id: string;
  name: string;
  platform: ChannelPlatform;
  avatar: string;
  status: ChannelStatus;
  lastSync: string;
  unread: number;
  tokenStatus: "active" | "expired" | "pending";
  externalId?: string;
  ownerId?: string;
}

export interface Customer {
  id: string;
  name: string;
  avatar: string;
  platform: ChannelPlatform;
  externalId: string;
  username: string;
  phone?: string;
  tags: string[];
  firstContactAt: string;
  lastInteractionAt: string;
  internalNote?: string;
}

export interface Assignment {
  staffId: string;
  staffName: string;
  assignedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: "customer" | "staff";
  senderName?: string;
  staffId?: string;
  content: string;
  sentAt: string;
  status: MessageStatus;
  type: "text" | "image" | "file" | "video";
  attachmentUrl?: string;
}

export interface Conversation {
  id: string;
  channelId: string;
  customerId: string;
  status: ConversationStatus;
  assignedStaffId?: string;
  lastMessage: string;
  lastMessageAt: string;
  waitMinutes: number;
  assignments: Assignment[];
  unreadCount: number;
  customerTyping?: boolean;
}

export interface ActivityLog {
  id: string;
  actorName: string;
  actorRole: Role;
  action: string;
  detail: string;
  at: string;
  ip: string;
  device: string;
  category: "auth" | "message" | "note" | "assign" | "permission" | "channel" | "system";
}

export interface ConversationView extends Conversation {
  customer: Customer;
  channel: Channel;
}

export interface TeamRoom {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  memberIds: string[];
}

export interface TeamMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: string;
}

export type VaultPlatform = "facebook" | "tiktok" | "telegram";

export interface CustomerNote {
  id: string;
  customerId: string;
  isRegistered: boolean;
  accountName: string;
  contactInfo: string;
  totalDeposit: number;
  totalBet: number;
  note: string;
  updatedAt: string;
  updatedByName?: string;
}

export interface AccountVault {
  id: string;
  platform: VaultPlatform;
  label: string;
  username: string;
  password: string;
  email: string;
  twoFa: string;
  note: string;
  createdAt: string;
  createdByName?: string;
  isDead: boolean;
}

export interface StaffEvaluation {
  id: string;
  staffId: string;
  staffName: string;
  evaluatorName: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface CustomerAccount {
  id: string;
  customerName: string;
  registrationDate?: string;
  lastDepositDate?: string;
  totalDeposit: number;
  totalBet: number;
  meetsTarget: boolean;
  contactInfo: string;
  note: string;
  createdAt: string;
  createdByName?: string;
}

export interface StaffPost {
  id: string;
  staffId: string;
  staffName: string;
  staffAvatar: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  commentCount: number;
  likeCount: number;
  liked: boolean;
}

export interface StaffComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
}

export interface Plan {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface Reward {
  id: string;
  date: string;
  workName: string;
  accountNumber: string;
  bankName: string;
  recipientName: string;
  rewardContent: string;
  amount: number;
  createdAt: string;
}