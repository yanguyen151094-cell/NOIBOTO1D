import Avatar from "@/components/base/Avatar";
import type { Customer, Conversation, Channel } from "@/types";
import { platformMeta, formatDateTime } from "@/utils/ui";

interface CustomerPanelProps {
  customer: Customer;
  conversation: Conversation;
  channel: Channel;
}

export default function CustomerPanel({ customer, conversation, channel }: CustomerPanelProps) {
  const meta = platformMeta[channel.platform];

  return (
    <div className="h-full flex flex-col overflow-y-auto cs-scroll">
      <div className="px-4 py-4 border-b border-background-200 text-center">
        <div className="flex justify-center">
          <Avatar name={customer.name} size="lg" />
        </div>
        <h3 className="mt-2 font-heading font-semibold text-foreground-950">{customer.name}</h3>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <i className={`${meta.icon} ${meta.color}`} />
          <span className="text-xs text-foreground-500">
            {meta.label} · {customer.username}
          </span>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide">
            Thông tin
          </p>
          <Row label="ID khách" value={customer.externalId} />
          <Row label="Số điện thoại" value={customer.phone || "Chưa cung cấp"} />
          <Row
            label="Nhân viên phụ trách"
            value={conversation.assignments[conversation.assignments.length - 1]?.staffName || "Chưa phân công"}
          />
          <Row label="Liên hệ đầu tiên" value={formatDateTime(customer.firstContactAt)} />
          <Row label="Tương tác gần nhất" value={formatDateTime(customer.lastInteractionAt)} />
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">
            Nhãn khách hàng
          </p>
          <div className="flex flex-wrap gap-1.5">
            {customer.tags.length > 0 ? (
              customer.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full bg-secondary-100 text-secondary-800"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-foreground-400">Chưa có nhãn</span>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">
            Ghi chú nội bộ
          </p>
          <p className="text-sm text-foreground-600 bg-background-100 rounded-md p-3 leading-relaxed">
            {customer.internalNote || "Chưa có ghi chú."}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">
            Lịch sử chuyển nhân viên
          </p>
          {conversation.assignments.length > 0 ? (
            <ul className="space-y-2">
              {conversation.assignments.map((a, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm text-foreground-800">{a.staffName}</p>
                    <p className="text-[11px] text-foreground-400">{formatDateTime(a.assignedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground-400">Chưa có lịch sử.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-foreground-500 shrink-0">{label}</span>
      <span className="text-xs text-foreground-900 text-right break-all">{value}</span>
    </div>
  );
}