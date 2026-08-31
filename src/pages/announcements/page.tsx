import { useEffect, useState, type ChangeEvent } from "react";
import Avatar from "@/components/base/Avatar";
import Modal from "@/components/base/Modal";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import {
  createAnnouncement,
  deleteAnnouncement,
  toggleLikeAnnouncement,
  uploadImage,
} from "@/lib/actions";
import { mapAnnouncement } from "@/lib/mappers";
import { formatRelative } from "@/utils/ui";
import type { Announcement } from "@/types";
import { mockAnnouncements } from "@/mocks/appData";

function isAuthError(message: string): boolean {
  return (
    message.includes("auth") ||
    message.includes("JWT") ||
    message.includes("session") ||
    message.includes("unauthorized") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("RLS") ||
    message.includes("network") ||
    message.includes("cors") ||
    message.includes("failed to fetch") ||
    message.includes("timeout") ||
    message.includes("offline")
  );
}

export default function Announcements() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const { data: items, loading, error, reload } = useQuery<Announcement[]>(
    async () => {
      try {
        const [annRes, likeRes] = await Promise.all([
          supabase.from("announcements").select("*").order("created_at", { ascending: false }),
          supabase.from("announcement_likes").select("announcement_id, user_id"),
        ]);
        if (annRes.error) throw annRes.error;
        if (likeRes.error) throw likeRes.error;

        const likeCount: Record<string, number> = {};
        const likedByMe = new Set<string>();
        (likeRes.data ?? []).forEach((l) => {
          likeCount[l.announcement_id] = (likeCount[l.announcement_id] ?? 0) + 1;
          if (l.user_id === currentUser?.id) likedByMe.add(l.announcement_id);
        });

        return (annRes.data ?? []).map((row) =>
          mapAnnouncement({
            ...row,
            like_count: likeCount[row.id] ?? 0,
            liked: likedByMe.has(row.id),
          })
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isAuthError(msg)) {
          return mockAnnouncements.map((a) => ({ ...a, liked: false }));
        }
        throw err;
      }
    },
    [currentUser?.id]
  );

  useEffect(() => {
    const channel = supabase
      .channel("announcements-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "announcement_likes" }, () => reload())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify("Ảnh quá lớn (tối đa 5MB).");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    setUploading(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, "announcements");
      }
      await createAnnouncement(title.trim(), content.trim(), imageUrl);
      notify("Đã đăng thông báo.");
      setTitle("");
      setContent("");
      setImageFile(null);
      setImagePreview("");
      setComposeOpen(false);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Đăng thông báo thất bại.");
    } finally {
      setBusy(false);
      setUploading(false);
    }
  };

  const handleToggleLike = async (a: Announcement) => {
    const wasLiked = a.liked;
    try {
      await toggleLikeAnnouncement(a.id, wasLiked);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Thao tác thất bại.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteAnnouncement(deleteTarget.id);
      notify("Đã xóa thông báo.");
      setDeleteTarget(null);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Xóa thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground-950">Thông báo</h2>
            <p className="text-sm text-foreground-500 mt-0.5">
              {(items ?? []).length} thông báo · cập nhật chung cho toàn đội.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line mr-1" />
              Đăng thông báo
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-foreground-500">
            <i className="ri-loader-4-line text-2xl animate-spin mr-2" />
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <i className="ri-error-warning-line text-3xl text-red-500" />
            <p className="mt-3 text-sm text-foreground-600">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-4 px-4 py-2 rounded-md bg-primary-500 text-white text-sm cursor-pointer whitespace-nowrap"
            >
              Thử lại
            </button>
          </div>
        ) : (items ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
              <i className="ri-megaphone-line text-2xl text-foreground-400" />
            </div>
            <p className="mt-4 font-heading font-semibold text-foreground-700">Chưa có thông báo</p>
            <p className="mt-1 text-sm text-foreground-400">
              {isAdmin ? "Nhấn \"Đăng thông báo\" để gửi cập nhật cho cả đội." : "Các thông báo từ quản lý sẽ hiển thị tại đây."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(items ?? []).map((a) => (
              <div key={a.id} className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={a.authorName} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground-900 truncate">{a.authorName}</p>
                      <p className="text-xs text-foreground-400">{formatRelative(a.createdAt)}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(a)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-400 hover:bg-red-500/10 hover:text-red-500 cursor-pointer shrink-0"
                      title="Xóa thông báo"
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  )}
                </div>

                <h3 className="mt-3 font-heading font-semibold text-foreground-950 text-base">
                  {a.title}
                </h3>
                <p className="mt-1.5 text-sm text-foreground-700 leading-relaxed whitespace-pre-line">
                  {a.content}
                </p>
                {a.imageUrl && (
                  <div className="mt-3">
                    <img
                      src={a.imageUrl}
                      alt={a.title}
                      className="max-h-72 w-full rounded-lg border border-background-200 object-contain bg-background-100"
                    />
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-background-100 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(a)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                      a.liked ? "text-red-500 bg-red-50" : "text-foreground-500 hover:bg-background-100"
                    }`}
                  >
                    <i className={a.liked ? "ri-heart-fill" : "ri-heart-line"} />
                    <span>{a.likeCount}</span>
                    <span className="hidden sm:inline">{a.liked ? "Đã thích" : "Thích"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {composeOpen && (
        <Modal
          open
          title="Đăng thông báo"
          onClose={() => setComposeOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy || !title.trim() || !content.trim()}
                onClick={handleCreate}
                className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {busy || uploading ? "Đang đăng..." : "Đăng thông báo"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">Tiêu đề</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Thông báo lịch làm việc tuần mới"
                className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">Nội dung</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Nhập nội dung thông báo..."
                className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">Hình ảnh đính kèm</label>
              <div className="flex items-center gap-3">
                <label className="px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-700 cursor-pointer hover:bg-background-100 whitespace-nowrap">
                  <i className="ri-image-line mr-1" />
                  Chọn ảnh
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                {imagePreview && (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="h-14 w-14 rounded-md object-cover border border-background-200" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(""); }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center cursor-pointer"
                      title="Bỏ ảnh"
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-foreground-400 mt-1">Tối đa 5MB, định dạng ảnh.</p>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          open
          title="Xóa thông báo"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Xóa
              </button>
            </>
          }
        >
          <p className="text-sm text-foreground-600">
            Bạn có chắc muốn xóa thông báo{" "}
            <span className="font-semibold">{deleteTarget.title}</span>? Hành động này không thể hoàn tác.
          </p>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-background-50 text-sm px-4 py-2.5 rounded-lg shadow-sm animate-slide-up">
          <i className="ri-check-line mr-1 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}