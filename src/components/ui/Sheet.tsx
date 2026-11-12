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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: "bottom" | "center";
  children: ReactNode;
  testId?: string;
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
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 w-full max-w-md bg-surface p-0 text-ink shadow-sheet",
        variant === "bottom"
          ? "fixed inset-x-0 bottom-0 mx-auto max-h-[90vh] overflow-y-auto rounded-t-sheet"
          : "fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] rounded-sheet",
      )}
    >
      {open && children}
    </dialog>
  );
}
