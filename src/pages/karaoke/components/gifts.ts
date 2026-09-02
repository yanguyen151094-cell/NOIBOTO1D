export type GiftMode = "rise" | "fall" | "pop";

export interface GiftItem {
  id: string;
  emoji: string;
  label: string;
  mode: GiftMode;
  count: number;
}

export interface GiftBurst {
  id: string;
  emoji: string;
  label: string;
  senderName: string;
  mode: GiftMode;
  count: number;
}

export const GIFTS: GiftItem[] = [
  { id: "rose", emoji: "🌹", label: "Hoa hồng", mode: "rise", count: 16 },
  { id: "bouquet", emoji: "💐", label: "Bó hoa", mode: "rise", count: 14 },
  { id: "heart", emoji: "❤️", label: "Trái tim", mode: "rise", count: 18 },
  { id: "kiss", emoji: "😘", label: "Thả tim", mode: "rise", count: 12 },
  { id: "applause", emoji: "👏", label: "Vỗ tay", mode: "pop", count: 14 },
  { id: "party", emoji: "🎉", label: "Pháo bông", mode: "pop", count: 16 },
  { id: "gift", emoji: "🎁", label: "Quà", mode: "rise", count: 10 },
  { id: "star", emoji: "⭐", label: "Sao", mode: "fall", count: 18 },
  { id: "fire", emoji: "🔥", label: "Cháy", mode: "pop", count: 12 },
  { id: "crown", emoji: "👑", label: "Vương miện", mode: "rise", count: 8 },
  { id: "cheers", emoji: "🍻", label: "Cụng ly", mode: "pop", count: 10 },
];