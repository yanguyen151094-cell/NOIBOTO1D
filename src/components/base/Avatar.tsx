import { avatarColor, getInitials } from "@/utils/ui";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  className?: string;
}

const sizes = {
  sm: "w-8 h-8 text-[11px]",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

export default function Avatar({ name, size = "md", online, className = "" }: AvatarProps) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`${sizes[size]} ${avatarColor(name)} rounded-full flex items-center justify-center font-semibold text-white`}
      >
        {getInitials(name)}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background-50" />
      )}
    </div>
  );
}