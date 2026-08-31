import { supabase } from "@/lib/supabase";
import type { ChannelPlatform, ConversationStatus, PresenceStatus, VaultPlatform } from "@/types";

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;
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
  const body = payload;
  const { data, error } = await supabase.functions.invoke("manage-users", { body });
  if (error) throw new Error(error.message);
  if (data?.ok === false || data?.error) {
    throw new Error(data.error as string || "Lỗi từ máy chủ.");
  }
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
      owner_id: userId,
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
  value: number;
  isDead: boolean;
  providedByLeader: boolean;
  channelStatus: string;
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
    value: input.value,
    is_dead: input.isDead,
    provided_by_leader: input.providedByLeader,
    channel_status: input.channelStatus,
    created_by: userId,
    owner_id: userId,
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
      value: input.value,
      is_dead: input.isDead,
      provided_by_leader: input.providedByLeader,
      channel_status: input.channelStatus,
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
  imageUrl?: string;
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
    image_url: input.imageUrl ?? null,
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

export async function createStaffPost(
  wallOwnerId: string,
  authorName: string,
  authorAvatar: string,
  content: string,
  imageUrl?: string
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("staff_posts").insert({
    staff_id: wallOwnerId,
    author_id: userId,
    author_name: authorName,
    author_avatar: authorAvatar,
    content,
    image_url: imageUrl ?? null,
  });
  if (error) throw error;

  if (wallOwnerId !== userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    const name = profile?.name ?? authorName;
    const { error: ntfError } = await supabase.from("notifications").insert({
      user_id: wallOwnerId,
      type: "comment",
      title: `${name} đã đăng bài lên tường của bạn`,
      content: content.slice(0, 200),
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (ntfError) {
      console.warn("Không thể tạo thông báo:", ntfError.message);
    }
  }
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

export async function createAnnouncement(title: string, content: string, imageUrl?: string): Promise<void> {
  const userId = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  const authorName = profile?.name ?? "Tổ Trưởng ( OBICARE )";
  const { error } = await supabase.from("announcements").insert({
    author_id: userId,
    author_name: authorName,
    title,
    content,
    image_url: imageUrl ?? null,
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

export async function createPlan(title: string, content: string, imageUrl?: string): Promise<void> {
  const userId = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  const authorName = profile?.name ?? "Tổ Trưởng ( OBICARE )";
  const { error } = await supabase.from("plans").insert({
    author_id: userId,
    author_name: authorName,
    title,
    content,
    image_url: imageUrl ?? null,
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
  staffId?: string;
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
    staff_id: input.staffId ?? null,
  });
  if (error) throw error;

  if (input.staffId) {
    const amountStr = input.amount.toLocaleString("vi-VN");
    const { error: ntfError } = await supabase.from("notifications").insert({
      user_id: input.staffId,
      type: "reward",
      title: "Chúc mừng bạn nhận thưởng! 🎉",
      content: `${input.workName} — ${amountStr}đ`,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (ntfError) console.warn("Không thể tạo thông báo thưởng:", ntfError.message);
  }
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

// ===== Karaoke =====

export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const m =
    trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
    trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/) ||
    trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/) ||
    trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export async function fetchYoutubeInfo(videoId: string): Promise<{ title: string; thumbnail: string }> {
  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) throw new Error("bad");
    const data = await res.json();
    return { title: data.title ?? `Bài hát ${videoId}`, thumbnail: thumb };
  } catch {
    return { title: `Bài hát ${videoId}`, thumbnail: thumb };
  }
}

export function checkVideoExists(videoId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg?nocache=${Date.now()}`;
    setTimeout(() => resolve(false), 5000);
  });
}

export async function createKaraokeRoom(name: string): Promise<string> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("karaoke_rooms")
    .insert({ name, created_by: userId })
    .select("id")
    .single();
  if (error) throw error;
  const roomId = data.id as string;
  const { error: mErr } = await supabase
    .from("karaoke_room_members")
    .insert({ room_id: roomId, user_id: userId });
  if (mErr) throw mErr;
  return roomId;
}

export async function deleteKaraokeRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from("karaoke_rooms").delete().eq("id", roomId);
  if (error) throw error;
}

export async function joinKaraokeRoom(roomId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("karaoke_room_members")
    .insert({ room_id: roomId, user_id: userId });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function addKaraokeSong(
  roomId: string,
  videoId: string,
  title: string,
  thumbnail: string
): Promise<void> {
  const userId = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  const { error } = await supabase.from("karaoke_queue").insert({
    room_id: roomId,
    video_id: videoId,
    title,
    thumbnail,
    added_by: userId,
    added_by_name: profile?.name ?? "",
    status: "queued",
  });
  if (error) throw error;
}

export async function removeKaraokeSong(songId: string): Promise<void> {
  const { error } = await supabase.from("karaoke_queue").delete().eq("id", songId);
  if (error) throw error;
}

export async function playKaraokeSong(
  roomId: string,
  song: { id: string; videoId: string; title: string; thumbnail?: string }
): Promise<void> {
  await supabase.from("karaoke_queue").update({ status: "played" }).eq("room_id", roomId).eq("status", "playing");
  const { error } = await supabase.from("karaoke_queue").update({ status: "playing" }).eq("id", song.id);
  if (error) throw error;
  const { error: rErr } = await supabase
    .from("karaoke_rooms")
    .update({
      current_video_id: song.videoId,
      current_title: song.title,
      current_thumb: song.thumbnail ?? null,
      current_position: 0,
      is_playing: true,
    })
    .eq("id", roomId);
  if (rErr) throw rErr;
}

export async function updateKaraokePlayState(
  roomId: string,
  isPlaying: boolean,
  position: number
): Promise<void> {
  const { error } = await supabase
    .from("karaoke_rooms")
    .update({ is_playing: isPlaying, current_position: position })
    .eq("id", roomId);
  if (error) throw error;
}

export async function createReport(title: string, content: string, imageUrl?: string): Promise<void> {
  const userId = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  const authorName = profile?.name ?? "";
  const { error } = await supabase.from("reports").insert({
    author_id: userId,
    author_name: authorName,
    title,
    content,
    image_url: imageUrl ?? null,
  });
  if (error) throw error;
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) throw error;
}

export async function createAnnouncementComment(announcementId: string, content: string): Promise<void> {
  const userId = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  const authorName = profile?.name ?? "";
  const { error } = await supabase.from("announcement_comments").insert({
    announcement_id: announcementId,
    author_id: userId,
    author_name: authorName,
    content,
  });
  if (error) throw error;
}

export async function deleteAnnouncementComment(id: string): Promise<void> {
  const { error } = await supabase.from("announcement_comments").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadImage(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("uploads").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("uploads").getPublicUrl(path);
  return data.publicUrl;
}

export async function sendKaraokeMessage(roomId: string, content: string, imageUrl?: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("karaoke_messages")
    .insert({
      room_id: roomId,
      sender_id: userId,
      content,
      image_url: imageUrl ?? null,
      sent_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function approveSongRequest(
  requestId: string,
  roomId: string
): Promise<void> {
  const { data: req } = await supabase
    .from("karaoke_song_requests")
    .select("video_id,title,thumbnail")
    .eq("id", requestId)
    .single();
  if (!req) throw new Error("Không tìm thấy yêu cầu.");
  await addKaraokeSong(roomId, req.video_id, req.title, req.thumbnail ?? "");
  await supabase.from("karaoke_song_requests").update({ status: "approved" }).eq("id", requestId);
}

export async function rejectSongRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from("karaoke_song_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);
  if (error) throw error;
}

export async function deleteSongRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from("karaoke_song_requests").delete().eq("id", requestId);
  if (error) throw error;
}

export async function createSongRequest(
  roomId: string,
  videoId: string,
  title: string,
  thumbnail: string
): Promise<void> {
  const userId = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  const { error } = await supabase.from("karaoke_song_requests").insert({
    room_id: roomId,
    video_id: videoId,
    title,
    thumbnail,
    requested_by: userId,
    requested_by_name: profile?.name ?? "",
    status: "pending",
  });
  if (error) throw error;
}

// ===== Team Daily Stats =====

export interface TeamDailyStatInput {
  date: string;
  newCustomers: number;
  totalMoneySent: number;
  totalDeposits: number;
  totalBets: number;
  registeredCustomers: number;
}

export async function upsertTeamDailyStat(input: TeamDailyStatInput): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("team_daily_stats").upsert(
    {
      date: input.date,
      new_customers: input.newCustomers,
      total_money_sent: input.totalMoneySent,
      total_deposits: input.totalDeposits,
      total_bets: input.totalBets,
      registered_customers: input.registeredCustomers,
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "date" }
  );
  if (error) throw error;
}

export async function deleteTeamDailyStat(id: string): Promise<void> {
  const { error } = await supabase.from("team_daily_stats").delete().eq("id", id);
  if (error) throw error;
}

// ===== Movies =====

export interface MovieInput {
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail?: string;
  category?: string;
}

export async function createMovie(input: MovieInput): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("movies").insert({
    title: input.title,
    description: input.description ?? null,
    video_url: input.videoUrl,
    thumbnail: input.thumbnail ?? null,
    category: input.category ?? null,
    created_by: userId,
  });
  if (error) throw error;
}

export async function updateMovie(id: string, input: MovieInput): Promise<void> {
  const { error } = await supabase
    .from("movies")
    .update({
      title: input.title,
      description: input.description ?? null,
      video_url: input.videoUrl,
      thumbnail: input.thumbnail ?? null,
      category: input.category ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMovie(id: string): Promise<void> {
  const { error } = await supabase.from("movies").delete().eq("id", id);
  if (error) throw error;
}

// ===== Staff Daily Stats =====

export interface StaffDailyStatInput {
  date: string;
  newCustomers: number;
  totalDeposits: number;
  totalBets: number;
}

export async function upsertStaffDailyStat(input: StaffDailyStatInput): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("staff_daily_stats").upsert(
    {
      staff_id: userId,
      date: input.date,
      new_customers: input.newCustomers,
      total_deposits: input.totalDeposits,
      total_bets: input.totalBets,
    },
    { onConflict: "staff_id,date" }
  );
  if (error) throw error;
}

// ===== Staff Punishments =====

export interface StaffPunishmentInput {
  staffId: string;
  reason: string;
  amount: number;
  punishmentDate: string;
}

export async function createStaffPunishment(input: StaffPunishmentInput): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("staff_punishments").insert({
    staff_id: input.staffId,
    reason: input.reason,
    amount: input.amount,
    punishment_date: input.punishmentDate,
    created_by: userId,
  });
  if (error) throw error;

  const amountStr = input.amount > 0 ? ` — ${input.amount.toLocaleString("vi-VN")}đ` : "";
  const { error: ntfError } = await supabase.from("notifications").insert({
    user_id: input.staffId,
    type: "punishment",
    title: "Bạn có thông báo phạt",
    content: `${input.reason}${amountStr}`,
    is_read: false,
    created_at: new Date().toISOString(),
  });
  if (ntfError) console.warn("Không thể tạo thông báo phạt:", ntfError.message);
}

export async function deleteStaffPunishment(id: string): Promise<void> {
  const { error } = await supabase.from("staff_punishments").delete().eq("id", id);
  if (error) throw error;
}

export async function markPunishmentRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("staff_punishments")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw error;
}