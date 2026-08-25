import { supabase } from "@/lib/supabase";
import type { ChannelPlatform, ConversationStatus, PresenceStatus, VaultPlatform } from "@/types";

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;
  // Fallback for offline admin
  const offlineUser = localStorage.getItem("offline_user");
  if (offlineUser) {
    try {
      const parsed = JSON.parse(offlineUser);
      if (parsed?.id) return parsed.id;
    } catch {
      // ignore parse error
    }
  }
  throw new Error("Chưa đăng nhập.");
}

export async function sendMessage(
  conversationId: string,
  content: string,
  senderName: string,
  type: "text" | "image" | "file" = "text",
  attachmentUrl?: string
): Promise<void> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender: "staff",
    sender_name: senderName,
    staff_id: userId,
    content,
    type,
    status: "sent",
    sent_at: now,
    attachment_url: attachmentUrl ?? null,
  });
  if (error) throw error;
  await supabase
    .from("conversations")
    .update({ last_message: content, last_message_at: now, status: "answered" })
    .eq("id", conversationId);
}

export async function assignConversation(
  conversationId: string,
  staffId: string
): Promise<void> {
  const { error } = await supabase
    .from("conversation_assignments")
    .insert({ conversation_id: conversationId, staff_id: staffId, assigned_at: new Date().toISOString() });
  if (error) throw error;
  await supabase
    .from("conversations")
    .update({ assigned_staff_id: staffId, status: "processing" })
    .eq("id", conversationId);
}

export async function setConversationStatus(
  conversationId: string,
  status: ConversationStatus
): Promise<void> {
  const { error } = await supabase.from("conversations").update({ status }).eq("id", conversationId);
  if (error) throw error;
}

export async function addInternalNote(conversationId: string, content: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("internal_notes")
    .insert({ conversation_id: conversationId, author_id: userId, content });
  if (error) throw error;
}

export async function updatePresence(presence: PresenceStatus): Promise<void> {
  const userId = await requireUserId();
  await supabase
    .from("profiles")
    .update({ presence, last_active: new Date().toISOString() })
    .eq("id", userId);
}

interface ManageUsersPayload {
  action: "create_user" | "reset_password" | "set_active" | "revoke_sessions" | "delete_user";
  username?: string;
  name?: string;
  password?: string;
  role?: "admin" | "staff";
  channelIds?: string[];
  userId?: string;
  active?: boolean;
}

export async function callManageUsers(payload: ManageUsersPayload): Promise<{ ok?: boolean }> {
  const isOffline = !!localStorage.getItem("offline_user");
  const body = isOffline
    ? { ...payload, offlineAdmin: true, offlineSecret: "TO1D-2024-OFFLINE" }
    : payload;
  const { data, error } = await supabase.functions.invoke("manage-users", { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error as string);
  return data as { ok?: boolean };
}

export async function setStaffChannels(userId: string, channelIds: string[]): Promise<void> {
  const { error: delError } = await supabase.from("channel_access").delete().eq("user_id", userId);
  if (delError) throw delError;
  if (channelIds.length > 0) {
    const rows = channelIds.map((channel_id) => ({ user_id: userId, channel_id }));
    const { error: insError } = await supabase.from("channel_access").insert(rows);
    if (insError) throw insError;
  }
}

export async function transferStaffData(fromId: string, toId: string): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ assigned_staff_id: toId })
    .eq("assigned_staff_id", fromId);
  if (error) throw error;
}

export async function renameStaff(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ name }).eq("id", userId);
  if (error) throw error;
}

export async function createChannel(
  name: string,
  platform: ChannelPlatform,
  externalId?: string
): Promise<void> {
  const { error } = await supabase.from("channels").insert({
    name,
    platform,
    external_id: externalId ?? null,
    status: platform === "tiktok" ? "pending" : "connected",
  });
  if (error) throw error;
}

export async function deleteChannel(channelId: string): Promise<void> {
  const { error } = await supabase.from("channels").delete().eq("id", channelId);
  if (error) throw error;
}

export async function updateChannel(
  channelId: string,
  name: string,
  externalId?: string
): Promise<void> {
  const { error } = await supabase
    .from("channels")
    .update({ name, external_id: externalId ?? null })
    .eq("id", channelId);
  if (error) throw error;
}

export async function createTeamRoom(
  name: string,
  description: string,
  memberIds: string[]
): Promise<void> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("team_rooms")
    .insert({ name, description: description || null, created_by: userId })
    .select("id")
    .single();
  if (error) throw error;
  const roomId = data.id as string;
  const allMembers = Array.from(new Set([...memberIds, userId]));
  const rows = allMembers.map((user_id) => ({ room_id: roomId, user_id }));
  const { error: mErr } = await supabase.from("team_room_members").insert(rows);
  if (mErr) throw mErr;
}

export async function deleteTeamRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from("team_rooms").delete().eq("id", roomId);
  if (error) throw error;
}

export async function addTeamMembers(roomId: string, memberIds: string[]): Promise<void> {
  const rows = memberIds.map((user_id) => ({ room_id: roomId, user_id }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("team_room_members").insert(rows);
  if (error) throw error;
}

export async function sendTeamMessage(roomId: string, content: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("team_messages")
    .insert({ room_id: roomId, sender_id: userId, content, sent_at: new Date().toISOString() });
  if (error) throw error;
}

export interface CustomerNoteInput {
  isRegistered: boolean;
  accountName: string;
  contactInfo: string;
  totalDeposit: number;
  totalBet: number;
  note: string;
}

export async function upsertCustomerNote(
  customerId: string,
  input: CustomerNoteInput
): Promise<void> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const { error } = await supabase.from("customer_notes").upsert(
    {
      customer_id: customerId,
      is_registered: input.isRegistered,
      account_name: input.accountName,
      contact_info: input.contactInfo,
      total_deposit: input.totalDeposit,
      total_bet: input.totalBet,
      note: input.note,
      updated_by: userId,
      updated_at: now,
    },
    { onConflict: "customer_id" }
  );
  if (error) throw error;
}

export interface AccountVaultInput {
  platform: VaultPlatform;
  label: string;
  username: string;
  password: string;
  email: string;
  twoFa: string;
  note: string;
  isDead: boolean;
}

export async function createAccountVault(input: AccountVaultInput): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("account_vault").insert({
    platform: input.platform,
    label: input.label,
    username: input.username,
    password: input.password,
    email: input.email,
    two_fa: input.twoFa,
    note: input.note,
    is_dead: input.isDead,
    created_by: userId,
  });
  if (error) throw error;
}

export async function updateAccountVault(id: string, input: AccountVaultInput): Promise<void> {
  const { error } = await supabase
    .from("account_vault")
    .update({
      platform: input.platform,
      label: input.label,
      username: input.username,
      password: input.password,
      email: input.email,
      two_fa: input.twoFa,
      note: input.note,
      is_dead: input.isDead,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAccountVault(id: string): Promise<void> {
  const { error } = await supabase.from("account_vault").delete().eq("id", id);
  if (error) throw error;
}

export interface EvaluationInput {
  staffId: string;
  staffName: string;
  rating: number;
  title: string;
  comment: string;
}

export async function createEvaluation(input: EvaluationInput): Promise<void> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const { error: evalError } = await supabase.from("staff_evaluations").insert({
    staff_id: input.staffId,
    evaluator_id: userId,
    rating: input.rating,
    title: input.title,
    comment: input.comment,
    created_at: now,
  });
  if (evalError) throw evalError;

  const { error: ntfError } = await supabase.from("notifications").insert({
    user_id: input.staffId,
    type: "evaluation",
    title: "Bạn vừa nhận một đánh giá mới",
    content: `Điểm ${input.rating}/5 — ${input.title || "Không tiêu đề"}`,
    created_at: now,
  });
  if (ntfError) throw ntfError;
}

export async function deleteEvaluation(id: string): Promise<void> {
  const { error } = await supabase.from("staff_evaluations").delete().eq("id", id);
  if (error) throw error;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export interface CustomerAccountInput {
  customerName: string;
  registrationDate?: string;
  lastDepositDate?: string;
  totalDeposit: number;
  totalBet: number;
  meetsTarget: boolean;
  contactInfo: string;
  note: string;
}

export async function createCustomerAccount(input: CustomerAccountInput): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("customer_accounts").insert({
    customer_name: input.customerName,
    registration_date: input.registrationDate || null,
    last_deposit_date: input.lastDepositDate || null,
    total_deposit: input.totalDeposit,
    total_bet: input.totalBet,
    meets_target: input.meetsTarget,
    contact_info: input.contactInfo,
    note: input.note,
    created_by: userId,
  });
  if (error) throw error;
}

export async function updateCustomerAccount(id: string, input: CustomerAccountInput): Promise<void> {
  const { error } = await supabase
    .from("customer_accounts")
    .update({
      customer_name: input.customerName,
      registration_date: input.registrationDate || null,
      last_deposit_date: input.lastDepositDate || null,
      total_deposit: input.totalDeposit,
      total_bet: input.totalBet,
      meets_target: input.meetsTarget,
      contact_info: input.contactInfo,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCustomerAccount(id: string): Promise<void> {
  const { error } = await supabase.from("customer_accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function createStaffPost(content: string, imageUrl?: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("staff_posts").insert({
    staff_id: userId,
    content,
    image_url: imageUrl ?? null,
  });
  if (error) throw error;
}

export async function deleteStaffPost(id: string): Promise<void> {
  const { error } = await supabase.from("staff_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function createStaffComment(postId: string, content: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("staff_comments").insert({
    post_id: postId,
    author_id: userId,
    content,
  });
  if (error) throw error;

  // Thông báo realtime cho chủ bài viết (nếu không phải tự bình luận bài mình)
  const { data: post } = await supabase
    .from("staff_posts")
    .select("staff_id")
    .eq("id", postId)
    .maybeSingle();
  const ownerId = post?.staff_id as string | undefined;
  if (ownerId && ownerId !== userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    const name = profile?.name ?? "Một thành viên";
    const { error: ntfError } = await supabase.from("notifications").insert({
      user_id: ownerId,
      type: "comment",
      title: `${name} đã bình luận bài viết của bạn`,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (ntfError) {
      // Không throw — bình luận vẫn thành công dù thông báo lỗi
      console.warn("Không thể tạo thông báo:", ntfError.message);
    }
  }
}

export async function toggleLikeStaffPost(postId: string, liked: boolean): Promise<void> {
  const userId = await requireUserId();
  if (liked) {
    const { error } = await supabase
      .from("staff_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("staff_post_likes").insert({
      post_id: postId,
      user_id: userId,
    });
    if (error) throw error;
  }
}

export async function deleteStaffComment(id: string): Promise<void> {
  const { error } = await supabase.from("staff_comments").delete().eq("id", id);
  if (error) throw error;
}

export async function updateProfileAvatar(avatarUrl: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("profiles").update({ avatar: avatarUrl }).eq("id", userId);
  if (error) throw error;
}

export async function createAnnouncement(title: string, content: string): Promise<void> {
  const userId = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  const authorName = profile?.name ?? "Ghe OBICARE";
  const { error } = await supabase.from("announcements").insert({
    author_id: userId,
    author_name: authorName,
    title,
    content,
  });
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleLikeAnnouncement(id: string, liked: boolean): Promise<void> {
  const userId = await requireUserId();
  if (liked) {
    const { error } = await supabase
      .from("announcement_likes")
      .delete()
      .eq("announcement_id", id)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("announcement_likes").insert({
      announcement_id: id,
      user_id: userId,
    });
    if (error) throw error;
  }
}

export async function createPlan(title: string, content: string): Promise<void> {
  const userId = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  const authorName = profile?.name ?? "Ghe OBICARE";
  const { error } = await supabase.from("plans").insert({
    author_id: userId,
    author_name: authorName,
    title,
    content,
  });
  if (error) throw error;
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
}

export interface RewardInput {
  date: string;
  workName: string;
  accountNumber: string;
  bankName: string;
  recipientName: string;
  rewardContent: string;
  amount: number;
}

export async function createReward(input: RewardInput): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("staff_rewards").insert({
    date: input.date,
    work_name: input.workName,
    account_number: input.accountNumber,
    bank_name: input.bankName,
    recipient_name: input.recipientName,
    reward_content: input.rewardContent,
    amount: input.amount,
    created_by: userId,
  });
  if (error) throw error;
}

export async function updateReward(id: string, input: RewardInput): Promise<void> {
  const { error } = await supabase
    .from("staff_rewards")
    .update({
      date: input.date,
      work_name: input.workName,
      account_number: input.accountNumber,
      bank_name: input.bankName,
      recipient_name: input.recipientName,
      reward_content: input.rewardContent,
      amount: input.amount,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReward(id: string): Promise<void> {
  const { error } = await supabase.from("staff_rewards").delete().eq("id", id);
  if (error) throw error;
}