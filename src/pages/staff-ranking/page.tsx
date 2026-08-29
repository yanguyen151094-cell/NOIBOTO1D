import { useStaffRanking, RANKING_WEIGHTS, type StaffRankingItem } from "@/hooks/useStaffRanking";

function formatMoney(n: number): string {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function formatCount(n: number): string {
  return n.toLocaleString("vi-VN");
}

function Avatar({ item }: { item: StaffRankingItem }) {
  if (item.avatar) {
    return (
      <img
        src={item.avatar}
        alt={item.name}
        className="w-10 h-10 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center shrink-0 font-semibold text-sm">
      {item.name.charAt(0).toUpperCase()}
    </div>
  );
}

const MEDALS = [
  { rank: 1, label: "Nhất", color: "text-amber-600", bg: "bg-amber-100", ring: "ring-amber-300", icon: "ri-medal-line" },
  { rank: 2, label: "Nhì", color: "text-slate-500", bg: "bg-slate-100", ring: "ring-slate-300", icon: "ri-medal-2-line" },
  { rank: 3, label: "Ba", color: "text-orange-600", bg: "bg-orange-100", ring: "ring-orange-300", icon: "ri-medal-line" },
];

export default function StaffRankingPage() {
  const { items, loading, error, reload } = useStaffRanking();

  const top3 = items.slice(0, 3);

  return (
    <div className="h-full overflow-y-auto cs-scroll p-4 md:p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground-950">
            Bảng xếp hạng nhân viên
          </h1>
          <p className="text-sm text-foreground-500 mt-0.5">
            Xếp hạng theo hiệu suất tổng hợp toàn thời gian, dựa trên số liệu nhân viên.
          </p>
        </div>
        <div className="text-xs text-foreground-500 bg-background-100 rounded-lg px-3 py-2 leading-snug">
          Điểm = Khách mới ×{RANKING_WEIGHTS.newCustomer} + (Tổng nạp + Tổng cược) ÷ 1.000.000đ
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
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <i className="ri-trophy-line text-3xl text-foreground-300" />
          <p className="mt-3 text-sm text-foreground-500">Chưa có nhân viên nào.</p>
        </div>
      ) : (
        <>
          {/* Podium top 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {top3.map((item, idx) => {
              const medal = MEDALS[idx];
              return (
                <div
                  key={item.id}
                  className={`bg-background-50 rounded-lg border border-background-200 p-4 flex flex-col items-center text-center ring-1 ${medal.ring}`}
                >
                  <div className={`w-12 h-12 rounded-full ${medal.bg} ${medal.color} flex items-center justify-center mb-2`}>
                    <i className={`${medal.icon} text-2xl`} />
                  </div>
                  <p className={`text-xs font-semibold ${medal.color} uppercase tracking-wide`}>
                    Hạng {medal.rank} — {medal.label}
                  </p>
                  <div className="my-2">
                    <Avatar item={item} />
                  </div>
                  <p className="text-sm font-semibold text-foreground-900">{item.name}</p>
                  <p className="text-lg font-bold text-primary-600 mt-1">
                    {item.score.toLocaleString("vi-VN")} điểm
                  </p>
                  <p className="text-[11px] text-foreground-500 mt-1">
                    {formatCount(item.newCustomers)} khách mới · {formatMoney(item.totalBets)} cược
                  </p>
                </div>
              );
            })}
          </div>

          {/* Full ranking table */}
          <div className="bg-background-50 rounded-lg border border-background-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-background-200 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground-900">Bảng xếp hạng đầy đủ</p>
              <span className="text-xs text-foreground-500">{items.length} nhân viên</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-background-100 text-left text-xs text-foreground-500">
                    <th className="px-4 py-3 font-semibold w-16">Hạng</th>
                    <th className="px-4 py-3 font-semibold">Nhân viên</th>
                    <th className="px-4 py-3 font-semibold text-right">Khách mới</th>
                    <th className="px-4 py-3 font-semibold text-right">Tổng nạp</th>
                    <th className="px-4 py-3 font-semibold text-right">Tổng cược</th>
                    <th className="px-4 py-3 font-semibold text-right">Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="border-t border-background-100 hover:bg-background-50"
                    >
                      <td className="px-4 py-3">
                        <RankBadge rank={idx + 1} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar item={item} />
                          <div>
                            <p className="text-foreground-900 font-medium">
                              {item.name}
                              {!item.active && (
                                <span className="ml-2 text-[10px] text-foreground-400 bg-background-100 rounded-full px-2 py-0.5">
                                  Đã nghỉ
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-foreground-700">
                        {formatCount(item.newCustomers)}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground-700">
                        {formatMoney(item.totalDeposits)}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground-700">
                        {formatMoney(item.totalBets)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary-600">
                        {item.score.toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const medal = MEDALS[rank - 1];
    return (
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${medal.bg} ${medal.color} text-xs font-bold`}
      >
        {rank}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 text-xs font-medium text-foreground-500">
      {rank}
    </span>
  );
}