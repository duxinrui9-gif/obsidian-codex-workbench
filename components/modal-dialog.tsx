"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function ModalDialog({ open, onClose, labelledBy, className, initialFocusRef, children }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const programmaticCloseRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.open) dialog.showModal();
      const frame = window.requestAnimationFrame(() => initialFocusRef?.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
    if (dialog.open) {
      programmaticCloseRef.current = true;
      dialog.close();
    }
  }, [initialFocusRef, open]);

  function restoreFocus() {
    window.requestAnimationFrame(() => {
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className={className}
      aria-labelledby={labelledBy}
      aria-modal="true"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={() => {
        const programmatic = programmaticCloseRef.current;
        programmaticCloseRef.current = false;
        restoreFocus();
        if (!programmatic) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
