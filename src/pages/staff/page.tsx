import { useState } from "react";
import Avatar from "@/components/base/Avatar";
import Modal from "@/components/base/Modal";
import { useStaff } from "@/hooks/useStaff";
import {
  callManageUsers,
  renameStaff,
  setStaffChannels,
  transferStaffData,
  updateUserRole,
  sendDirectMessage,
} from "@/lib/actions";
import type { User } from "@/types";
import { presenceMeta, platformMeta, formatDateTime } from "@/utils/ui";
import { useNavigate } from "react-router-dom";

export default function Staff() {
  const { staff, channels, loading, error, reload } = useStaff();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [transferTarget, setTransferTarget] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [messageTarget, setMessageTarget] = useState<User | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [promoteTarget, setPromoteTarget] = useState<User | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const filtered = (staff ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleLock = async (s: User) => {
    setBusy(true);
    try {
      await callManageUsers({ action: "set_active", userId: s.id, active: !s.active });
      notify(s.active ? `Đã khóa tài khoản ${s.name}.` : `Đã mở khóa ${s.name}.`);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const revokeSession = async (s: User) => {
    setBusy(true);
    try {
      await callManageUsers({ action: "revoke_sessions", userId: s.id });
      notify(`Đã thu hồi phiên đăng nhập của ${s.name}.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = (s: User) => {
    if (s.customersHandled > 0) {
      notify(
        `${s.name} đang phụ trách ${s.customersHandled} khách hàng. Hãy chuyển dữ liệu trước khi xóa.`
      );
      return;
    }
    setDeleteTarget(s);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await callManageUsers({ action: "delete_user", userId: deleteTarget.id });
      notify(`Đã xóa tài khoản ${deleteTarget.name}.`);
      setDeleteTarget(null);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Xóa tài khoản thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageTarget || !messageContent.trim()) return;
    setBusy(true);
    try {
      const roomId = await sendDirectMessage(messageTarget.id, messageContent.trim());
      notify(`Đã gửi tin nhắn cho ${messageTarget.name}.`);
      setMessageTarget(null);
      setMessageContent("");
      navigate(`/team?room=${roomId}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gửi tin nhắn thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handlePromote = async () => {
    if (!promoteTarget) return;
    setBusy(true);
    try {
      const newRole = promoteTarget.role === "admin" ? "staff" : "admin";
      await updateUserRole(promoteTarget.id, newRole);
      notify(
        newRole === "admin"
          ? `Đã chỉ định ${promoteTarget.name} làm Admin.`
          : `Đã hạ ${promoteTarget.name} xuống Nhân viên.`
      );
      setPromoteTarget(null);
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground-950">Quản lý nhân viên</h2>
          <p className="text-sm text-foreground-500 mt-0.5">
            {(staff ?? []).length} nhân viên · quản trị và phân quyền tài khoản.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm nhân viên..."
              className="pl-9 pr-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line mr-1" />
            Tạo nhân viên
          </button>
        </div>
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
            <i className="ri-team-line text-2xl text-foreground-400" />
          </div>
          <p className="mt-4 font-heading font-semibold text-foreground-700">Chưa có nhân viên</p>
          <p className="mt-1 text-sm text-foreground-400">
            Nhấn "Tạo nhân viên" để thêm tài khoản mới.
          </p>
        </div>
      ) : (
        <>
        <div className="hidden md:block bg-background-50 rounded-lg border border-background-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-background-100 text-left text-xs text-foreground-500">
                  <th className="px-4 py-3 font-semibold">Nhân viên</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Kênh phân quyền</th>
                  <th className="px-4 py-3 font-semibold text-right">Khách</th>
                  <th className="px-4 py-3 font-semibold text-right">Tin đã trả lời</th>
                  <th className="px-4 py-3 font-semibold text-right">Phản hồi TB</th>
                  <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const presence = presenceMeta[s.presence];
                  return (
                    <tr key={s.id} className="border-t border-background-100 hover:bg-background-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} size="md" online={s.presence === "online"} />
                          <div>
                            <p className="font-medium text-foreground-900">{s.name}</p>
                            <p className="text-xs text-foreground-400">@{s.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                              s.active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${presence.dot}`} />
                            {s.active ? "Hoạt động" : "Đã khóa"}
                          </span>
                          {s.role === "admin" && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              <i className="ri-shield-star-line text-[10px]" />
                              Admin
                            </span>
                          )}
                          <p className="text-[11px] text-foreground-400">
                            {presence.label}
                            {s.lastActive ? ` · ${formatDateTime(s.lastActive)}` : ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {s.assignedChannelIds.length === 0 ? (
                            <span className="text-xs text-foreground-400">Chưa phân quyền</span>
                          ) : (
                            s.assignedChannelIds.slice(0, 3).map((cid) => {
                              const ch = channels.find((c) => c.id === cid);
                              const meta = platformMeta[ch?.platform ?? "facebook"];
                              return (
                                <span
                                  key={cid}
                                  title={ch?.name}
                                  className="w-6 h-6 rounded-md flex items-center justify-center cursor-default"
                                  style={{ backgroundColor: "oklch(var(--background-100))" }}
                                >
                                  <i className={`${meta.icon} ${meta.color} text-sm`} />
                                </span>
                              );
                            })
                          )}
                          {s.assignedChannelIds.length > 3 && (
                            <span className="text-xs text-foreground-400">
                              +{s.assignedChannelIds.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-foreground-900">{s.customersHandled}</td>
                      <td className="px-4 py-3 text-right text-foreground-900">{s.messagesReplied}</td>
                      <td className="px-4 py-3 text-right text-foreground-900">
                        {s.avgResponseMinutes} phút
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn icon="ri-pencil-line" title="Chỉnh sửa" onClick={() => setEditTarget(s)} />
                          <IconBtn
                            icon={s.active ? "ri-lock-line" : "ri-lock-unlock-line"}
                            title={s.active ? "Khóa tài khoản" : "Mở khóa"}
                            onClick={() => toggleLock(s)}
                          />
                          <IconBtn icon="ri-key-2-line" title="Đặt lại mật khẩu" onClick={() => setResetTarget(s)} />
                          <IconBtn icon="ri-logout-box-r-line" title="Thu hồi phiên" onClick={() => revokeSession(s)} />
                          <IconBtn icon="ri-arrow-left-right-line" title="Chuyển dữ liệu" onClick={() => setTransferTarget(s)} />
                          <IconBtn icon="ri-message-2-line" title="Nhắn tin riêng" onClick={() => setMessageTarget(s)} />
                          <IconBtn
                            icon={s.role === "admin" ? "ri-shield-cross-line" : "ri-shield-star-line"}
                            title={s.role === "admin" ? "Hạ xuống Nhân viên" : "Chỉ định làm Admin"}
                            onClick={() => setPromoteTarget(s)}
                          />
                          <IconBtn icon="ri-delete-bin-line" title="Xóa tài khoản" danger onClick={() => requestDelete(s)} />
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
            {filtered.map((s) => {
              const presence = presenceMeta[s.presence];
              return (
                <div key={s.id} className="bg-background-50 rounded-lg border border-background-200 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} size="md" online={s.presence === "online"} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground-900 truncate">{s.name}</p>
                        {s.role === "admin" && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                            <i className="ri-shield-star-line" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground-400">@{s.username}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full shrink-0 ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${presence.dot}`} />
                      {s.active ? "Hoạt động" : "Đã khóa"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-background-100 py-2 px-1">
                      <p className="text-sm font-bold text-foreground-900">{s.customersHandled}</p>
                      <p className="text-[10px] text-foreground-500 mt-0.5">Khách</p>
                    </div>
                    <div className="rounded-md bg-background-100 py-2 px-1">
                      <p className="text-sm font-bold text-foreground-900">{s.messagesReplied}</p>
                      <p className="text-[10px] text-foreground-500 mt-0.5">Tin trả lời</p>
                    </div>
                    <div className="rounded-md bg-background-100 py-2 px-1">
                      <p className="text-sm font-bold text-foreground-900">{s.avgResponseMinutes} phút</p>
                      <p className="text-[10px] text-foreground-500 mt-0.5">Phản hồi TB</p>
                    </div>
                  </div>
                  {s.assignedChannelIds.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {s.assignedChannelIds.map((cid) => {
                        const ch = channels.find((c) => c.id === cid);
                        const meta = platformMeta[ch?.platform ?? "facebook"];
                        return (
                          <span key={cid} title={ch?.name} className="w-7 h-7 rounded-md flex items-center justify-center bg-background-100">
                            <i className={`${meta.icon} ${meta.color} text-sm`} />
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-background-100 flex items-center justify-end gap-1">
                    <IconBtn icon="ri-pencil-line" title="Chỉnh sửa" onClick={() => setEditTarget(s)} />
                    <IconBtn icon={s.active ? "ri-lock-line" : "ri-lock-unlock-line"} title={s.active ? "Khóa tài khoản" : "Mở khóa"} onClick={() => toggleLock(s)} />
                    <IconBtn icon="ri-key-2-line" title="Đặt lại mật khẩu" onClick={() => setResetTarget(s)} />
                    <IconBtn icon="ri-logout-box-r-line" title="Thu hồi phiên" onClick={() => revokeSession(s)} />
                    <IconBtn icon="ri-arrow-left-right-line" title="Chuyển dữ liệu" onClick={() => setTransferTarget(s)} />
                    <IconBtn icon="ri-message-2-line" title="Nhắn tin riêng" onClick={() => setMessageTarget(s)} />
                    <IconBtn
                      icon={s.role === "admin" ? "ri-shield-cross-line" : "ri-shield-star-line"}
                      title={s.role === "admin" ? "Hạ xuống Nhân viên" : "Chỉ định làm Admin"}
                      onClick={() => setPromoteTarget(s)}
                    />
                    <IconBtn icon="ri-delete-bin-line" title="Xóa tài khoản" danger onClick={() => requestDelete(s)} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {resetTarget && (
        <ResetPasswordModal
          staff={resetTarget}
          busy={busy}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          onClose={() => {
            setResetTarget(null);
            setNewPassword("");
          }}
          onSubmit={async () => {
            setBusy(true);
            try {
              await callManageUsers({ action: "reset_password", userId: resetTarget.id, password: newPassword });
              notify(`Đã đặt lại mật khẩu cho ${resetTarget.name}.`);
              setResetTarget(null);
              setNewPassword("");
            } catch (e) {
              notify(e instanceof Error ? e.message : "Thao tác thất bại.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {transferTarget && (
        <TransferModal
          staff={transferTarget}
          others={staff.filter((u) => u.id !== transferTarget.id && u.active)}
          onClose={() => setTransferTarget(null)}
          onDone={async (toId) => {
            setBusy(true);
            try {
              await transferStaffData(transferTarget.id, toId);
              notify(`Đã chuyển dữ liệu từ ${transferTarget.name}.`);
              reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : "Thao tác thất bại.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {deleteTarget && (
        <Modal
          open
          title="Xóa tài khoản nhân viên"
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
                onClick={confirmDelete}
                className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {busy ? "Đang xóa..." : "Xóa tài khoản"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-foreground-600">
              Bạn có chắc muốn xóa tài khoản{" "}
              <span className="font-semibold">{deleteTarget.name}</span>? Hành động này không thể hoàn
              tác.
            </p>
            <p className="text-xs text-foreground-400 bg-background-100 rounded-md px-3 py-2">
              Toàn bộ dữ liệu liên quan của tài khoản này (bài viết, bình luận, đánh giá...) sẽ bị xóa
              vĩnh viễn.
            </p>
          </div>
        </Modal>
      )}

      <CreateModal
        open={createOpen}
        channels={channels}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onDone={async (payload) => {
          setBusy(true);
          try {
            await callManageUsers({ action: "create_user", role: "staff", ...payload });
            setCreateOpen(false);
            notify(`Đã tạo tài khoản nhân viên ${payload.name}.`);
            reload();
          } catch (e) {
            notify(e instanceof Error ? e.message : "Tạo tài khoản thất bại.");
          } finally {
            setBusy(false);
          }
        }}
      />

      {editTarget && (
        <EditModal
          staff={editTarget}
          channels={channels}
          busy={busy}
          onClose={() => setEditTarget(null)}
          onDone={async (name, channelIds) => {
            setBusy(true);
            try {
              await renameStaff(editTarget.id, name);
              await setStaffChannels(editTarget.id, channelIds);
              notify(`Đã cập nhật ${name}.`);
              setEditTarget(null);
              reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : "Cập nhật thất bại.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-background-50 text-sm px-4 py-2.5 rounded-lg shadow-sm animate-slide-up">
          <i className="ri-check-line mr-1 text-emerald-400" />
          {toast}
        </div>
      )}

      {messageTarget && (
        <Modal
          open
          title={`Nhắn tin cho ${messageTarget.name}`}
          onClose={() => { setMessageTarget(null); setMessageContent(""); }}
          footer={
            <>
              <button
                type="button"
                onClick={() => { setMessageTarget(null); setMessageContent(""); }}
                className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy || !messageContent.trim()}
                onClick={handleSendMessage}
                className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {busy ? "Đang gửi..." : "Gửi tin nhắn"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background-100">
              <Avatar name={messageTarget.name} size="md" />
              <div>
                <p className="text-sm font-semibold text-foreground-900">{messageTarget.name}</p>
                <p className="text-xs text-foreground-500">@{messageTarget.username}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">Nội dung tin nhắn</label>
              <textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder={`Nhắn tin riêng cho ${messageTarget.name}...`}
                className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                autoFocus
              />
              <p className="text-xs text-foreground-400 mt-1">{messageContent.length}/500 ký tự</p>
            </div>
            <p className="text-xs text-foreground-500">
              Tin nhắn sẽ được gửi đến phòng trò chuyện riêng. Bạn sẽ được chuyển đến đó sau khi gửi.
            </p>
          </div>
        </Modal>
      )}

      {promoteTarget && (
        <Modal
          open
          title={promoteTarget.role === "admin" ? "Hạ quyền Admin" : "Chỉ định Admin"}
          onClose={() => setPromoteTarget(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setPromoteTarget(null)}
                className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handlePromote}
                className={`px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap ${
                  promoteTarget.role === "admin" ? "bg-amber-500 hover:bg-amber-600" : "bg-primary-500 hover:bg-primary-600"
                }`}
              >
                {busy ? "Đang xử lý..." : promoteTarget.role === "admin" ? "Hạ xuống Nhân viên" : "Chỉ định làm Admin"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background-100">
              <Avatar name={promoteTarget.name} size="md" />
              <div>
                <p className="text-sm font-semibold text-foreground-900">{promoteTarget.name}</p>
                <p className="text-xs text-foreground-500">
                  Vai trò hiện tại: <span className="font-medium">{promoteTarget.role === "admin" ? "Admin" : "Nhân viên"}</span>
                </p>
              </div>
            </div>
            {promoteTarget.role === "admin" ? (
              <p className="text-sm text-foreground-600">
                Tài khoản <span className="font-semibold">{promoteTarget.name}</span> sẽ bị hạ xuống
                thành <span className="font-semibold">Nhân viên</span>, mất quyền truy cập giao diện quản trị.
              </p>
            ) : (
              <p className="text-sm text-foreground-600">
                Tài khoản <span className="font-semibold">{promoteTarget.name}</span> sẽ được nâng lên thành{" "}
                <span className="font-semibold text-primary-700">Admin</span>, có toàn quyền quản trị hệ thống.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function IconBtn({ icon, title, onClick, danger }: { icon: string; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-8 h-8 rounded-md flex items-center justify-center cursor-pointer ${
        danger
          ? "text-foreground-500 hover:bg-red-500/10 hover:text-red-500"
          : "text-foreground-500 hover:bg-background-100"
      }`}
    >
      <i className={icon} />
    </button>
  );
}

function CreateModal({
  open,
  channels,
  busy,
  onClose,
  onDone,
}: {
  open: boolean;
  channels: { id: string; name: string; platform: string }[];
  busy: boolean;
  onClose: () => void;
  onDone: (p: { name: string; username: string; password: string; channelIds: string[] }) => void;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const toggleChannel = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Modal
      open={open}
      title="Tạo tài khoản nhân viên"
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
            disabled={busy || !name || !username || !password}
            onClick={() => onDone({ name, username, password, channelIds: selected })}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Họ và tên" value={name} onChange={setName} placeholder="Nguyễn Văn A" />
        <Field label="Tên đăng nhập" value={username} onChange={setUsername} placeholder="nguyenvana" />
        <Field label="Mật khẩu (ít nhất 6 ký tự)" value={password} onChange={setPassword} placeholder="••••••••" />
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Phân quyền kênh</label>
          {channels.length === 0 ? (
            <p className="text-xs text-foreground-400">Chưa có kênh nào. Hãy kết nối kênh trước.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto cs-scroll">
              {channels.map((ch) => (
                <label key={ch.id} className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(ch.id)}
                    onChange={() => toggleChannel(ch.id)}
                    className="w-4 h-4 rounded border-background-300 text-primary-500 focus:ring-primary-400"
                  />
                  <i className={`${platformMeta[ch.platform as "facebook" | "telegram" | "tiktok"].icon} text-foreground-500`} />
                  {ch.name}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function EditModal({
  staff,
  channels,
  busy,
  onClose,
  onDone,
}: {
  staff: User;
  channels: { id: string; name: string; platform: string }[];
  busy: boolean;
  onClose: () => void;
  onDone: (name: string, channelIds: string[]) => void;
}) {
  const [name, setName] = useState(staff.name);
  const [selected, setSelected] = useState<string[]>(staff.assignedChannelIds);

  const toggleChannel = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Modal
      open
      title={`Chỉnh sửa - ${staff.name}`}
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
            disabled={busy || !name.trim()}
            onClick={() => onDone(name.trim(), selected)}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Họ và tên" value={name} onChange={setName} placeholder="Nguyễn Văn A" />
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Phân quyền kênh</label>
          {channels.length === 0 ? (
            <p className="text-xs text-foreground-400">Chưa có kênh nào.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto cs-scroll">
              {channels.map((ch) => (
                <label key={ch.id} className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(ch.id)}
                    onChange={() => toggleChannel(ch.id)}
                    className="w-4 h-4 rounded border-background-300 text-primary-500 focus:ring-primary-400"
                  />
                  <i className={`${platformMeta[ch.platform as "facebook" | "telegram" | "tiktok"].icon} text-foreground-500`} />
                  {ch.name}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({
  staff,
  busy,
  newPassword,
  setNewPassword,
  onClose,
  onSubmit,
}: {
  staff: User;
  busy: boolean;
  newPassword: string;
  setNewPassword: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      open
      title={`Đặt lại mật khẩu - ${staff.name}`}
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
            disabled={busy || newPassword.length < 6}
            onClick={onSubmit}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </>
      }
    >
      <label className="block text-sm text-foreground-700 mb-1.5">Mật khẩu mới (ít nhất 6 ký tự)</label>
      <input
        type="text"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Nhập mật khẩu mới"
        className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
    </Modal>
  );
}

function TransferModal({
  staff,
  others,
  onClose,
  onDone,
}: {
  staff: User;
  others: User[];
  onClose: () => void;
  onDone: (toId: string) => void;
}) {
  const [toId, setToId] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Modal
      open
      title={`Chuyển dữ liệu - ${staff.name}`}
      onClose={onClose}
      footer={
        confirmed ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => onDone(toId)}
              className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              Xác nhận chuyển
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!toId}
            onClick={() => setConfirmed(true)}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            Tiếp tục
          </button>
        )
      }
    >
      {!confirmed ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-foreground-700 mb-1.5">Nhân viên mới</label>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none cursor-pointer"
            >
              <option value="">Chọn nhân viên...</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-foreground-600">
            Toàn bộ khách hàng đang do <span className="font-semibold">{staff.name}</span> phụ trách sẽ
            được chuyển sang nhân viên mới.
          </p>
        </div>
      ) : (
        <div className="text-sm text-foreground-600 space-y-2">
          <p>
            Xác nhận chuyển dữ liệu từ <span className="font-semibold">{staff.name}</span> sang nhân viên
            mới đã chọn.
          </p>
          <p className="text-xs text-foreground-400">
            Lịch sử tin nhắn sẽ được giữ nguyên, không bị xóa.
          </p>
        </div>
      )}
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