import type {
  AccountVault,
  ActivityLog,
  Announcement,
  AnnouncementComment,
  AppNotification,
  Assignment,
  Channel,
  ChannelPlatform,
  ChannelStatus,
  Conversation,
  ConversationStatus,
  Customer,
  CustomerAccount,
  CustomerNote,
  KaraokeMessage,
  KaraokeRoom,
  KaraokeSong,
  Message,
  MessageStatus,
  Plan,
  PresenceStatus,
  Reward,
  Role,
  StaffComment,
  StaffDailyStat,
  StaffEvaluation,
  StaffPost,
  StaffPunishment,
  Report,
  User,
  VaultPlatform,
} from "@/types";

export function mapChannel(row: Record<string, unknown>): Channel {
  const status = (row.status as ChannelStatus) ?? "disconnected";
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    platform: (row.platform as ChannelPlatform) ?? "facebook",
    avatar: (row.avatar as string) ?? "",
    status,
    lastSync: (row.last_sync as string) ?? "",
    unread: 0,
    tokenStatus: status === "connected" ? "active" : status === "pending" ? "pending" : "expired",
    externalId: (row.external_id as string) ?? undefined,
    ownerId: (row.owner_id as string) ?? undefined,
  };
}

export function mapCustomer(row: Record<string, unknown>, tags: string[] = []): Customer {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    avatar: (row.avatar as string) ?? "",
    platform: (row.platform as ChannelPlatform) ?? "facebook",
    externalId: (row.external_id as string) ?? "",
    username: (row.username as string) ?? "",
    phone: (row.phone as string) ?? undefined,
    tags,
    firstContactAt: (row.first_contact_at as string) ?? (row.created_at as string),
    lastInteractionAt: (row.last_interaction_at as string) ?? (row.created_at as string),
  };
}

export function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    sender: row.sender as Message["sender"],
    senderName: (row.sender_name as string) ?? undefined,
    staffId: (row.staff_id as string) ?? undefined,
    content: (row.content as string) ?? "",
    sentAt: row.sent_at as string,
    status: (row.status as MessageStatus) ?? "sent",
    type: (row.type as Message["type"]) ?? "text",
    attachmentUrl: (row.attachment_url as string) ?? undefined,
  };
}

export function mapAssignment(row: Record<string, unknown>): Assignment {
  return {
    staffId: row.staff_id as string,
    staffName: (row.staff_name as string) ?? "",
    assignedAt: row.assigned_at as string,
  };
}

export function computeWaitMinutes(status: ConversationStatus, lastMessageAt: string): number {
  if (status !== "unanswered" && status !== "unread") return 0;
  if (!lastMessageAt) return 0;
  const diff = Date.now() - new Date(lastMessageAt).getTime();
  return Math.max(0, Math.floor(diff / 60000));
}

export function mapConversation(
  row: Record<string, unknown>,
  assignments: Assignment[] = []
): Conversation {
  const status = (row.status as ConversationStatus) ?? "unread";
  const lastMessageAt = (row.last_message_at as string) ?? (row.updated_at as string) ?? "";
  return {
    id: row.id as string,
    channelId: row.channel_id as string,
    customerId: row.customer_id as string,
    status,
    assignedStaffId: (row.assigned_staff_id as string) ?? undefined,
    lastMessage: (row.last_message as string) ?? "",
    lastMessageAt,
    waitMinutes: computeWaitMinutes(status, lastMessageAt),
    assignments,
    unreadCount: status === "unread" ? 1 : 0,
    customerTyping: false,
  };
}

export function mapUser(
  row: Record<string, unknown>,
  assignedChannelIds: string[] = [],
  stats?: { customersHandled: number; messagesReplied: number; avgResponseMinutes: number }
): User {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    username: (row.username as string) ?? "",
    role: (row.role as Role) ?? "staff",
    active: (row.active as boolean) ?? true,
    presence: (row.presence as PresenceStatus) ?? "offline",
    lastActive: (row.last_active as string) ?? "",
    avatar: (row.avatar as string) ?? "",
    assignedChannelIds,
    customersHandled: stats?.customersHandled ?? 0,
    messagesReplied: stats?.messagesReplied ?? 0,
    avgResponseMinutes: stats?.avgResponseMinutes ?? 0,
  };
}

export function mapActivityLog(row: Record<string, unknown>): ActivityLog {
  return {
    id: row.id as string,
    actorName: (row.actor_name as string) ?? "Hệ thống",
    actorRole: ((row.actor_role as Role) ?? "staff") as Role,
    action: (row.action as string) ?? "",
    detail: (row.detail as string) ?? "",
    at: (row.created_at as string) ?? "",
    ip: (row.ip as string) ?? "",
    device: (row.device as string) ?? "",
    category: (row.category as ActivityLog["category"]) ?? "system",
  };
}

export function mapCustomerNote(row: Record<string, unknown>): CustomerNote {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    isRegistered: (row.is_registered as boolean) ?? false,
    accountName: (row.account_name as string) ?? "",
    contactInfo: (row.contact_info as string) ?? "",
    totalDeposit: Number(row.total_deposit ?? 0),
    totalBet: Number(row.total_bet ?? 0),
    note: (row.note as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
    updatedByName: (row.updated_by_name as string) ?? undefined,
    ownerId: (row.owner_id as string) ?? undefined,
  };
}

export function mapCustomerAccount(row: Record<string, unknown>): CustomerAccount {
  return {
    id: row.id as string,
    customerName: (row.customer_name as string) ?? "",
    registrationDate: (row.registration_date as string) ?? undefined,
    lastDepositDate: (row.last_deposit_date as string) ?? undefined,
    totalDeposit: Number(row.total_deposit ?? 0),
    totalBet: Number(row.total_bet ?? 0),
    meetsTarget: (row.meets_target as boolean) ?? false,
    contactInfo: (row.contact_info as string) ?? "",
    note: (row.note as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
    createdByName: (row.created_by_name as string) ?? undefined,
  };
}

export function mapAccountVault(row: Record<string, unknown>): AccountVault {
  return {
    id: row.id as string,
    platform: (row.platform as VaultPlatform) ?? "facebook",
    label: (row.label as string) ?? "",
    username: (row.username as string) ?? "",
    password: (row.password as string) ?? "",
    email: (row.email as string) ?? "",
    twoFa: (row.two_fa as string) ?? "",
    note: (row.note as string) ?? "",
    value: Number(row.value ?? 0),
    createdAt: (row.created_at as string) ?? "",
    createdByName: (row.created_by_name as string) ?? undefined,
    isDead: (row.is_dead as boolean) ?? false,
    providedByLeader: (row.provided_by_leader as boolean) ?? false,
    channelStatus: (row.channel_status as string) ?? "normal",
    ownerId: (row.owner_id as string) ?? undefined,
  };
}

export function mapNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    type: (row.type as string) ?? "evaluation",
    title: (row.title as string) ?? "",
    content: (row.content as string) ?? "",
    isRead: (row.is_read as boolean) ?? false,
    createdAt: (row.created_at as string) ?? "",
  };
}

export function mapStaffPost(row: Record<string, unknown>): StaffPost {
  return {
    id: row.id as string,
    staffId: row.staff_id as string,
    authorId: (row.author_id as string) ?? (row.staff_id as string),
    authorName: (row.author_name as string) ?? (row.staff_name as string) ?? "",
    authorAvatar: (row.author_avatar as string) ?? (row.staff_avatar as string) ?? "",
    content: (row.content as string) ?? "",
    imageUrl: (row.image_url as string) ?? undefined,
    createdAt: (row.created_at as string) ?? "",
    commentCount: Number(row.comment_count ?? 0),
    likeCount: Number(row.like_count ?? 0),
    liked: (row.liked as boolean) ?? false,
  };
}

export function mapStaffComment(row: Record<string, unknown>): StaffComment {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    authorId: row.author_id as string,
    authorName: (row.author_name as string) ?? "",
    authorAvatar: (row.author_avatar as string) ?? "",
    content: (row.content as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
  };
}

export function mapStaffEvaluation(row: Record<string, unknown>): StaffEvaluation {
  return {
    id: row.id as string,
    staffId: row.staff_id as string,
    staffName: (row.staff_name as string) ?? "",
    evaluatorName: (row.evaluator_name as string) ?? "",
    rating: Number(row.rating ?? 0),
    title: (row.title as string) ?? "",
    comment: (row.comment as string) ?? "",
    imageUrl: (row.image_url as string) ?? undefined,
    createdAt: (row.created_at as string) ?? "",
  };
}

export function mapAnnouncementComment(row: Record<string, unknown>): AnnouncementComment {
  return {
    id: row.id as string,
    announcementId: row.announcement_id as string,
    authorId: row.author_id as string,
    authorName: (row.author_name as string) ?? "",
    content: (row.content as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
  };
}

export function mapAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: row.id as string,
    authorId: row.author_id as string,
    authorName: (row.author_name as string) ?? "Tổ Trưởng ( OBICARE )",
    title: (row.title as string) ?? "",
    content: (row.content as string) ?? "",
    imageUrl: (row.image_url as string) ?? undefined,
    createdAt: (row.created_at as string) ?? "",
    likeCount: Number(row.like_count ?? 0),
    liked: (row.liked as boolean) ?? false,
  };
}

export function mapPlan(row: Record<string, unknown>): Plan {
  return {
    id: row.id as string,
    authorId: row.author_id as string,
    authorName: (row.author_name as string) ?? "Tổ Trưởng ( OBICARE )",
    title: (row.title as string) ?? "",
    content: (row.content as string) ?? "",
    imageUrl: (row.image_url as string) ?? undefined,
    createdAt: (row.created_at as string) ?? "",
  };
}

export function mapReport(row: Record<string, unknown>): Report {
  return {
    id: row.id as string,
    authorId: row.author_id as string,
    authorName: (row.author_name as string) ?? "",
    title: (row.title as string) ?? "",
    content: (row.content as string) ?? "",
    imageUrl: (row.image_url as string) ?? undefined,
    createdAt: (row.created_at as string) ?? "",
  };
}

export function mapReward(row: Record<string, unknown>): Reward {
  return {
    id: row.id as string,
    date: (row.date as string) ?? "",
    workName: (row.work_name as string) ?? "",
    accountNumber: (row.account_number as string) ?? "",
    bankName: (row.bank_name as string) ?? "",
    recipientName: (row.recipient_name as string) ?? "",
    rewardContent: (row.reward_content as string) ?? "",
    amount: Number(row.amount ?? 0),
    createdAt: (row.created_at as string) ?? "",
  };
}

export function mapKaraokeRoom(
  row: Record<string, unknown>,
  memberIds: string[] = []
): KaraokeRoom {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    createdBy: (row.created_by as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
    memberIds,
    currentVideoId: (row.current_video_id as string) ?? undefined,
    currentTitle: (row.current_title as string) ?? undefined,
    currentThumb: (row.current_thumb as string) ?? undefined,
    currentPosition: Number(row.current_position ?? 0),
    isPlaying: (row.is_playing as boolean) ?? false,
  };
}

export function mapKaraokeSong(row: Record<string, unknown>): KaraokeSong {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    videoId: (row.video_id as string) ?? "",
    title: (row.title as string) ?? "",
    thumbnail: (row.thumbnail as string) ?? undefined,
    addedBy: (row.added_by as string) ?? "",
    addedByName: (row.added_by_name as string) ?? "",
    status: ((row.status as KaraokeSong["status"]) ?? "queued") as KaraokeSong["status"],
    createdAt: (row.created_at as string) ?? "",
  };
}

export function mapKaraokeMessage(row: Record<string, unknown>): KaraokeMessage {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    senderId: row.sender_id as string,
    senderName: (row.sender_name as string) ?? "",
    content: (row.content as string) ?? "",
    sentAt: row.sent_at as string,
  };
}

export function mapStaffDailyStat(row: Record<string, unknown>): StaffDailyStat {
  return {
    id: row.id as string,
    staffId: row.staff_id as string,
    staffName: (row.staff_name as string) ?? "",
    date: (row.date as string) ?? "",
    newCustomers: Number(row.new_customers ?? 0),
    totalDeposits: Number(row.total_deposits ?? 0),
    totalBets: Number(row.total_bets ?? 0),
    createdAt: (row.created_at as string) ?? "",
  };
}

export function mapStaffPunishment(row: Record<string, unknown>): StaffPunishment {
  return {
    id: row.id as string,
    staffId: row.staff_id as string,
    staffName: (row.staff_name as string) ?? "",
    reason: (row.reason as string) ?? "",
    amount: Number(row.amount ?? 0),
    punishmentDate: (row.punishment_date as string) ?? "",
    createdByName: (row.created_by_name as string) ?? "",
    isRead: (row.is_read as boolean) ?? false,
    createdAt: (row.created_at as string) ?? "",
  };
}