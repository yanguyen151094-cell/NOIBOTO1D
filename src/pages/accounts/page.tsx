import { useState } from "react";
import Modal from "@/components/base/Modal";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@/hooks/useQuery";
import { supabase } from "@/lib/supabase";
import { mapAccountVault } from "@/lib/mappers";
import {
  createAccountVault,
  updateAccountVault,
  deleteAccountVault,
  type AccountVaultInput,
} from "@/lib/actions";
import { platformMeta, formatDateTime } from "@/utils/ui";
import type { AccountVault, VaultPlatform } from "@/types";

const PLATFORMS: VaultPlatform[] = ["facebook", "tiktok", "telegram"];

export default function Accounts() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "alive" | "dead">("all");
  const [editing, setEditing] = useState<AccountVault | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountVault | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const { data: items, loading, error, reload } = useQuery<AccountVault[]>(async () => {
    const { data, error: e } = await supabase
      .from("account_vault")
      .select("*")
      .order("created_at", { ascending: false });
    if (e) throw e;
    return (data ?? []).map(mapAccountVault);
  });

  const filtered = (items ?? []).filter((a) => {
    const q = search.trim().toLowerCase();
    if (q && !`${a.label} ${a.username} ${a.email}`.toLowerCase().includes(q)) return false;
    if (platform !== "all" && a.platform !== platform) return false;
    if (statusFilter === "alive" && a.isDead) return false;
    if (statusFilter === "dead" && !a.isDead) return false;
    return true;
  });

  const counts = (items ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.platform] = (acc[a.platform] ?? 0) + 1;
    return acc;
  }, {});

  const deadCount = (items ?? []).filter((a) => a.isDead).length;
  const aliveCount = (items ?? []).length - deadCount;

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground-950">Kho tài khoản</h2>
          <p className="text-sm text-foreground-500 mt-0.5">
            {(items ?? []).length} tài khoản · lưu thông tin đăng nhập các nền tảng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line mr-1" />
          Thêm tài khoản
        </button>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm nhãn, tài khoản, email..."
            className="pl-9 pr-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div className="flex items-center gap-1 bg-background-100 rounded-full px-1 py-1">
          <FilterChip
            active={platform === "all"}
            label="Tất cả"
            onClick={() => setPlatform("all")}
          />
          {PLATFORMS.map((p) => (
            <FilterChip
              key={p}
              active={platform === p}
              label={`${platformMeta[p].label} (${counts[p] ?? 0})`}
              onClick={() => setPlatform(p)}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 bg-background-100 rounded-full px-1 py-1">
          <FilterChip
            active={statusFilter === "all"}
            label="Tất cả trạng thái"
            onClick={() => setStatusFilter("all")}
          />
          <FilterChip
            active={statusFilter === "alive"}
            label={`Sống (${aliveCount})`}
            onClick={() => setStatusFilter("alive")}
          />
          <FilterChip
            active={statusFilter === "dead"}
            label={`Die (${deadCount})`}
            onClick={() => setStatusFilter("dead")}
          />
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <VaultCard
              key={a.id}
              item={a}
              isAdmin={isAdmin}
              onEdit={() => setEditing(a)}
              onDelete={() => setDeleteTarget(a)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <VaultModal
          title="Thêm tài khoản"
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onSave={async (input) => {
            setBusy(true);
            try {
              await createAccountVault(input);
              notify("Đã thêm tài khoản.");
              setCreateOpen(false);
              reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : "Thêm tài khoản thất bại.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {editing && (
        <VaultModal
          title="Chỉnh sửa tài khoản"
          initial={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            setBusy(true);
            try {
              await updateAccountVault(editing.id, input);
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

      {deleteTarget && (
        <Modal
          open
          title="Xóa tài khoản"
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
                    await deleteAccountVault(deleteTarget.id);
                    notify("Đã xóa tài khoản.");
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
            Bạn có chắc muốn xóa tài khoản <span className="font-semibold">{deleteTarget.label}</span>?
            Hành động này không thể hoàn tác.
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

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
        active ? "bg-primary-500 text-white" : "text-foreground-600 hover:bg-background-200"
      }`}
    >
      {label}
    </button>
  );
}

function SecretField({ label, value, icon }: { label: string; value: string; icon: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] text-foreground-400 flex items-center gap-1">
          <i className={icon} />
          {label}
        </p>
        <p className="text-sm text-foreground-800 truncate">
          {value ? (revealed ? value : "••••••••") : <span className="text-foreground-300">—</span>}
        </p>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-400 hover:bg-background-100 cursor-pointer shrink-0"
          title={revealed ? "Ẩn" : "Hiện"}
        >
          <i className={revealed ? "ri-eye-off-line" : "ri-eye-line"} />
        </button>
      )}
    </div>
  );
}

function VaultCard({
  item,
  isAdmin,
  onEdit,
  onDelete,
}: {
  item: AccountVault;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = platformMeta[item.platform];
  return (
    <div className={`bg-background-50 rounded-lg border p-4 hover:border-background-300 transition-colors ${
      item.isDead ? "border-red-200 opacity-75" : "border-background-200"
    }`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
            <i className={`${meta.icon} text-xl ${meta.color}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground-900 truncate">
                {item.label || "Chưa đặt tên"}
              </p>
              {item.isDead && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold shrink-0">
                  Die
                </span>
              )}
            </div>
            <p className="text-xs text-foreground-400">{meta.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            title="Chỉnh sửa"
            className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-500 hover:bg-background-100 cursor-pointer"
          >
            <i className="ri-pencil-line" />
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={onDelete}
              title="Xóa"
              className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-500 hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
            >
              <i className="ri-delete-bin-line" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        <div>
          <p className="text-[11px] text-foreground-400 flex items-center gap-1">
            <i className="ri-user-line" />
            Tên đăng nhập
          </p>
          <p className="text-sm text-foreground-800 truncate">
            {item.username || <span className="text-foreground-300">—</span>}
          </p>
        </div>
        <SecretField label="Mật khẩu" value={item.password} icon="ri-lock-line" />
        <div>
          <p className="text-[11px] text-foreground-400 flex items-center gap-1">
            <i className="ri-mail-line" />
            Gmail
          </p>
          <p className="text-sm text-foreground-800 truncate">
            {item.email || <span className="text-foreground-300">—</span>}
          </p>
        </div>
        <SecretField label="Mã 2FA" value={item.twoFa} icon="ri-shield-keyhole-line" />
        {item.note && (
          <p className="text-xs text-foreground-500 leading-snug bg-background-100 rounded-md px-2.5 py-2">
            {item.note}
          </p>
        )}
      </div>

      <p className="mt-3 pt-3 border-t border-background-100 text-[11px] text-foreground-400">
        Thêm {formatDateTime(item.createdAt)}
      </p>
    </div>
  );
}

function VaultModal({
  title,
  initial,
  busy,
  onClose,
  onSave,
}: {
  title: string;
  initial?: AccountVault;
  busy: boolean;
  onClose: () => void;
  onSave: (input: AccountVaultInput) => void;
}) {
  const [platform, setPlatform] = useState<VaultPlatform>(initial?.platform ?? "facebook");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [twoFa, setTwoFa] = useState(initial?.twoFa ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [isDead, setIsDead] = useState(initial?.isDead ?? false);

  const submit = () => {
    onSave({
      platform,
      label: label.trim(),
      username: username.trim(),
      password,
      email: email.trim(),
      twoFa,
      note: note.trim(),
      isDead,
    });
  };

  return (
    <Modal
      open
      title={title}
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
            {busy ? "Đang lưu..." : "Lưu"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Nền tảng</label>
          <div className="grid grid-cols-3 gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-sm border cursor-pointer whitespace-nowrap ${
                  platform === p
                    ? "border-primary-400 bg-primary-100 text-primary-800"
                    : "border-background-300 text-foreground-600 hover:bg-background-100"
                }`}
              >
                <i className={platformMeta[p].icon} />
                {platformMeta[p].label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Nhãn hiển thị" value={label} onChange={setLabel} placeholder="VD: Fanpage TỔ 1D" />
        <Field label="Tên đăng nhập" value={username} onChange={setUsername} placeholder="Username" />
        <Field label="Mật khẩu" value={password} onChange={setPassword} placeholder="Mật khẩu" />
        <Field label="Gmail" value={email} onChange={setEmail} placeholder="example@gmail.com" />
        <Field label="Mã xác thực 2FA" value={twoFa} onChange={setTwoFa} placeholder="Mã 2FA / secret key" />
        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <p className="text-sm font-medium text-foreground-800">Tài khoản đã bị khóa (Die)</p>
            <p className="text-xs text-foreground-400">Bật nếu tài khoản này đã bị ban / checkpoint</p>
          </div>
          <button
            type="button"
            onClick={() => setIsDead((v) => !v)}
            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${
              isDead ? "bg-red-500" : "bg-background-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${
                isDead ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Ghi chú</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ghi chú thêm..."
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
          />
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-foreground-700 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center">
        <i className="ri-key-2-line text-2xl text-foreground-400" />
      </div>
      <p className="mt-4 font-heading font-semibold text-foreground-700">Chưa có tài khoản</p>
      <p className="mt-1 text-sm text-foreground-400">
        Nhấn "Thêm tài khoản" để lưu thông tin đăng nhập đầu tiên.
      </p>
    </div>
  );
}