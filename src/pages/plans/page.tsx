import React from "react";
import { useEffect, useState } from "react";
import Avatar from "@/components/base/Avatar";
import Modal from "@/components/base/Modal";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { createPlan, deletePlan, uploadImage } from "@/lib/actions";
import { mapPlan } from "@/lib/mappers";
import { formatRelative } from "@/utils/ui";
import type { Plan } from "@/types";
import { mockPlans } from "@/mocks/appData";

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

export default function Plans() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const { data: items, loading, error, reload } = useQuery<Plan[]>(async () => {
    try {
      const { data, error: e } = await supabase
        .from("plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (e) throw e;
      return (data ?? []).map(mapPlan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAuthError(msg)) {
        return mockPlans.map((p) => ({ ...p }));
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("plans-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => reload())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        imageUrl = await uploadImage(imageFile, "plans");
      }
      await createPlan(title.trim(), content.trim(), imageUrl);
      notify("Đã gửi kế hoạch.");
      setTitle("");
      setContent("");
      setImageFile(null);
      setImagePreview("");
      setComposeOpen(false);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gửi kế hoạch thất bại.");
    } finally {
      setBusy(false);
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deletePlan(deleteTarget.id);
      notify("Đã xóa kế hoạch.");
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
            <h2 className="font-heading text-xl font-bold text-foreground-950">Kế hoạch</h2>
            <p className="text-sm text-foreground-500 mt-0.5">
              {(items ?? []).length} kế hoạch · công việc quản lý giao cho toàn đội.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line mr-1" />
              Gửi kế hoạch
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
              <i className="ri-task-line text-2xl text-foreground-400" />
            </div>
            <p className="mt-4 font-heading font-semibold text-foreground-700">Chưa có kế hoạch</p>
            <p className="mt-1 text-sm text-foreground-400">
              {isAdmin ? "Nhấn \"Gửi kế hoạch\" để giao việc cho đội." : "Các kế hoạch từ quản lý sẽ hiển thị tại đây."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(items ?? []).map((p) => (
              <div key={p.id} className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.authorName} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground-900 truncate">{p.authorName}</p>
                      <p className="text-xs text-foreground-400">{formatRelative(p.createdAt)}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-400 hover:bg-red-500/10 hover:text-red-500 cursor-pointer shrink-0"
                      title="Xóa kế hoạch"
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-semibold shrink-0">
                    Kế hoạch
                  </span>
                  <h3 className="font-heading font-semibold text-foreground-950 text-base">{p.title}</h3>
                </div>
                <p className="mt-2 text-sm text-foreground-700 leading-relaxed whitespace-pre-line">
                  {p.content}
                </p>
                {p.imageUrl && (
                  <div className="mt-3">
                    <img
                      src={p.imageUrl}
                      alt="Kế hoạch"
                      className="max-h-64 rounded-lg border border-background-200 object-contain"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {composeOpen && (
        <Modal
          open
          title="Gửi kế hoạch"
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
                {busy ? "Đang gửi..." : "Gửi kế hoạch"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">Tiêu đề kế hoạch</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Kế hoạch chăm sóc khách tuần này"
                className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">Nội dung công việc</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Mô tả công việc cần thực hiện..."
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
                    <img src={imagePreview} alt="Preview" className="h-12 w-12 rounded-md object-cover border border-background-200" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(""); }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center cursor-pointer"
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
          title="Xóa kế hoạch"
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
            Bạn có chắc muốn xóa kế hoạch{" "}
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