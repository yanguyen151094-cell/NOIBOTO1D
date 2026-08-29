import { useState } from "react";
import Avatar from "@/components/base/Avatar";
import Modal from "@/components/base/Modal";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { mapCustomer, mapCustomerNote, mapCustomerAccount } from "@/lib/mappers";
import {
  upsertCustomerNote,
  createCustomerAccount,
  updateCustomerAccount,
  deleteCustomerAccount,
  type CustomerNoteInput,
  type CustomerAccountInput,
} from "@/lib/actions";
import { platformMeta, formatDateTime, formatMoney } from "@/utils/ui";
import type { Customer, CustomerNote, CustomerAccount, ChannelPlatform } from "@/types";
import { useAuth } from "@/context/AuthContext";

interface UnifiedRow {
  id: string;
  name: string;
  username?: string;
  platform?: ChannelPlatform;
  avatar?: string;
  source: "customer" | "account";
  registrationDate?: string;
  lastDepositDate?: string;
  totalDeposit: number;
  totalBet: number;
  meetsTarget: boolean;
  contactInfo: string;
  note: string;
  updatedAt: string;
  updatedByName?: string;
  isRegistered?: boolean;
  // refs
  customerId?: string;
  accountId?: string;
  originalCustomer?: Customer;
  originalNote?: CustomerNote | null;
  originalAccount?: CustomerAccount;
}

export default function CustomerNotes() {
  const { currentUser } = useAuth();
  const user = currentUser;
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [onlyRegistered, setOnlyRegistered] = useState(false);
  const [onlyMeetsTarget, setOnlyMeetsTarget] = useState(false);
  const [editing, setEditing] = useState<UnifiedRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const { data: rows, loading, error, reload } = useQuery<UnifiedRow[]>(async () => {
    const [custRes, noteRes, profRes, accRes] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("customer_notes").select("*"),
      supabase.from("profiles").select("id, name"),
      isAdmin
        ? supabase.from("customer_accounts").select("*, profiles!customer_accounts_created_by_fkey(name)")
        : supabase.from("customer_accounts").select("*, profiles!customer_accounts_created_by_fkey(name)").eq("created_by", user?.id ?? ""),
    ]);
    if (custRes.error) throw custRes.error;
    if (noteRes.error) throw noteRes.error;
    if (profRes.error) throw profRes.error;
    if (accRes.error) throw accRes.error;

    const nameMap: Record<string, string> = {};
    (profRes.data ?? []).forEach((p: { id: string; name: string }) => {
      nameMap[p.id] = p.name;
    });

    const notesByCustomer: Record<string, CustomerNote> = {};
    (noteRes.data ?? []).forEach((n) => {
      const mapped = mapCustomerNote(n);
      mapped.updatedByName = nameMap[n.updated_by] ?? undefined;
      notesByCustomer[mapped.customerId] = mapped;
    });

    const list = (custRes.data ?? []).map((c) => mapCustomer(c));
    list.sort(
      (a, b) =>
        new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime()
    );

    const customerRows: UnifiedRow[] = list.map((customer) => {
      const note = notesByCustomer[customer.id] ?? null;
      return {
        id: customer.id,
        name: customer.name,
        username: customer.username,
        platform: customer.platform,
        avatar: customer.avatar,
        source: "customer",
        registrationDate: undefined,
        lastDepositDate: undefined,
        totalDeposit: note?.totalDeposit ?? 0,
        totalBet: note?.totalBet ?? 0,
        meetsTarget: false,
        contactInfo: note?.contactInfo ?? customer.phone ?? "",
        note: note?.note ?? "",
        updatedAt: note?.updatedAt ?? customer.lastInteractionAt,
        updatedByName: note?.updatedByName,
        isRegistered: note?.isRegistered ?? false,
        customerId: customer.id,
        originalCustomer: customer,
        originalNote: note,
      };
    });

    const accountRows: UnifiedRow[] = (accRes.data ?? []).map((a) => {
      const mapped = mapCustomerAccount(a);
      const profileName = (a.profiles as { name?: string } | undefined)?.name;
      return {
        id: mapped.id,
        name: mapped.customerName,
        username: "",
        platform: undefined,
        avatar: "",
        source: "account",
        registrationDate: mapped.registrationDate,
        lastDepositDate: mapped.lastDepositDate,
        totalDeposit: mapped.totalDeposit,
        totalBet: mapped.totalBet,
        meetsTarget: mapped.meetsTarget,
        contactInfo: mapped.contactInfo,
        note: mapped.note,
        updatedAt: mapped.createdAt,
        updatedByName: profileName || mapped.createdByName,
        accountId: mapped.id,
        originalAccount: mapped,
      };
    });

    return [...customerRows, ...accountRows];
  });

  const filtered = (rows ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${r.name} ${r.username ?? ""} ${r.contactInfo} ${r.note}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (onlyRegistered && r.source === "customer" && !r.isRegistered) return false;
    if (onlyMeetsTarget && !r.meetsTarget) return false;
    return true;
  });

  const registeredCount = (rows ?? []).filter((r) => r.source === "customer" && r.isRegistered).length;
  const accountCount = (rows ?? []).filter((r) => r.source === "account").length;

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteCustomerAccount(id);
      notify("Đã xóa tài khoản.");
      setDeletingId(null);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Xóa thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground-950">Ghi chú khách hàng</h2>
          <p className="text-sm text-foreground-500 mt-0.5">
            {(rows ?? []).length} khách hàng · {registeredCount} đã đăng ký · {accountCount} tài khoản thủ công.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, tài khoản, liên hệ..."
              className="pl-9 pr-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer px-3 py-2 rounded-md border border-background-300 bg-background-50">
            <input
              type="checkbox"
              checked={onlyRegistered}
              onChange={(e) => setOnlyRegistered(e.target.checked)}
              className="w-4 h-4 rounded border-background-300 text-primary-500 focus:ring-primary-400"
            />
            Đã đăng ký
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer px-3 py-2 rounded-md border border-background-300 bg-background-50">
            <input
              type="checkbox"
              checked={onlyMeetsTarget}
              onChange={(e) => setOnlyMeetsTarget(e.target.checked)}
              className="w-4 h-4 rounded border-background-300 text-primary-500 focus:ring-primary-400"
            />
            Đủ chỉ tiêu
          </label>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="px-3 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <i className="ri-add-line" />
            Thêm tài khoản
          </button>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => setCreating(true)} />
      ) : (
        <>
        <div className="hidden md:block bg-background-50 rounded-lg border border-background-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="bg-background-100 text-left text-xs text-foreground-500">
                  <th className="px-4 py-3 font-semibold">Tên / Tài khoản</th>
                  <th className="px-4 py-3 font-semibold">Ngày đăng ký</th>
                  <th className="px-4 py-3 font-semibold">Ngày nạp</th>
                  <th className="px-4 py-3 font-semibold text-right">Tổng nạp</th>
                  <th className="px-4 py-3 font-semibold text-right">Tổng cược</th>
                  <th className="px-4 py-3 font-semibold">Đủ chỉ tiêu</th>
                  <th className="px-4 py-3 font-semibold">Liên hệ</th>
                  <th className="px-4 py-3 font-semibold">Nguồn</th>
                  <th className="px-4 py-3 font-semibold">Ghi chú</th>
                  <th className="px-4 py-3 font-semibold">Cập nhật</th>
                  <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const isCustomer = row.source === "customer";
                  const meta = row.platform ? platformMeta[row.platform] : null;
                  const hasNote = isCustomer ? !!row.originalNote : true;
                  return (
                    <tr key={row.id} className="border-t border-background-100 hover:bg-background-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {isCustomer && meta ? (
                            <div className="relative">
                              <Avatar name={row.name} size="md" />
                              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-background-50 bg-background-100">
                                <i className={`${meta.icon} text-[10px] ${meta.color}`} />
                              </span>
                            </div>
                          ) : (
                            <Avatar name={row.name} size="md" />
                          )}
                          <div>
                            <p className="font-medium text-foreground-900">{row.name}</p>
                            {row.username ? (
                              <p className="text-xs text-foreground-400">{row.username}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground-700 whitespace-nowrap">
                        {row.registrationDate ? formatDate(row.registrationDate) : <span className="text-foreground-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-foreground-700 whitespace-nowrap">
                        {row.lastDepositDate ? formatDate(row.lastDepositDate) : <span className="text-foreground-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground-900 font-medium whitespace-nowrap">
                        {row.totalDeposit > 0 ? formatMoney(row.totalDeposit) : <span className="text-foreground-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground-900 whitespace-nowrap">
                        {row.totalBet > 0 ? formatMoney(row.totalBet) : <span className="text-foreground-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.meetsTarget ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap">
                            <i className="ri-checkbox-circle-fill text-xs" />
                            Đủ chỉ tiêu
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-background-100 text-foreground-500 whitespace-nowrap">
                            <i className="ri-close-circle-line text-xs" />
                            Chưa đủ
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground-600">
                        {row.contactInfo || <span className="text-foreground-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isCustomer ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-800 whitespace-nowrap">
                            <i className="ri-message-3-line mr-1" />
                            Hộp thư
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 whitespace-nowrap">
                            <i className="ri-user-add-line mr-1" />
                            Thủ công
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.note ? (
                          <p className="text-xs text-foreground-600 max-w-[180px] truncate" title={row.note}>
                            {row.note}
                          </p>
                        ) : (
                          <span className="text-xs text-foreground-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground-500 text-xs whitespace-nowrap">
                        {formatDateTime(row.updatedAt)}
                        {row.updatedByName ? <p className="text-foreground-400">bởi {row.updatedByName}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {isCustomer ? (
                            <button
                              type="button"
                              onClick={() => setEditing(row)}
                              className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary-100 text-secondary-900 hover:bg-secondary-200 cursor-pointer whitespace-nowrap"
                            >
                              <i className={`${hasNote ? "ri-edit-line" : "ri-add-line"} mr-1`} />
                              {hasNote ? "Sửa" : "Thêm"}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditing(row)}
                                className="px-3 py-1.5 rounded-md text-xs font-medium bg-secondary-100 text-secondary-900 hover:bg-secondary-200 cursor-pointer whitespace-nowrap"
                              >
                                <i className="ri-edit-line mr-1" />
                                Sửa
                              </button>
                              {isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => setDeletingId(row.id)}
                                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer whitespace-nowrap"
                                >
                                  <i className="ri-delete-bin-line mr-1" />
                                  Xóa
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

          <div className="md:hidden space-y-3">
            {filtered.map((row) => {
              const isCustomer = row.source === "customer";
              const hasNote = isCustomer ? !!row.originalNote : true;
              return (
                <div key={row.id} className="bg-background-50 rounded-lg border border-background-200 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={row.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground-900 truncate">{row.name}</p>
                      {row.username ? <p className="text-xs text-foreground-400">{row.username}</p> : null}
                    </div>
                    {isCustomer ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-800 whitespace-nowrap">Hộp thư</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 whitespace-nowrap">Thủ công</span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-background-100 px-2.5 py-2">
                      <p className="text-foreground-400">Tổng nạp</p>
                      <p className="text-foreground-900 font-medium mt-0.5">{row.totalDeposit > 0 ? formatMoney(row.totalDeposit) : "—"}</p>
                    </div>
                    <div className="rounded-md bg-background-100 px-2.5 py-2">
                      <p className="text-foreground-400">Tổng cược</p>
                      <p className="text-foreground-900 font-medium mt-0.5">{row.totalBet > 0 ? formatMoney(row.totalBet) : "—"}</p>
                    </div>
                  </div>
                  {row.meetsTarget && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      <i className="ri-checkbox-circle-fill text-xs" /> Đủ chỉ tiêu
                    </span>
                  )}
                  {row.note ? (
                    <p className="mt-2 text-xs text-foreground-600 bg-background-100 rounded-md px-2.5 py-2 leading-snug">{row.note}</p>
                  ) : null}
                  <div className="mt-2 text-[11px] text-foreground-400 flex flex-wrap gap-x-2">
                    {row.contactInfo ? <span>{row.contactInfo}</span> : null}
                    <span>{formatDateTime(row.updatedAt)}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-background-100 flex gap-2">
                    {isCustomer ? (
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
                        className="flex-1 px-3 py-2 rounded-md text-xs font-medium bg-secondary-100 text-secondary-900 hover:bg-secondary-200 cursor-pointer whitespace-nowrap"
                      >
                        {hasNote ? "Sửa ghi chú" : "Thêm ghi chú"}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          className="flex-1 px-3 py-2 rounded-md text-xs font-medium bg-secondary-100 text-secondary-900 hover:bg-secondary-200 cursor-pointer whitespace-nowrap"
                        >
                          Sửa
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setDeletingId(row.id)}
                            className="px-3 py-2 rounded-md text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer whitespace-nowrap"
                          >
                            Xóa
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {creating && (
        <AccountModal
          busy={busy}
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            setBusy(true);
            try {
              await createCustomerAccount(input);
              notify("Đã thêm tài khoản mới.");
              setCreating(false);
              reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : "Thêm thất bại.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {editing && editing.source === "customer" && editing.originalCustomer && (
        <NoteModal
          row={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            setBusy(true);
            try {
              await upsertCustomerNote(editing.customerId!, input);
              notify(`Đã lưu ghi chú cho ${editing.name}.`);
              setEditing(null);
              reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : "Lưu thất bại.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {editing && editing.source === "account" && editing.originalAccount && (
        <AccountModal
          account={editing.originalAccount}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            setBusy(true);
            try {
              await updateCustomerAccount(editing.accountId!, input);
              notify("Đã cập nhật tài khoản.");
              setEditing(null);
              reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : "Cập nhật thất bại.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {deletingId && (
        <Modal
          open
          title="Xác nhận xóa"
          onClose={() => setDeletingId(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {busy ? "Đang xóa..." : "Xóa"}
              </button>
            </>
          }
        >
          <p className="text-sm text-foreground-700">Bạn có chắc muốn xóa tài khoản này? Thao tác không thể hoàn tác.</p>
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

function AccountModal({
  account,
  busy,
  onClose,
  onSave,
}: {
  account?: CustomerAccount;
  busy: boolean;
  onClose: () => void;
  onSave: (input: CustomerAccountInput) => void;
}) {
  const [customerName, setCustomerName] = useState(account?.customerName ?? "");
  const [registrationDate, setRegistrationDate] = useState(account?.registrationDate ?? "");
  const [lastDepositDate, setLastDepositDate] = useState(account?.lastDepositDate ?? "");
  const [totalDeposit, setTotalDeposit] = useState(account ? String(account.totalDeposit) : "");
  const [totalBet, setTotalBet] = useState(account ? String(account.totalBet) : "");
  const [meetsTarget, setMeetsTarget] = useState(account?.meetsTarget ?? false);
  const [contactInfo, setContactInfo] = useState(account?.contactInfo ?? "");
  const [note, setNote] = useState(account?.note ?? "");

  const submit = () => {
    onSave({
      customerName: customerName.trim(),
      registrationDate: registrationDate || undefined,
      lastDepositDate: lastDepositDate || undefined,
      totalDeposit: parseFloat(totalDeposit) || 0,
      totalBet: parseFloat(totalBet) || 0,
      meetsTarget,
      contactInfo: contactInfo.trim(),
      note: note.trim(),
    });
  };

  return (
    <Modal
      open
      title={account ? `Sửa tài khoản — ${account.customerName}` : "Thêm tài khoản mới"}
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
            disabled={busy || !customerName.trim()}
            onClick={submit}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang lưu..." : account ? "Cập nhật" : "Thêm tài khoản"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tên khách / Tên tài khoản" value={customerName} onChange={setCustomerName} placeholder="Nhập tên khách hoặc tên đăng nhập" required />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-foreground-700 mb-1.5">Ngày đăng ký</label>
            <input
              type="date"
              value={registrationDate}
              onChange={(e) => setRegistrationDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm text-foreground-700 mb-1.5">Ngày nạp gần nhất</label>
            <input
              type="date"
              value={lastDepositDate}
              onChange={(e) => setLastDepositDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-foreground-700 mb-1.5">Tổng nạp (VND)</label>
            <input
              type="number"
              min="0"
              value={totalDeposit}
              onChange={(e) => setTotalDeposit(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm text-foreground-700 mb-1.5">Tổng cược (VND)</label>
            <input
              type="number"
              min="0"
              value={totalBet}
              onChange={(e) => setTotalBet(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>

        <label className="flex items-center justify-between p-3 rounded-lg bg-background-100 cursor-pointer">
          <span className="text-sm text-foreground-800 font-medium">Đủ chỉ tiêu</span>
          <button
            type="button"
            onClick={() => setMeetsTarget((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
              meetsTarget ? "bg-emerald-500" : "bg-background-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                meetsTarget ? "translate-x-5" : ""
              }`}
            />
          </button>
        </label>

        <Field label="Thông tin liên hệ" value={contactInfo} onChange={setContactInfo} placeholder="SĐT, Zalo, email..." />

        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Ghi chú</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ghi chú thêm..."
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
          />
          <p className="text-xs text-foreground-400 text-right mt-1">{note.length}/500</p>
        </div>
      </div>
    </Modal>
  );
}

function NoteModal({
  row,
  busy,
  onClose,
  onSave,
}: {
  row: UnifiedRow;
  busy: boolean;
  onClose: () => void;
  onSave: (input: CustomerNoteInput) => void;
}) {
  const n = row.originalNote;
  const [isRegistered, setIsRegistered] = useState(n?.isRegistered ?? false);
  const [accountName, setAccountName] = useState(n?.accountName ?? "");
  const [contactInfo, setContactInfo] = useState(n?.contactInfo ?? "");
  const [totalDeposit, setTotalDeposit] = useState(n ? String(n.totalDeposit) : "");
  const [totalBet, setTotalBet] = useState(n ? String(n.totalBet) : "");
  const [note, setNote] = useState(n?.note ?? "");

  const submit = () => {
    onSave({
      isRegistered,
      accountName: accountName.trim(),
      contactInfo: contactInfo.trim(),
      totalDeposit: parseFloat(totalDeposit) || 0,
      totalBet: parseFloat(totalBet) || 0,
      note: note.trim(),
    });
  };

  return (
    <Modal
      open
      title={`Ghi chú — ${row.name}`}
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
            disabled={busy}
            onClick={submit}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang lưu..." : "Lưu ghi chú"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex items-center justify-between p-3 rounded-lg bg-background-100 cursor-pointer">
          <span className="text-sm text-foreground-800 font-medium">Khách đã đăng ký tài khoản</span>
          <button
            type="button"
            onClick={() => setIsRegistered((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
              isRegistered ? "bg-accent-500" : "bg-background-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                isRegistered ? "translate-x-5" : ""
              }`}
            />
          </button>
        </label>

        <Field label="Tên tài khoản" value={accountName} onChange={setAccountName} placeholder="Tên đăng nhập của khách" />
        <Field label="Thông tin liên hệ" value={contactInfo} onChange={setContactInfo} placeholder="SĐT, Zalo, email..." />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-foreground-700 mb-1.5">Tổng nạp (VND)</label>
            <input
              type="number"
              min="0"
              value={totalDeposit}
              onChange={(e) => setTotalDeposit(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm text-foreground-700 mb-1.5">Tổng cược (VND)</label>
            <input
              type="number"
              min="0"
              value={totalBet}
              onChange={(e) => setTotalBet(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Ghi chú</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ghi chú thêm về khách hàng..."
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
          />
          <p className="text-xs text-foreground-400 text-right mt-1">{note.length}/500</p>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm text-foreground-700 mb-1.5">
        {label}
        {required ? <span className="text-red-500 ml-1">*</span> : null}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
    </div>
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

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
        <i className="ri-sticky-note-line text-2xl text-foreground-400" />
      </div>
      <p className="mt-4 font-heading font-semibold text-foreground-700">Chưa có khách hàng</p>
      <p className="mt-1 text-sm text-foreground-400">
        Chưa có dữ liệu khách hàng. Bạn có thể thêm tài khoản thủ công.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium cursor-pointer whitespace-nowrap"
      >
        <i className="ri-add-line mr-1" />
        Thêm tài khoản
      </button>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}