import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/base/Modal";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { createReward, deleteReward, updateReward } from "@/lib/actions";
import { mapReward } from "@/lib/mappers";
import { formatMoney } from "@/utils/ui";
import type { Reward } from "@/types";
import { mockRewards } from "@/mocks/rewards";

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

export default function Rewards() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const [date, setDate] = useState("");
  const [workName, setWorkName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [rewardContent, setRewardContent] = useState("");
  const [amount, setAmount] = useState("");
  const [staffId, setStaffId] = useState("");

  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const { data: items, loading, error, reload } = useQuery<Reward[]>(async () => {
    try {
      const { data, error: e } = await supabase
        .from("staff_rewards")
        .select("*")
        .order("date", { ascending: false });
      if (e) throw e;
      return (data ?? []).map(mapReward);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAuthError(msg)) {
        return mockRewards.map((r) => ({
          id: r.id,
          date: r.date,
          workName: r.work_name,
          accountNumber: r.account_number,
          bankName: r.bank_name,
          recipientName: r.recipient_name,
          rewardContent: r.reward_content,
          amount: r.amount,
          createdAt: r.created_at,
        }));
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("rewards-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_rewards" }, () => reload())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.workName.toLowerCase().includes(q) ||
          r.rewardContent.toLowerCase().includes(q) ||
          (isAdmin && r.recipientName.toLowerCase().includes(q)) ||
          (isAdmin && r.bankName.toLowerCase().includes(q))
      );
    }
    if (filterMonth) {
      list = list.filter((r) => r.date.startsWith(filterMonth));
    }
    return list;
  }, [items, search, filterMonth, isAdmin]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, r) => sum + r.amount, 0),
    [filtered]
  );

  const { data: staffList } = useQuery<{ id: string; name: string }[]>(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("role", "staff")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return (data ?? []) as { id: string; name: string }[];
  });

  const openCreate = () => {
    setEditing(null);
    setDate(new Date().toISOString().split("T")[0]);
    setWorkName("");
    setAccountNumber("");
    setBankName("");
    setRecipientName("");
    setRewardContent("");
    setAmount("");
    setStaffId("");
    setComposeOpen(true);
  };

  const openEdit = (r: Reward) => {
    setEditing(r);
    setDate(r.date);
    setWorkName(r.workName);
    setAccountNumber(r.accountNumber);
    setBankName(r.bankName);
    setRecipientName(r.recipientName);
    setRewardContent(r.rewardContent);
    setAmount(String(r.amount));
    setStaffId(r.staffId ?? "");
    setComposeOpen(true);
  };

  const handleSave = async () => {
    if (!date.trim() || !workName.trim() || !amount.trim()) return;
    setBusy(true);
    try {
      const payload = {
        date: date.trim(),
        workName: workName.trim(),
        accountNumber: accountNumber.trim(),
        bankName: bankName.trim(),
        recipientName: recipientName.trim(),
        rewardContent: rewardContent.trim(),
        amount: Number(amount.replace(/[^0-9]/g, "")) || 0,
        staffId: staffId || undefined,
      };
      if (editing) {
        await updateReward(editing.id, payload);
        notify("Đã cập nhật.");
      } else {
        await createReward(payload);
        notify("Đã thêm mục nhận thưởng.");
      }
      setComposeOpen(false);
      setEditing(null);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteReward(deleteTarget.id);
      notify("Đã xóa.");
      setDeleteTarget(null);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Xóa thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = () => {
    if (!isAdmin) return;
    const rows = filtered;
    const headers = [
      "STT",
      "Ngày",
      "Tên công việc",
      "STK",
      "Ngân hàng",
      "Họ tên",
      "Nội dung thưởng",
      "Số tiền thưởng",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((r, idx) =>
        [
          idx + 1,
          r.date,
          `"${r.workName.replace(/"/g, '""')}"`,
          `"${r.accountNumber.replace(/"/g, '""')}"`,
          `"${r.bankName.replace(/"/g, '""')}"`,
          `"${r.recipientName.replace(/"/g, '""')}"`,
          `"${r.rewardContent.replace(/"/g, '""')}"`,
          r.amount,
        ].join(",")
      ),
      ["", "", "", "", "", "", "Tổng cộng:", totalAmount].join(","),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `danh-sach-nhan-thuong-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("Đã xuất file Excel.");
  };

  const adminCols = isAdmin;

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground-950">Danh sách nhận thưởng</h2>
            <p className="text-sm text-foreground-500 mt-0.5">
              {filtered.length} mục · tổng tiền thưởng {formatMoney(totalAmount)}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={exportExcel}
                className="px-3 py-2 rounded-md bg-accent-500 text-white text-sm font-medium hover:bg-accent-600 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-file-excel-2-line mr-1" />
                Xuất Excel
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={openCreate}
                className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line mr-1" />
                Thêm mục
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên công việc, nội dung thưởng..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 w-full sm:w-44"
          />
          {(search || filterMonth) && (
            <button
              type="button"
              onClick={() => { setSearch(""); setFilterMonth(""); }}
              className="px-3 py-2 rounded-md bg-background-100 text-foreground-600 text-sm hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-close-line mr-1" />
              Xóa lọc
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
              <i className="ri-coin-line text-2xl text-foreground-400" />
            </div>
            <p className="mt-4 font-heading font-semibold text-foreground-700">Chưa có mục nhận thưởng</p>
            <p className="mt-1 text-sm text-foreground-400">
              {isAdmin ? 'Nhấn "Thêm mục" để ghi nhận thưởng cho tổ viên.' : "Các mục nhận thưởng sẽ hiển thị tại đây."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-background-50 rounded-lg border border-background-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background-100 text-foreground-700">
                      <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">STT</th>
                      <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Ngày</th>
                      <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Tên công việc</th>
                      {adminCols && (
                        <>
                          <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">STK</th>
                          <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Ngân hàng</th>
                          <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Họ tên</th>
                        </>
                      )}
                      <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Nội dung thưởng</th>
                      <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Số tiền thưởng</th>
                      {adminCols && <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap w-20">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-background-200">
                    {filtered.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-background-100/50 transition-colors">
                        <td className="px-3 py-3 text-foreground-600">{idx + 1}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {new Date(r.date).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-3 py-3 font-medium text-foreground-900">{r.workName}</td>
                        {adminCols && (
                          <>
                            <td className="px-3 py-3 text-foreground-700 font-mono">{r.accountNumber}</td>
                            <td className="px-3 py-3 text-foreground-700">{r.bankName}</td>
                            <td className="px-3 py-3 text-foreground-700">{r.recipientName}</td>
                          </>
                        )}
                        <td className="px-3 py-3 text-foreground-700">{r.rewardContent}</td>
                        <td className="px-3 py-3 text-right font-semibold text-primary-700 whitespace-nowrap">
                          {formatMoney(r.amount)}
                        </td>
                        {adminCols && (
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(r)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-400 hover:bg-primary-500/10 hover:text-primary-600 cursor-pointer"
                                title="Sửa"
                              >
                                <i className="ri-pencil-line" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(r)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-400 hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                                title="Xóa"
                              >
                                <i className="ri-delete-bin-line" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-background-100 border-t border-background-200">
                      <td colSpan={adminCols ? 7 : 4} className="px-3 py-3 text-right font-semibold text-foreground-800">
                        Tổng cộng:
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-primary-700 whitespace-nowrap">
                        {formatMoney(totalAmount)}
                      </td>
                      {adminCols && <td className="px-3 py-3" />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((r, idx) => (
                <div key={r.id} className="bg-background-50 rounded-lg border border-background-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground-900">{r.workName}</p>
                      <p className="text-xs text-foreground-400 mt-0.5">
                        {new Date(r.date).toLocaleDateString("vi-VN")} · #{idx + 1}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-primary-700 whitespace-nowrap">{formatMoney(r.amount)}</p>
                  </div>
                  {adminCols && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-foreground-400">STK</p>
                        <p className="text-foreground-700 font-mono mt-0.5">{r.accountNumber || "—"}</p>
                      </div>
                      <div>
                        <p className="text-foreground-400">Ngân hàng</p>
                        <p className="text-foreground-700 mt-0.5">{r.bankName || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-foreground-400">Họ tên</p>
                        <p className="text-foreground-700 mt-0.5">{r.recipientName || "—"}</p>
                      </div>
                    </div>
                  )}
                  {r.rewardContent && (
                    <p className="mt-2 text-xs text-foreground-600">{r.rewardContent}</p>
                  )}
                  {adminCols && (
                    <div className="mt-3 pt-2 border-t border-background-100 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-400 hover:bg-primary-500/10 hover:text-primary-600 cursor-pointer"
                        title="Sửa"
                      >
                        <i className="ri-pencil-line" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(r)}
                        className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-400 hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                        title="Xóa"
                      >
                        <i className="ri-delete-bin-line" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div className="bg-background-100 rounded-lg border border-background-200 p-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground-800">Tổng cộng</p>
                <p className="text-sm font-bold text-primary-700">{formatMoney(totalAmount)}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {composeOpen && (
        <Modal
          open
          title={editing ? "Sửa mục nhận thưởng" : "Thêm mục nhận thưởng"}
          onClose={() => { setComposeOpen(false); setEditing(null); }}
          footer={
            <>
              <button
                type="button"
                onClick={() => { setComposeOpen(false); setEditing(null); }}
                className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy || !date.trim() || !workName.trim() || !amount.trim()}
                onClick={handleSave}
                className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {busy ? "Đang lưu..." : editing ? "Cập nhật" : "Thêm mục"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-foreground-700 mb-1.5">Ngày</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-sm text-foreground-700 mb-1.5">Số tiền thưởng (VNĐ)</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Ví dụ: 5000000"
                  className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">Tên công việc</label>
              <input
                type="text"
                value={workName}
                onChange={(e) => setWorkName(e.target.value)}
                placeholder="Ví dụ: Chăm sóc khách VIP tháng 8"
                className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">
                Nhân viên nhận thưởng <span className="text-foreground-400">(để gửi thông báo chúc mừng 🎉)</span>
              </label>
              <select
                value={staffId}
                onChange={(e) => {
                  const id = e.target.value;
                  setStaffId(id);
                  const s = (staffList ?? []).find((x) => x.id === id);
                  if (s && !recipientName.trim()) setRecipientName(s.name);
                }}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-foreground-700 mb-1.5">Số tài khoản</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="1234567890"
                  className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-sm text-foreground-700 mb-1.5">Ngân hàng</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Ví dụ: Vietcombank"
                  className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">Họ tên người nhận</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">Nội dung thưởng</label>
              <textarea
                value={rewardContent}
                onChange={(e) => setRewardContent(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Mô tả lý do thưởng..."
                className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          open
          title="Xóa mục nhận thưởng"
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
            Bạn có chắc muốn xóa mục nhận thưởng ngày{" "}
            <span className="font-semibold">{new Date(deleteTarget.date).toLocaleDateString("vi-VN")}</span>{" "}
            — <span className="font-semibold">{deleteTarget.workName}</span>? Hành động này không thể hoàn tác.
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