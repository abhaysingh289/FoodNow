"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Modal built on the native <dialog> (focus trap, Esc, top layer for free).
 * `bottom` slides up as a sheet; `center` is a compact confirm dialog.
 */
export function Sheet({
  open,
  onClose,
  title,
  variant = "bottom",
  children,
  testId,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: "bottom" | "center";
  children: ReactNode;
  testId?: string;
  /** false removes every dismiss path (close button, Esc, backdrop) so the content must resolve it. */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 bg-surface p-0 text-ink shadow-sheet",
        variant === "bottom"
          ? // Mobile: top-rounded sheet pinned to the bottom. Desktop: centred modal.
            "fixed inset-x-0 top-auto bottom-0 mx-auto max-h-[90vh] w-full max-w-none overflow-y-auto rounded-t-sheet md:inset-0 md:m-auto md:h-fit md:max-h-[85vh] md:max-w-lg md:rounded-sheet"
          : "fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-sheet",
      )}
    >
      {open && dismissible && (
        <button
          type="button"
          aria-label="Close"
          data-testid="sheet-close"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-chip bg-surface/95 text-ink shadow-[0_1px_4px_rgb(0_0_0/0.12)] hover:bg-fill md:h-9 md:w-9"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {open && children}
    </dialog>
  );
}
