interface ConversionFunnelProps {
  newCustomers: number;
  registeredCustomers: number;
  totalDeposits: number;
  totalBets: number;
}

function formatMoney(n: number): string {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function formatCount(n: number): string {
  return n.toLocaleString("vi-VN");
}

interface StageProps {
  label: string;
  value: string;
  width: string;
  colorClass: string;
  icon: string;
}

function Stage({ label, value, width, colorClass, icon }: StageProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`${colorClass} text-white rounded-lg flex items-center justify-center gap-2 py-3 px-4 transition-all`}
        style={{ width }}
      >
        <i className={`${icon} text-base shrink-0`} />
        <div className="leading-tight text-center">
          <p className="text-xs font-medium opacity-90 whitespace-nowrap">{label}</p>
          <p className="text-sm font-bold whitespace-nowrap">{value}</p>
        </div>
      </div>
    </div>
  );
}

interface ConnectorProps {
  note?: string;
}

function Connector({ note }: ConnectorProps) {
  return (
    <div className="flex flex-col items-center py-1">
      <i className="ri-arrow-down-s-line text-foreground-400 text-sm leading-none" />
      {note && (
        <span className="text-[11px] text-foreground-500 bg-background-100 rounded-full px-2 py-0.5 mt-0.5 whitespace-nowrap">
          {note}
        </span>
      )}
    </div>
  );
}

export default function ConversionFunnel({
  newCustomers,
  registeredCustomers,
  totalDeposits,
  totalBets,
}: ConversionFunnelProps) {
  const registrationRate =
    newCustomers > 0 ? Math.round((registeredCustomers / newCustomers) * 100) : 0;
  const betRound = totalDeposits > 0 ? totalBets / totalDeposits : 0;

  return (
    <div className="flex flex-col items-center">
      <Stage
        label="Khách mới"
        value={`${formatCount(newCustomers)} khách`}
        width="100%"
        colorClass="bg-primary-500"
        icon="ri-user-add-line"
      />
      <Connector note={newCustomers > 0 ? `Tỷ lệ đăng ký ${registrationRate}%` : undefined} />
      <Stage
        label="Khách đăng ký"
        value={`${formatCount(registeredCustomers)} khách`}
        width="82%"
        colorClass="bg-primary-400"
        icon="ri-user-heart-line"
      />
      <Connector />
      <Stage
        label="Nạp tiền"
        value={formatMoney(totalDeposits)}
        width="64%"
        colorClass="bg-accent-500"
        icon="ri-bank-card-line"
      />
      <Connector note={totalDeposits > 0 ? `Vòng cược ${betRound.toFixed(2)} lần` : undefined} />
      <Stage
        label="Cược"
        value={formatMoney(totalBets)}
        width="46%"
        colorClass="bg-secondary-500"
        icon="ri-coins-line"
      />
    </div>
  );
}