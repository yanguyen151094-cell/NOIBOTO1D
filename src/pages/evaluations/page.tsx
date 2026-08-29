import { useMemo, useState } from "react";
import Avatar from "@/components/base/Avatar";
import Modal from "@/components/base/Modal";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { mapStaffEvaluation } from "@/lib/mappers";
import { createEvaluation, deleteEvaluation, uploadImage, type EvaluationInput } from "@/lib/actions";
import { formatDateTime } from "@/utils/ui";
import type { StaffEvaluation } from "@/types";
import { mockEvaluations, mockStaffProfiles } from "@/mocks/appData";

interface StaffOption {
  id: string;
  name: string;
}

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

export default function Evaluations() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [staffFilter, setStaffFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffEvaluation | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const { data, loading, error, reload } = useQuery<{
    evaluations: StaffEvaluation[];
    staff: StaffOption[];
  }>(async () => {
    try {
      const [evalRes, profRes] = await Promise.all([
        supabase.from("staff_evaluations").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, name, role"),
      ]);
      if (evalRes.error) throw evalRes.error;
      if (profRes.error) throw profRes.error;

      const nameMap: Record<string, string> = {};
      (profRes.data ?? []).forEach((p: { id: string; name: string }) => {
        nameMap[p.id] = p.name;
      });

      const evaluations = (evalRes.data ?? []).map((e) => {
        const m = mapStaffEvaluation(e);
        m.staffName = nameMap[e.staff_id] ?? "Nhân viên";
        m.evaluatorName = nameMap[e.evaluator_id] ?? "Tổ Trưởng ( OBICARE )";
        return m;
      });

      const staff = (profRes.data ?? [])
        .filter((p: { role: string }) => p.role === "staff")
        .map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));

      return { evaluations, staff };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAuthError(msg)) {
        return {
          evaluations: mockEvaluations.map((e) => ({ ...e })),
          staff: mockStaffProfiles
            .filter((p) => p.role === "staff")
            .map((p) => ({ id: p.id, name: p.name })),
        };
      }
      throw err;
    }
  });

  const myEvaluations = useMemo(() => {
    if (isAdmin) return data?.evaluations ?? [];
    return (data?.evaluations ?? []).filter((e) => e.staffId === currentUser?.id);
  }, [data, isAdmin, currentUser]);

  const stats = useMemo(() => {
    const list = myEvaluations;
    const total = list.length;
    const avg = total > 0 ? list.reduce((a, b) => a + b.rating, 0) / total : 0;
    return { total, avg: avg.toFixed(1) };
  }, [myEvaluations]);

  const staffSummary = useMemo(() => {
    const map: Record<string, { name: string; count: number; sum: number }> = {};
    (data?.evaluations ?? []).forEach((e) => {
      if (!map[e.staffId]) map[e.staffId] = { name: e.staffName, count: 0, sum: 0 };
      map[e.staffId].count += 1;
      map[e.staffId].sum += e.rating;
    });
    return Object.values(map)
      .map((s) => ({ ...s, avg: s.count > 0 ? s.sum / s.count : 0 }))
      .sort((a, b) => b.avg - a.avg);
  }, [data]);

  const visibleEvaluations = useMemo(() => {
    let list = myEvaluations;
    if (isAdmin && staffFilter !== "all") {
      list = list.filter((e) => e.staffId === staffFilter);
    }
    return list;
  }, [myEvaluations, isAdmin, staffFilter]);

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground-950">
            {isAdmin ? "Đánh giá nhân viên" : "Đánh giá của tôi"}
          </h2>
          <p className="text-sm text-foreground-500 mt-0.5">
            {isAdmin
              ? "Quản lý và tổng hợp đánh giá cho toàn bộ nhân viên."
              : "Xem các đánh giá bạn nhận được từ quản trị viên."}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line mr-1" />
            Thêm đánh giá
          </button>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-5">
            <div className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
                <i className="ri-star-line text-xl" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-foreground-950">{stats.avg}</p>
                <p className="text-sm text-foreground-500">Điểm trung bình</p>
              </div>
            </div>
            <div className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent-100 text-accent-700 flex items-center justify-center">
                <i className="ri-star-fill text-xl" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-foreground-950">{stats.total}</p>
                <p className="text-sm text-foreground-500">Lượt đánh giá</p>
              </div>
            </div>
            <div className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary-100 text-secondary-800 flex items-center justify-center">
                <i className="ri-team-line text-xl" />
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-foreground-950">
                  {isAdmin ? staffSummary.length : 1}
                </p>
                <p className="text-sm text-foreground-500">
                  {isAdmin ? "Nhân viên được đánh giá" : "Tài khoản của bạn"}
                </p>
              </div>
            </div>
          </div>

          {isAdmin && staffSummary.length > 0 && (
            <div className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5 mb-5">
              <h3 className="font-heading font-semibold text-foreground-900 mb-4">
                Tổng hợp đánh giá theo nhân viên
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {staffSummary.map((s) => (
                  <div key={s.name} className="flex items-center gap-3 p-3 rounded-lg border border-background-200">
                    <Avatar name={s.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground-900 truncate">{s.name}</p>
                      <p className="text-xs text-foreground-500">{s.count} lượt đánh giá</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Stars value={Math.round(s.avg)} />
                      </div>
                      <p className="text-sm font-bold text-foreground-900 mt-0.5">{s.avg.toFixed(1)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-background-50 rounded-lg border border-background-200 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-background-100">
              <h3 className="font-heading font-semibold text-foreground-900">Danh sách đánh giá</h3>
              {isAdmin && (
                <select
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Tất cả nhân viên</option>
                  {(data?.staff ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {visibleEvaluations.length === 0 ? (
              <p className="text-sm text-foreground-400 py-12 text-center">
                Chưa có đánh giá nào.
              </p>
            ) : (
              <ul className="divide-y divide-background-100">
                {visibleEvaluations.map((e) => (
                  <li key={e.id} className="px-4 md:px-5 py-4 flex items-start gap-3">
                    <Avatar name={e.staffName} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground-900">{e.staffName}</p>
                        <Stars value={e.rating} />
                      </div>
                      {e.title && (
                        <p className="text-sm text-foreground-800 mt-1 font-medium">{e.title}</p>
                      )}
                      {e.comment && (
                        <p className="text-sm text-foreground-600 mt-0.5 leading-snug">{e.comment}</p>
                      )}
                      {e.imageUrl && (
                        <div className="mt-2">
                          <img src={e.imageUrl} alt="Đánh giá" className="max-h-48 rounded-lg border border-background-200 object-contain" />
                        </div>
                      )}
                      <p className="text-xs text-foreground-400 mt-1.5">
                        {formatDateTime(e.createdAt)}
                        {isAdmin ? ` · Bởi ${e.evaluatorName}` : ""}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(e)}
                        title="Xóa đánh giá"
                        className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-400 hover:bg-red-500/10 hover:text-red-500 cursor-pointer shrink-0"
                      >
                        <i className="ri-delete-bin-line" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {addOpen && (
        <AddModal
          staff={data?.staff ?? []}
          busy={busy}
          onClose={() => setAddOpen(false)}
          onSave={async (input) => {
            setBusy(true);
            try {
              await createEvaluation(input);
              notify(`Đã gửi đánh giá đến ${input.staffName}.`);
              setAddOpen(false);
              reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : "Gửi đánh giá thất bại.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {deleteTarget && (
        <Modal
          open
          title="Xóa đánh giá"
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
                    await deleteEvaluation(deleteTarget.id);
                    notify("Đã xóa đánh giá.");
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
          <p className="text-sm text-foreground-600">
            Bạn có chắc muốn xóa đánh giá của{" "}
            <span className="font-semibold">{deleteTarget.staffName}</span>?
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

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <i
          key={i}
          className={`${
            i <= value ? "ri-star-fill text-amber-400" : "ri-star-line text-foreground-300"
          } text-sm`}
        />
      ))}
    </div>
  );
}

function AddModal({
  staff,
  busy,
  onClose,
  onSave,
}: {
  staff: StaffOption[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: EvaluationInput) => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Ảnh quá lớn (tối đa 5MB)."); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const selected = staff.find((s) => s.id === staffId);

  const submit = async () => {
    if (!selected) return;
    setUploading(true);
    let imageUrl: string | undefined;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile, "evaluations");
    }
    setUploading(false);
    onSave({
      staffId: selected.id,
      staffName: selected.name,
      rating,
      title: title.trim(),
      comment: comment.trim(),
      imageUrl,
    });
  };

  return (
    <Modal
      open
      title="Thêm đánh giá nhân viên"
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
            disabled={busy || !staffId}
            onClick={submit}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Nhân viên</label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none cursor-pointer"
          >
            <option value="">Chọn nhân viên...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Điểm đánh giá</label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i)}
                className="w-9 h-9 flex items-center justify-center cursor-pointer"
                aria-label={`${i} sao`}
              >
                <i
                  className={`${
                    i <= rating ? "ri-star-fill text-amber-400" : "ri-star-line text-foreground-300"
                  } text-2xl`}
                />
              </button>
            ))}
            <span className="text-sm font-semibold text-foreground-700 ml-1">{rating}/5</span>
          </div>
        </div>

        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Tiêu đề</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Hoàn thành tốt trong tháng này"
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>

        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Nhận xét</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ghi nhận xét chi tiết..."
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
          />
          <p className="text-xs text-foreground-400 text-right mt-1">{comment.length}/500</p>
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
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); }} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center cursor-pointer"><i className="ri-close-line" /></button>
              </div>
            )}
          </div>
          <p className="text-xs text-foreground-400 mt-1">Tối đa 5MB.</p>
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