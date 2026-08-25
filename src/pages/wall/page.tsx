import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import {
  createStaffPost,
  deleteStaffPost,
  createStaffComment,
  deleteStaffComment,
  updateProfileAvatar,
  toggleLikeStaffPost,
} from "@/lib/actions";
import { mapStaffPost, mapStaffComment } from "@/lib/mappers";
import { formatTime } from "@/utils/ui";
import type { StaffPost, StaffComment } from "@/types";

interface StaffProfile {
  id: string;
  name: string;
  avatar: string;
  role: string;
  postCount: number;
}

export default function Wall() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [selectedId, setSelectedId] = useState(currentUser?.id ?? "");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const {
    data: staffs,
    loading: staffLoading,
    error: staffError,
    reload: reloadStaffs,
  } = useQuery<StaffProfile[]>(async () => {
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, name, avatar, role")
      .eq("active", true)
      .order("name");
    if (pErr) throw pErr;

    const ids = (profiles ?? []).map((p) => p.id);
    let countMap: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: postRows, error: cErr } = await supabase
        .from("staff_posts")
        .select("staff_id")
        .in("staff_id", ids);
      if (cErr) throw cErr;
      (postRows ?? []).forEach((r) => {
        countMap[r.staff_id] = (countMap[r.staff_id] || 0) + 1;
      });
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.name ?? "",
      avatar: p.avatar ?? "",
      role: p.role ?? "staff",
      postCount: countMap[p.id] ?? 0,
    }));
  });

  const selectedStaff = staffs?.find((s) => s.id === selectedId) ?? null;
  const isMyWall = selectedId === currentUser?.id;

  return (
    <div className="h-full flex flex-col md:flex-row animate-fade-in">
      {/* Staff list sidebar */}
      <div className="hidden md:flex w-64 shrink-0 flex-col border-r border-background-200 bg-background-50">
        <div className="px-4 py-3 border-b border-background-200">
          <p className="text-sm font-semibold text-foreground-900">Thành viên</p>
          <p className="text-[11px] text-foreground-500">Chọn để xem tường cá nhân</p>
        </div>
        <div className="flex-1 overflow-y-auto cs-scroll p-2">
          {staffLoading ? (
            <div className="flex items-center justify-center py-12">
              <i className="ri-loader-4-line animate-spin text-foreground-400" />
            </div>
          ) : staffError ? (
            <div className="text-center py-8 px-3">
              <p className="text-xs text-foreground-500">{staffError}</p>
              <button
                type="button"
                onClick={reloadStaffs}
                className="mt-2 px-3 py-1.5 rounded-md bg-primary-500 text-white text-xs cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : (
            staffs?.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selectedId === s.id ? "bg-primary-50" : "hover:bg-background-100"
                }`}
              >
                <StaffAvatar name={s.name} avatar={s.avatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground-900 truncate">{s.name}</p>
                  <p className="text-[11px] text-foreground-500">{s.postCount} bài viết</p>
                </div>
                {s.id === currentUser?.id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 shrink-0">
                    Bạn
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Mobile staff selector */}
      <div className="md:hidden px-4 py-2 border-b border-background-200 bg-background-50">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm"
        >
          {staffs?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.id === currentUser?.id ? "(Bạn)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Main wall area */}
      <div className="flex-1 overflow-y-auto cs-scroll bg-background-50 min-w-0">
        {selectedStaff && (
          <WallFeed
            staff={selectedStaff}
            isMyWall={isMyWall}
            currentUser={currentUser!}
            isAdmin={isAdmin}
            notify={notify}
            busy={busy}
            setBusy={setBusy}
          />
        )}
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

function StaffAvatar({ name, avatar, size = "md" }: { name: string; avatar?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const dims =
    size === "sm"
      ? "w-9 h-9"
      : size === "lg"
      ? "w-16 h-16"
      : size === "xl"
      ? "w-20 h-20"
      : "w-11 h-11";
  if (avatar) {
    return <img src={avatar} alt={name} className={`${dims} rounded-full object-cover shrink-0`} />;
  }
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className={`${dims} rounded-full bg-secondary-500 text-white flex items-center justify-center shrink-0 text-sm font-bold`}
    >
      {initial}
    </div>
  );
}

function WallFeed({
  staff,
  isMyWall,
  currentUser,
  isAdmin,
  notify,
  busy,
  setBusy,
}: {
  staff: StaffProfile;
  isMyWall: boolean;
  currentUser: { id: string; name: string; avatar?: string };
  isAdmin: boolean;
  notify: (msg: string) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const [posts, setPosts] = useState<StaffPost[]>([]);
  const [comments, setComments] = useState<Record<string, StaffComment[]>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newPost, setNewPost] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>();
  const [showComments, setShowComments] = useState<Record<string, boolean>>();
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>();
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPosts = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: e } = await supabase
        .from("staff_posts")
        .select(
          `id, staff_id, content, image_url, created_at, profiles!staff_posts_staff_id_fkey(name, avatar), staff_comments(count), staff_post_likes(count)`
        )
        .eq("staff_id", staff.id)
        .order("created_at", { ascending: false });
      if (e) throw e;

      const { data: likeRows } = await supabase
        .from("staff_post_likes")
        .select("post_id")
        .eq("user_id", currentUser.id);
      const likedSet = new Set((likeRows ?? []).map((r) => r.post_id as string));

      const mapped = (data ?? []).map((row: Record<string, unknown>) => {
        const profileArr = row.profiles as Record<string, unknown>[] | undefined;
        const profile = profileArr?.[0] ?? {};
        const commentAgg = row.staff_comments as { count: number }[] | undefined;
        const likeAgg = row.staff_post_likes as { count: number }[] | undefined;
        const commentCount = commentAgg?.[0]?.count ?? 0;
        const likeCount = likeAgg?.[0]?.count ?? 0;
        return mapStaffPost({
          ...row,
          staff_name: profile.name,
          staff_avatar: profile.avatar,
          comment_count: commentCount,
          like_count: likeCount,
          liked: likedSet.has(row.id as string),
        });
      });
      setPosts(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải bài viết");
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      const { data, error: e } = await supabase
        .from("staff_comments")
        .select(
          `id, post_id, author_id, content, created_at, profiles!staff_comments_author_id_fkey(name, avatar)`
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (e) throw e;

      const mapped = (data ?? []).map((row: Record<string, unknown>) => {
        const profileArr = row.profiles as Record<string, unknown>[] | undefined;
        const profile = profileArr?.[0] ?? {};
        return mapStaffComment({
          ...row,
          author_name: profile.name,
          author_avatar: profile.avatar,
        });
      });
      setComments((prev) => ({ ...prev, [postId]: mapped }));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff.id]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingImg(true);
    try {
      // Try to upload to Supabase Storage bucket 'public' first
      const bucketName = "public";
      const ext = file.name.split(".").pop() || "jpg";
      const path = `staff-posts/${staff.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error: upErr } = await supabase.storage.from(bucketName).upload(path, file, {
        upsert: true,
      });
      
      if (upErr) {
        console.error("[Upload] Supabase storage error:", upErr);
        // Fallback: convert to base64 for immediate display
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setPostImage(base64);
        notify("Đã lưu ảnh tạm (base64). Lưu ý: ảnh sẽ không đồng bộ giữa các thiết bị.");
        return;
      }
      
      const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
      setPostImage(data.publicUrl);
    } catch (err) {
      console.error("[Upload] Unexpected error:", err);
      notify("Upload ảnh thất bại: " + (err instanceof Error ? err.message : "Lỗi không xác định"));
    } finally {
      setUploadingImg(false);
    }
  };

  const handleCreatePost = async () => {
    const text = newPost.trim();
    if (!text && !postImage) return;
    setBusy(true);
    try {
      await createStaffPost(text, postImage ?? undefined);
      notify("Đã đăng bài viết!");
      setNewPost("");
      setPostImage(null);
      loadPosts();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Đăng bài thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    setBusy(true);
    try {
      await deleteStaffPost(id);
      notify("Đã xóa bài viết.");
      loadPosts();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Xóa thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleLike = async (post: StaffPost) => {
    const wasLiked = post.liked;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, liked: !wasLiked, likeCount: p.likeCount + (wasLiked ? -1 : 1) }
          : p
      )
    );
    try {
      await toggleLikeStaffPost(post.id, wasLiked);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Thao tác thất bại.");
      loadPosts();
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentInputs[postId] ?? "").trim();
    if (!text) return;
    setBusy(true);
    try {
      await createStaffComment(postId, text);
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      loadComments(postId);
      loadPosts();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Bình luận thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteComment = async (id: string, postId: string) => {
    setBusy(true);
    try {
      await deleteStaffComment(id);
      loadComments(postId);
      loadPosts();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Xóa thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const toggleComments = (postId: string) => {
    const show = !showComments[postId];
    setShowComments((prev) => ({ ...prev, [postId]: show }));
    if (show && !comments[postId]) {
      loadComments(postId);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Profile header card */}
      <div className="bg-background-50 rounded-xl border border-background-200 p-5 mb-5">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="relative">
            <StaffAvatar name={staff.name} avatar={staff.avatar} size="xl" />
            {isMyWall && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 cursor-pointer shadow-sm"
                title="Đổi ảnh đại diện"
              >
                <i className="ri-camera-line text-sm" />
              </button>
            )}
            <input
              type="file"
              ref={fileRef}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = "";
                setUploadingImg(true);
                try {
                  const bucketName = "public";
                  const ext = file.name.split(".").pop() || "jpg";
                  const path = `avatars/${currentUser.id}/${Date.now()}.${ext}`;
                  const { error: upErr } = await supabase.storage.from(bucketName).upload(path, file, { upsert: true });
                  if (upErr) {
                    console.error("[Avatar Upload] Error:", upErr);
                    notify("Upload ảnh thất bại: " + upErr.message);
                    return;
                  }
                  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
                  await updateProfileAvatar(data.publicUrl);
                  notify("Đã cập nhật ảnh đại diện!");
                  window.location.reload();
                } catch (err) {
                  console.error("[Avatar Upload] Unexpected error:", err);
                  notify("Upload ảnh thất bại: " + (err instanceof Error ? err.message : "Lỗi không xác định"));
                } finally {
                  setUploadingImg(false);
                }
              }}
              accept="image/*"
              className="hidden"
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground-950">{staff.name}</h2>
            <p className="text-sm text-foreground-500">
              {posts.length} bài viết · {staff.role === "admin" ? "Ghe OBICARE" : "Nhân viên"}
            </p>
          </div>
        </div>
      </div>

      {/* Composer — giống Facebook */}
      {isMyWall && (
        <div className="bg-background-50 rounded-xl border border-background-200 p-4 mb-5">
          <div className="flex items-start gap-3">
            <StaffAvatar name={currentUser.name} avatar={currentUser.avatar} size="md" />
            <div className="flex-1 min-w-0">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Bạn đang nghĩ gì?"
                className="w-full px-0 py-1 bg-transparent text-sm text-foreground-900 placeholder:text-foreground-400 resize-none focus:outline-none overflow-hidden"
              />
            </div>
          </div>

          {postImage && (
            <div className="relative mt-3 inline-block">
              <img src={postImage} alt="Preview" className="w-32 h-32 sm:w-40 sm:h-40 rounded-lg object-cover border border-background-200" />
              <button
                type="button"
                onClick={() => setPostImage(null)}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-foreground-800 text-white flex items-center justify-center hover:bg-red-500 cursor-pointer shadow-sm"
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-background-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (ev) => {
                    handleImageSelect(ev as unknown as React.ChangeEvent<HTMLInputElement>);
                  };
                  input.click();
                }}
                disabled={uploadingImg}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <i className="ri-image-line text-sm" />
                {uploadingImg ? "Đang tải..." : "Ảnh"}
              </button>
            </div>
            <button
              type="button"
              disabled={busy || (!newPost.trim() && !postImage)}
              onClick={handleCreatePost}
              className="shrink-0 px-3 py-1.5 sm:px-5 sm:py-2 rounded-lg bg-primary-500 text-white text-xs sm:text-sm font-semibold hover:bg-primary-600 cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors"
            >
              {busy ? (
                <>
                  <i className="ri-loader-4-line animate-spin sm:mr-1" />
                  <span className="hidden sm:inline">Đang đăng...</span>
                  <span className="sm:hidden">Đang...</span>
                </>
              ) : (
                <>
                  <i className="ri-send-plane-fill sm:mr-1" />
                  <span className="hidden sm:inline">Đăng bài</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Posts feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="ri-loader-4-line animate-spin text-2xl text-foreground-400 mr-2" />
          <span className="text-sm text-foreground-500">Đang tải...</span>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <i className="ri-error-warning-line text-3xl text-red-500" />
          <p className="mt-3 text-sm text-foreground-600">{error}</p>
          <button
            type="button"
            onClick={loadPosts}
            className="mt-4 px-4 py-2 rounded-md bg-primary-500 text-white text-sm cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto">
            <i className="ri-article-line text-2xl text-foreground-400" />
          </div>
          <p className="mt-4 font-heading font-semibold text-foreground-700">Chưa có bài viết</p>
          <p className="mt-1 text-sm text-foreground-400">
            {isMyWall ? "Hãy đăng bài viết đầu tiên của bạn!" : "Tường này chưa có bài viết nào."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => {
            const isLong = post.content.length > 280;
            const isExpanded = expandedPosts[post.id] || !isLong;
            return (
              <div key={post.id} className="bg-background-50 rounded-xl border border-background-200 p-4">
                {/* Post header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <StaffAvatar name={post.staffName} avatar={post.staffAvatar} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground-900 truncate">{post.staffName}</p>
                      <p className="text-[11px] text-foreground-400">{formatTime(post.createdAt)}</p>
                    </div>
                  </div>
                  {(isAdmin || isMyWall) && (
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      disabled={busy}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-400 hover:bg-red-500/10 hover:text-red-500 cursor-pointer transition-colors"
                      title="Xóa"
                    >
                      <i className="ri-delete-bin-line text-sm" />
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="mt-3">
                  <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-line">
                    {isExpanded ? post.content : `${post.content.slice(0, 280)}...`}
                  </p>
                  {isLong && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPosts((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                      }
                      className="text-xs text-primary-600 font-medium mt-1 hover:underline cursor-pointer"
                    >
                      {isExpanded ? "Thu gọn" : "Xem thêm"}
                    </button>
                  )}
                </div>

                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt="Ảnh bài viết"
                    className="mt-3 w-full rounded-lg object-cover max-h-96 cursor-pointer"
                    onClick={() => window.open(post.imageUrl, "_blank")}
                  />
                )}

                {/* Stats */}
                <div className="mt-3 pt-2 flex items-center justify-between text-xs text-foreground-500">
                  <span className="flex items-center gap-1">
                    <i className="ri-heart-fill text-red-500" />
                    {post.likeCount}
                  </span>
                  <span>{post.commentCount} bình luận</span>
                </div>

                {/* Action bar */}
                <div className="mt-2 pt-2 border-t border-background-100 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(post)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                      post.liked
                        ? "text-red-500 bg-red-50"
                        : "text-foreground-500 hover:bg-background-100"
                    }`}
                  >
                    <i className={post.liked ? "ri-heart-fill" : "ri-heart-line"} />
                    <span>Thích</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleComments(post.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-foreground-500 hover:bg-background-100 cursor-pointer transition-colors"
                  >
                    <i className="ri-chat-1-line" />
                    <span>Bình luận</span>
                  </button>
                </div>

                {/* Comments section */}
                {showComments[post.id] && (
                  <div className="mt-3 space-y-3">
                    {/* Comment input */}
                    <div className="flex gap-2">
                      <StaffAvatar name={currentUser.name} avatar={currentUser.avatar} size="sm" />
                      <div className="flex-1 flex gap-2 min-w-0">
                        <input
                          type="text"
                          value={commentInputs[post.id] ?? ""}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                          placeholder="Viết bình luận..."
                          className="flex-1 min-w-0 px-4 py-2 rounded-full border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                        />
                        <button
                          type="button"
                          disabled={busy || !(commentInputs[post.id] ?? "").trim()}
                          onClick={() => handleAddComment(post.id)}
                          className="shrink-0 px-3 py-2 rounded-full bg-primary-500 text-white text-sm hover:bg-primary-600 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          <i className="ri-send-plane-fill" />
                        </button>
                      </div>
                    </div>

                    {/* Comment list */}
                    {comments[post.id]?.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <StaffAvatar name={c.authorName} avatar={c.authorAvatar} size="sm" />
                        <div className="flex-1">
                          <div className="bg-background-100 rounded-xl px-3 py-2">
                            <p className="text-xs font-semibold text-foreground-800">{c.authorName}</p>
                            <p className="text-sm text-foreground-700 mt-0.5">{c.content}</p>
                          </div>
                          <div className="flex items-center gap-3 mt-1 px-1">
                            <span className="text-[10px] text-foreground-400">{formatTime(c.createdAt)}</span>
                            {(isAdmin || c.authorId === currentUser.id) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id, post.id)}
                                className="text-[10px] text-red-500 hover:underline cursor-pointer"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}