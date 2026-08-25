import { useState } from "react";
import Modal from "@/components/base/Modal";
import { useChannels } from "@/hooks/useChannels";
import { useAuth } from "@/context/AuthContext";
import { createChannel, updateChannel, deleteChannel } from "@/lib/actions";
import type { Channel, ChannelPlatform } from "@/types";
import { platformMeta, formatRelative } from "@/utils/ui";

const LOGO_URL = "https://static.readdy.ai/image/b107d501ab31adf698875488b112872d/f98b9a4e8bfd5d380f0a97483bd53113.png";
const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;

export default function Channels() {
  const { currentUser } = useAuth();
  const { data: channels, loading, error, reload } = useChannels();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Channel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [guidePlatform, setGuidePlatform] = useState<"facebook" | "tiktok">("facebook");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const uid = currentUser?.id ?? "";

  const basePath = __BASE_PATH__.split("/").filter(Boolean).join("/");
  const pathPrefix = basePath ? `/${basePath}` : "";
  const appChannelsUrl = `${window.location.origin}${pathPrefix}/channels`;
  const connectUrl = `${supabaseUrl}/functions/v1/facebook-connect?redirect=${encodeURIComponent(appChannelsUrl)}&owner=${encodeURIComponent(uid)}`;

  const isOwner = (ch: Channel) => isAdmin || (!!uid && ch.ownerId === uid);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground-950">Kết nối kênh</h2>
          <p className="text-sm text-foreground-500 mt-0.5">
            {isAdmin ? (
              <>Thêm Page Facebook, TikTok Shop — <span className="font-semibold text-primary-600">không giới hạn số lượng</span>. Tin nhắn sẽ đổ về hộp thư chung trên web này.</>
            ) : (
              <>Bạn có thể tự kết nối <span className="font-semibold text-primary-600">Facebook của mình</span> để thêm Page riêng. Tin nhắn sẽ đổ về hộp thư chung.</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={connectUrl}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-facebook-circle-fill mr-1" />
            Kết nối Facebook của tôi
          </a>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm font-medium hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line mr-1" />
              Thêm kênh / Page
            </button>
          )}
        </div>
      </div>

      {/* How it works banner */}
      <div className="mb-5 rounded-xl border border-background-200 bg-background-50 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center shrink-0">
            <img src={LOGO_URL} alt="TỔ 1D" className="w-8 h-8 rounded object-cover" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-semibold text-foreground-900">Cách hoạt động</h3>
            <p className="text-sm text-foreground-600 mt-1 leading-relaxed">
              Khi bạn kết nối một <strong>Facebook Page</strong> hoặc <strong>TikTok Shop</strong>,
              mọi tin nhắn từ khách hàng gửi đến Page/Shop đó sẽ tự động hiện ngay trong
              <strong> Hộp thư</strong> của website này. Bạn và nhân viên chỉ cần mở web lên là trả lời được,
              <span className="text-primary-700 font-semibold"> không cần vào Facebook hay TikTok</span>.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => { setGuidePlatform("facebook"); setShowGuide(true); }}
                className="px-3 py-1.5 rounded-full bg-[#1877F2]/10 text-[#1877F2] text-xs font-semibold hover:bg-[#1877F2]/20 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-facebook-circle-fill mr-1" />
                Hướng dẫn kết nối Facebook
              </button>
              <button
                type="button"
                onClick={() => { setGuidePlatform("tiktok"); setShowGuide(true); }}
                className="px-3 py-1.5 rounded-full bg-foreground-200/70 text-foreground-700 text-xs font-semibold hover:bg-foreground-300/60 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-tiktok-fill mr-1" />
                Hướng dẫn kết nối TikTok
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Channel list */}
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
      ) : (channels ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-background-50 rounded-xl border border-dashed border-background-300">
          <div className="w-20 h-20 rounded-full bg-background-100 flex items-center justify-center">
            <i className="ri-plug-line text-3xl text-foreground-400" />
          </div>
          <p className="mt-4 font-heading font-semibold text-foreground-700 text-lg">Chưa có kênh nào</p>
          <p className="mt-1 text-sm text-foreground-400 max-w-sm">
            {isAdmin
              ? <>Nhấn "Thêm kênh / Page" để bắt đầu. Bạn có thể thêm <strong>vô số</strong> Fanpage Facebook và tài khoản TikTok.</>
              : <>Bấm <strong>"Kết nối Facebook của tôi"</strong> ở góc trên để thêm Page Facebook của bạn ngay.</>}
          </p>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-5 px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line mr-1" />
              Thêm kênh đầu tiên
            </button>
          ) : (
            <a
              href={connectUrl}
              className="mt-5 px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-facebook-circle-fill mr-1" />
              Kết nối Facebook của tôi
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(channels ?? []).map((ch) => {
            const meta = platformMeta[ch.platform];
            const isPending = ch.status === "pending";
            const isDisconnected = ch.status === "disconnected";
            const owned = isOwner(ch);
            return (
              <div key={ch.id} className="bg-background-50 rounded-xl border border-background-200 p-5 hover:border-primary-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${meta.bg}`}>
                    <i className={`${meta.icon} text-2xl ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-semibold text-foreground-950 truncate">{ch.name}</h3>
                      {!isAdmin && owned && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-100 text-accent-900 whitespace-nowrap">
                          Của tôi
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground-500 mt-0.5">{meta.label}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <StatusBadge status={ch.status} />
                      <span className="text-[11px] text-foreground-400">
                        Đồng bộ cuối:{" "}
                        {ch.lastSync ? formatRelative(ch.lastSync) : "Chưa đồng bộ"}
                      </span>
                    </div>
                  </div>
                </div>

                {isPending ? (
                  <div className="mt-4 px-3 py-2.5 rounded-md bg-accent-100 text-accent-900 text-xs flex items-start gap-2">
                    <i className="ri-time-line mt-0.5" />
                    <div>
                      <p className="font-medium">TikTok API chưa được phê duyệt</p>
                      <p className="mt-0.5">TikTok chưa cung cấp API tin nhắn công khai. Bạn có thể lưu tên tài khoản ở đây để quản lý, và chờ cập nhật sau.</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    {ch.platform === "facebook" && isAdmin && !isDisconnected && (
                      <a
                        href={`${supabaseUrl}/functions/v1/facebook-connect?redirect=${encodeURIComponent(appChannelsUrl)}&owner=${encodeURIComponent(uid)}`}
                        className="px-3 py-2 rounded-md bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-link mr-1" />
                        Kết nối / Cấp quyền
                      </a>
                    )}
                    {owned && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditTarget(ch)}
                          className="px-3 py-2 rounded-md bg-background-100 text-foreground-700 text-sm hover:bg-background-200 cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-pencil-line mr-1" />
                          Sửa / Thay page
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(ch)}
                          className="px-3 py-2 rounded-md bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-delete-bin-line mr-1" />
                          Gỡ
                        </button>
                      </>
                    )}
                    {!isAdmin && !owned && (
                      <span className="text-xs text-foreground-400 inline-flex items-center gap-1 whitespace-nowrap">
                        <i className="ri-lock-line" />
                        Kênh của người khác — chỉ xem
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Security note */}
      <div className="mt-6 rounded-xl border border-background-200 bg-background-50 p-5">
        <div className="flex items-start gap-3">
          <i className="ri-shield-check-line text-xl text-primary-600 mt-0.5" />
          <div>
            <h3 className="font-heading font-semibold text-foreground-900 mb-1">Bảo mật kết nối</h3>
            <p className="text-sm text-foreground-600 leading-relaxed">
              Mọi Access Token và App Secret đều được lưu <strong>phía máy chủ</strong> (bí mật của Supabase),
              không hiển thị trên trình duyệt. Hệ thống <strong>không yêu cầu</strong> bạn nhập mật khẩu
              Facebook hay TikTok vào website.
            </p>
          </div>
        </div>
      </div>

      {/* Add modal (admin) */}
      <AddChannelModal
        open={addOpen}
        busy={busy}
        onClose={() => setAddOpen(false)}
        onDone={async (name, platform, externalId) => {
          setBusy(true);
          try {
            await createChannel(name, platform, externalId);
            setAddOpen(false);
            notify(`Đã thêm kênh ${name}.`);
            reload();
          } catch (e) {
            notify(e instanceof Error ? e.message : "Thêm kênh thất bại.");
          } finally {
            setBusy(false);
          }
        }}
      />

      {editTarget && (
        <EditChannelModal
          channel={editTarget}
          busy={busy}
          onClose={() => setEditTarget(null)}
          onDone={async (name, externalId) => {
            setBusy(true);
            try {
              await updateChannel(editTarget.id, name, externalId);
              setEditTarget(null);
              notify(`Đã cập nhật kênh ${name}.`);
              reload();
            } catch (e) {
              notify(e instanceof Error ? e.message : "Cập nhật thất bại.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      <Modal
        open={!!deleteTarget}
        title="Gỡ kênh"
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
                  await deleteChannel(deleteTarget!.id);
                  notify(`Đã gỡ kênh ${deleteTarget!.name}.`);
                  setDeleteTarget(null);
                  reload();
                } catch (e) {
                  notify(e instanceof Error ? e.message : "Gỡ kênh thất bại.");
                } finally {
                  setBusy(false);
                }
              }}
              className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              {busy ? "Đang xử lý..." : "Xác nhận gỡ"}
            </button>
          </>
        }
      >
        <p className="text-sm text-foreground-600">
          Bạn chắc chắn muốn gỡ kênh <span className="font-semibold">{deleteTarget?.name}</span>? Lịch sử
          tin nhắn sẽ không bị xóa.
        </p>
      </Modal>

      {/* Guide modal */}
      <GuideModal
        open={showGuide}
        platform={guidePlatform}
        onClose={() => setShowGuide(false)}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground-950 text-background-50 text-sm px-4 py-2.5 rounded-lg shadow-sm animate-slide-up">
          <i className="ri-check-line mr-1 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Channel["status"] }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Đã kết nối
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Chờ duyệt
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-foreground-200/70 text-foreground-600">
      <span className="w-1.5 h-1.5 rounded-full bg-foreground-400" />
      Chưa kết nối
    </span>
  );
}

function GuideModal({
  open,
  platform,
  onClose,
}: {
  open: boolean;
  platform: "facebook" | "tiktok";
  onClose: () => void;
}) {
  if (!open) return null;

  const isFacebook = platform === "facebook";

  return (
    <Modal
      open={open}
      title={isFacebook ? "Hướng dẫn kết nối Facebook" : "Hướng dẫn kết nối TikTok"}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium cursor-pointer whitespace-nowrap"
        >
          Đã hiểu
        </button>
      }
    >
      <div className="space-y-4 text-sm text-foreground-700">
        {isFacebook ? (
          <>
            <p className="leading-relaxed">
              Sau khi kết nối, <strong>mọi tin nhắn từ khách hàng gửi vào Page</strong> sẽ tự động hiện
              trong <strong>Hộp thư</strong> của website này. Bạn không cần mở Facebook để trả lời.
            </p>
            <div className="rounded-lg bg-background-100 p-4 space-y-3">
              <h4 className="font-semibold text-foreground-900">Các bước thực hiện:</h4>
              <ol className="space-y-2 list-decimal list-inside">
                <li>Nhấn nút <strong>"Kết nối Facebook của tôi"</strong> ở góc trên.</li>
                <li>Đăng nhập Facebook và chọn Page muốn kết nối.</li>
                <li>Quay lại web — tin nhắn sẽ tự đổ về <strong>Hộp thư</strong>.</li>
              </ol>
            </div>
            <div className="rounded-lg bg-accent-100 p-3 text-accent-900 text-xs">
              <i className="ri-lightbulb-flash-line mr-1" />
              <strong>Lưu ý:</strong> Bạn có thể thêm <strong>vô số</strong> Fanpage. Mỗi Page là một kênh riêng,
              bạn là người quản lý Page đó và có thể trả lời tin nhắn của Page.
            </div>
          </>
        ) : (
          <>
            <p className="leading-relaxed">
              TikTok <strong>chưa mở API tin nhắn công khai</strong> cho bên thứ ba. Hiện tại bạn có thể:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Lưu tên tài khoản TikTok ở đây để <strong>quản lý danh sách</strong> và ghi chú.</li>
              <li>Khi TikTok mở API, hệ thống sẽ tự động kết nối — không cần thao tác thêm.</li>
            </ul>
            <div className="rounded-lg bg-accent-100 p-3 text-accent-900 text-xs">
              <i className="ri-lightbulb-flash-line mr-1" />
              <strong>Gợi ý:</strong> Trong lúc chờ, bạn vẫn có thể thêm TikTok vào danh sách để theo dõi,
              nhân viên sẽ tự trả lời trực tiếp trên ứng dụng TikTok và báo cáo lại sau.
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function AddChannelModal({
  open,
  busy,
  onClose,
  onDone,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onDone: (name: string, platform: ChannelPlatform, externalId: string) => void;
}) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<ChannelPlatform>("facebook");
  const [externalId, setExternalId] = useState("");

  const isTiktok = platform === "tiktok";

  return (
    <Modal
      open={open}
      title="Thêm kênh / Page"
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
            disabled={busy || isTiktok || !name.trim()}
            onClick={() => onDone(name.trim(), platform, externalId.trim())}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang thêm..." : "Thêm kênh"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Nền tảng</label>
          <div className="grid grid-cols-3 gap-2">
            {(["facebook", "telegram", "tiktok"] as ChannelPlatform[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs font-medium cursor-pointer ${
                  platform === p
                    ? "bg-primary-50 text-primary-700 border border-primary-300"
                    : "bg-background-100 text-foreground-600 border border-transparent"
                }`}
              >
                <i className={`${platformMeta[p].icon} text-lg ${platformMeta[p].color}`} />
                {platformMeta[p].label}
              </button>
            ))}
          </div>
        </div>

        {isTiktok ? (
          <div className="px-3 py-2.5 rounded-md bg-accent-100 text-accent-900 text-xs flex items-start gap-2">
            <i className="ri-time-line mt-0.5" />
            <div>
              <p className="font-medium">TikTok API chưa sẵn sàng</p>
              <p className="mt-0.5">Bạn vẫn có thể lưu tên tài khoản để quản lý, chờ cập nhật API sau.</p>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">Tên kênh / Page</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={platform === "facebook" ? "Ví dụ: Fanpage Tổ 1D" : "Ví dụ: Bot CSKH"}
                className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground-700 mb-1.5">
                {platform === "facebook" ? "Page ID" : "Username Bot"}
              </label>
              <input
                type="text"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder={platform === "facebook" ? "1234567890" : "@my_bot"}
                className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <p className="text-xs text-foreground-400">
              Để nhận và gửi tin nhắn thật, hãy dùng nút "Kết nối / Cấp quyền" (OAuth) sau khi thêm.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

function EditChannelModal({
  channel,
  busy,
  onClose,
  onDone,
}: {
  channel: Channel;
  busy: boolean;
  onClose: () => void;
  onDone: (name: string, externalId: string) => void;
}) {
  const [name, setName] = useState(channel.name);
  const [externalId, setExternalId] = useState(channel.externalId ?? "");

  return (
    <Modal
      open
      title={`Sửa / Thay page - ${channel.name}`}
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
            onClick={() => onDone(name.trim(), externalId.trim())}
            className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {busy ? "Đang lưu..." : "Lưu"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Tên kênh / Page</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-sm text-foreground-700 mb-1.5">Page ID / Username Bot</label>
          <input
            type="text"
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border border-background-300 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      </div>
    </Modal>
  );
}