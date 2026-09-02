import { useState } from "react";
import Avatar from "@/components/base/Avatar";
import Modal from "@/components/base/Modal";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { mapStaffPunishment } from "@/lib/mappers";
import { createStaffPunishment, deleteStaffPunishment, markPunishmentRead } from "@/lib/actions";
import type { StaffPunishment } from "@/types";
import { formatDateTime } from "@/utils/ui";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StaffPunishments() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [toast, setToast] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffPunishment | null>(null);
  const [detailTarget, setDetailTarget] = useState<StaffPunishment | null>(null);
  const [busy, setBusy] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const {
    data: punishments,
    loading,
    error,
    reload,
  } = useQuery<StaffPunishment[]>(async () => {
    let query = supabase
      .from("staff_punishments")
      .select("*, profiles!staff_punishments_staff_id_fkey(name)")
      .order("created_at", { ascending: false });

    if (!isAdmin && currentUser) {
      query = query.eq("staff_id", currentUser.id);
    }

    const { data, error: e } = await query;
    if (e) throw e;

    const mapped = (data ?? []).map((row: Record<string, unknown>) => {
      const mapped = mapStaffPunishment(row);
      const profile = row.profiles as { name?: string } | undefined;
      mapped.staffName = profile?.name ?? mapped.staffName ?? "";
      return mapped;
    });

    const creatorIds = [...new Set(mapped.map((p) => p.createdBy).filter(Boolean))];
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", creatorIds);
      const nameMap = new Map((creators ?? []).map((c) => [c.id, c.name]));
      mapped.forEach((p) => {
        p.createdByName = nameMap.get(p.createdBy) ?? p.createdByName ?? "";
      });
    }

    return mapped;
  });

  const todayPunishments = (punishments ?? []).filter((p) => p.punishmentDate === todayStr());
  const otherPunishments = (punishments ?? []).filter((p) => p.punishmentDate !== todayStr());

  const handleMarkRead = async (id: string) => {
    try {
      await markPunishmentRead(id);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Lỗi");
    }
  };

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground-950">Nhận phạt</h2>
          <p className="text-sm text-foreground-500 mt-0.5">
            {isAdmin ? "Quản lý và gửi thông báo phạt cho nhân viên." : "Xem thông báo phạt của bạn."}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line mr-1" />
            Gửi phạt
          </button>
        )}
      </div>

      {!isAdmin && todayPunishments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-alarm-warning-line text-red-600" />
            <h3 className="font-semibold text-red-800">Hôm nay bị phạt</h3>
          </div>
          <div className="space-y-2">
            {todayPunishments.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 bg-white rounded-md p-3 border border-red-100">
                <div>
                  <p className="text-sm font-medium text-red-900">{p.reason}</p>
                  {p.amount > 0 && <p className="text-sm text-red-700 mt-0.5">Số tiền phạt: {p.amount.toLocaleString("vi-VN")}đ</p>}
                </div>
                {!p.isRead && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(p.id)}
                    className="px-2 py-1 rounded-md text-xs bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Đã đọc
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (punishments ?? []).length === 0 ? (
        <EmptyState isAdmin={isAdmin} />
      ) : (
        <div className="space-y-3">
          {(isAdmin ? punishments : otherPunishments).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setDetailTarget(p)}
              className={`w-full text-left bg-background-50 rounded-lg border p-4 transition-colors hover:bg-background-100 ${
                !p.isRead && !isAdmin ? "border-red-300 bg-red-50/40" : "border-background-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <i className="ri-alarm-warning-line text-red-600 text-lg" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground-900">{p.reason}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-foreground-500">
                      {isAdmin && <span><i className="ri-user-line mr-0.5" />{p.staffName || "—"}</span>}
                      <span><i className="ri-calendar-line mr-0.5" />{p.punishmentDate}</span>
                      {p.amount > 0 && <span className="text-red-600 font-medium">{p.amount.toLocaleString("vi-VN")}đ</span>}
                      <span>gửi bởi {p.createdByName || "—"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isAdmin && !p.isRead && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleMarkRead(p.id); }}
                      className="px-2 py-1 rounded-md text-xs bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer whitespace-nowrap"
                    >
                      Đã đọc
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-400 hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                      title="Xóa"
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  )}
                </div>
              </div>
              {!p.isRead && !isAdmin && (
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                  Chưa đọc
                </span>
              )}
              <p className="mt-2 text-[11px] text-foreground-400">{formatDateTime(p.createdAt)}</p>
            </button>
          ))}
        </div>
      )}

      {createOpen && isAdmin && (
        <CreatePunishmentModal
          onClose={() => setCreateOpen(false)}
          onDone={async (input) => {
            setBusy(true);
            try {
              await createStaffPunishment(input);
              notify("Đã gửi thông báo phạt.");
              setCreateOpen(false);
              reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : "Gửi thất bại.");
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}

      {deleteTarget && isAdmin && (
        <Modal
          open
          title="Xóa thông báo phạt"
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
                onClick={async () => {
                  setBusy(true);
                  try {
                    await deleteStaffPunishment(deleteTarget.id);
                    notify("Đã xóa.");
                    setDeleteTarget(null);
                    reload();
                  } catch (e) {
                    notify(e instanceof Error ? e.message : "Xóa thất bại.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Xóa
              </button>
            </>
          }
        >
          <p className="text-sm text-foreground-700">
            Xóa thông báo phạt cho <span className="font-semibold">{deleteTarget.staffName}</span>?
          </p>
        </Modal>
      )}

      {detailTarget && (
        <Modal
          open
          title="Chi tiết thông báo phạt"
          onClose={() => setDetailTarget(null)}
          footer={
            <button
              type="button"
              onClick={() => setDetailTarget(null)}
              className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
            >
              Đóng
            </button>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <i className="ri-alarm-warning-line text-red-600 text-lg" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground-900">{detailTarget.reason}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-foreground-500">
                  <span><i className="ri-user-line mr-0.5" />{detailTarget.staffName || "—"}</span>
                  <span><i className="ri-calendar-line mr-0.5" />{detailTarget.punishmentDate}</span>
                </div>
              </div>
            </div>
            {detailTarget.amount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-700">
                  <span className="font-semibold">Số tiền phạt:</span> {detailTarget.amount.toLocaleString("vi-VN")}đ
                </p>
              </div>
            )}
            {detailTarget.imageUrl && (
              <div>
                <p className="text-xs text-foreground-500 mb-1">Hình ảnh minh chứng</p>
                <img
                  src={detailTarget.imageUrl}
                  alt="Minh chứng phạt"
                  className="w-full rounded-lg border border-background-200 object-cover max-h-80"
                />
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-foreground-500">
              <span>Gửi bởi {detailTarget.createdByName || "—"}</span>
              <span>{formatDateTime(detailTarget.createdAt)}</span>
            </div>
            {!isAdmin && !detailTarget.isRead && (
              <button
                type="button"
                onClick={async () => {
                  await handleMarkRead(detailTarget.id);
                  setDetailTarget((prev) => prev ? { ...prev, isRead: true } : prev);
                }}
                className="w-full px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>
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

function CreatePunishmentModal({
  onClose,
  onDone,
  busy,
}: {
  onClose: () => void;
  onDone: (input: { staffId: string; reason: string; amount: number; punishmentDate: string; imageUrl?: string }) => void;
  busy: boolean;
}) {
  const [staffId, setStaffId] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: staffList } = useQuery<{ id: string; name: string }[]>(async () => {
    const { data, error } = await supabase.from("profiles").select("id, name").eq("role", "staff").eq("active", true);
    if (error) throw error;
    return (data ?? []) as { id: string; name: string }[];
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Ảnh quá lớn. Tối đa 5MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    let imageUrl: string | undefined;
    if (imageFile) {
      setUploading(true);
      const fileName = `${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { data, error } = await supabase.storage.from("public").upload(`punishments/${fileName}`, imageFile, {
        cacheControl: "3600",
        upsert: false,
      });
      setUploading(false);
      if (error) {
        alert("Upload ảnh thất bại: " + error.message);
        return;
      }
      const { data: urlData } = supabase.storage.from("public").getPublicUrl(`punishments/${fileName}`);
      imageUrl = urlData?.publicUrl;
    }
    onDone({
      staffId,
      reason: reason.trim(),
      amount: parseInt(amount.replace(/[^0-9]/g, ""), 10) || 0,
      punishmentDate: date,
      imageUrl,
    });
  };

  return (
    <Modal
      open
      title="Gửi thông báo phạt"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={busy || uploading || !staffId || !reason.trim()}
            onClick={submit}
            className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy || uploading ? "Đang gửi..." : "Gửi phạt"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Nhân viên</label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
          >
            <option value="">Chọn nhân viên...</option>
            {(staffList ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Lý do phạt</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Nhập lý do phạt..."
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-foreground-700 mb-1.5">Số tiền phạt (VNĐ)</label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                setAmount(digits ? Number(digits).toLocaleString("vi-VN") : "");
              }}
              placeholder="VD: 100.000"
              className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm text-foreground-700 mb-1.5">Ngày phạt</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Hình ảnh minh chứng (tối đa 5MB)</label>
          <div className="flex items-center gap-3">
            <label className="px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm cursor-pointer hover:bg-background-100 flex items-center gap-2">
              <i className="ri-image-add-line" />
              Chọn ảnh
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
            {imagePreview && (
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="text-xs text-red-500 hover:text-red-600 cursor-pointer"
              >
                Xóa ảnh
              </button>
            )}
          </div>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="mt-2 w-full max-h-48 rounded-lg border border-background-200 object-cover"
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-foreground-500">
      <i className="ri-loader-4-line text-2xl animate-spin mr-2" />
      <span className="text-sm">Đang tải...</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <i className="ri-error-warning-line text-3xl text-red-500" />
      <p className="mt-3 text-sm text-foreground-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 px-4 py-2 rounded-md bg-primary-500 text-white text-sm cursor-pointer whitespace-nowrap"
      >
        Thử lại
      </button>
    </div>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
        <i className="ri-shield-check-line text-2xl text-foreground-400" />
      </div>
      <p className="mt-4 font-heading font-semibold text-foreground-700">
        {isAdmin ? "Chưa có thông báo phạt" : "Bạn chưa bị phạt"}
      </p>
      <p className="mt-1 text-sm text-foreground-400">
        {isAdmin ? "Nhấn \"Gửi phạt\" để tạo thông báo mới." : "Chưa có thông báo phạt nào dành cho bạn."}
      </p>
    </div>
  );
}