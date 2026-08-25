import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  tone?: "primary" | "accent" | "secondary" | "warning" | "default";
  hint?: string;
}

const tones: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-800",
  secondary: "bg-secondary-100 text-secondary-800",
  warning: "bg-amber-100 text-amber-700",
  default: "bg-background-100 text-foreground-600",
};

export default function StatCard({ label, value, icon, tone = "default", hint }: StatCardProps) {
  return (
    <div className="bg-background-50 rounded-lg border border-background-200 p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <i className={`${icon} text-lg`} />
        </div>
      </div>
      <p className="mt-3 font-heading text-2xl md:text-3xl font-bold text-foreground-950">
        {value}
      </p>
      <p className="mt-1 text-sm text-foreground-500">{label}</p>
      {hint && <p className="mt-1 text-xs text-foreground-400">{hint}</p>}
    </div>
  );
}