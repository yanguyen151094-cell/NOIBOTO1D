import { useMemo, type CSSProperties } from "react";
import type { GiftBurst } from "./gifts";

type ParticleStyle = CSSProperties & { [key: string]: string | number | undefined };

interface Particle {
  id: number;
  emoji: string;
  left: number;
  top: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  rot: number;
  dx: number;
  dy: number;
  anim: string;
}

function makeParticles(burst: GiftBurst): Particle[] {
  const anim =
    burst.mode === "fall" ? "gift-fall" : burst.mode === "pop" ? "gift-pop" : "gift-rise";
  const list: Particle[] = [];
  for (let i = 0; i < burst.count; i++) {
    const isPop = burst.mode === "pop";
    list.push({
      id: i,
      emoji: burst.emoji,
      left: isPop ? 50 + (Math.random() - 0.5) * 14 : Math.random() * 100,
      top: isPop ? 50 + (Math.random() - 0.5) * 14 : burst.mode === "fall" ? -6 : 94 + Math.random() * 6,
      delay: Math.random() * 0.9,
      duration: 2.2 + Math.random() * 1.6,
      size: 24 + Math.random() * 30,
      drift: (Math.random() - 0.5) * 240,
      rot: (Math.random() - 0.5) * 280,
      dx: (Math.random() - 0.5) * 380,
      dy: -140 - Math.random() * 260,
      anim,
    });
  }
  return list;
}

function Burst({ burst }: { burst: GiftBurst }) {
  const particles = useMemo(() => makeParticles(burst), [burst]);

  return (
    <>
      {particles.map((p) => {
        const style: ParticleStyle = {
          left: `${p.left}%`,
          top: `${p.top}%`,
          fontSize: `${p.size}px`,
          animation: `${p.anim} ${p.duration}s ${p.delay}s ease-out forwards`,
          "--drift": `${p.drift}px`,
          "--rot": `${p.rot}deg`,
          "--dx": `${p.dx}px`,
          "--dy": `${p.dy}px`,
        };
        return (
          <span key={p.id} className="absolute will-change-transform" style={style}>
            {p.emoji}
          </span>
        );
      })}
      <div
        className="absolute top-24 left-1/2 text-center whitespace-nowrap"
        style={{ animation: "gift-banner 4s ease-out forwards" }}
      >
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground-950/80 text-background-50 text-sm font-semibold backdrop-blur-sm">
          <span className="text-xl leading-none">{burst.emoji}</span>
          <span>
            {burst.senderName} đã tặng {burst.label}
          </span>
        </span>
      </div>
    </>
  );
}

interface GiftEffectsProps {
  bursts: GiftBurst[];
}

export default function GiftEffects({ bursts }: GiftEffectsProps) {
  return (
    <div className="fixed inset-0 z-[70] pointer-events-none overflow-hidden">
      {bursts.map((burst) => (
        <Burst key={burst.id} burst={burst} />
      ))}
    </div>
  );
}