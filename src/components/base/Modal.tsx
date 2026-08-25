import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-50 rounded-lg w-full max-w-md animate-slide-up shadow-sm border border-background-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-background-100 shrink-0">
          <h3 className="font-heading font-semibold text-foreground-950 pr-3">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-100 cursor-pointer shrink-0"
            aria-label="Đóng"
          >
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto cs-scroll">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-background-100 flex justify-end gap-2 flex-wrap shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}