import { GIFTS, type GiftItem } from "./gifts";

interface GiftBarProps {
  onSend: (gift: GiftItem) => void;
}

export default function GiftBar({ onSend }: GiftBarProps) {
  return (
    <div className="rounded-lg border border-background-200 bg-background-50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
          <i className="ri-vip-crown-line text-base" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground-900">Tặng hoa & cổ vũ</p>
          <p className="text-[11px] text-foreground-500">Bấm để tặng hoa cho người đang hát 🌹</p>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto cs-scroll pb-1">
        {GIFTS.map((gift) => (
          <button
            key={gift.id}
            type="button"
            onClick={() => onSend(gift)}
            title={`Tặng ${gift.label}`}
            className="flex flex-col items-center justify-center gap-1 min-w-[64px] px-2 py-2 rounded-lg border border-background-200 bg-background-50 hover:bg-accent-50 hover:border-accent-300 transition-colors cursor-pointer shrink-0"
          >
            <span className="text-2xl leading-none">{gift.emoji}</span>
            <span className="text-[11px] text-foreground-600 whitespace-nowrap">{gift.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}