"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function BarModal({ titleId, children, onClose }: { titleId: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; trigger?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className="bar-modal bar-surface" onClose={onClose}>
    <div className="bar-modal-top"><button type="button" autoFocus onClick={onClose}>关闭</button></div>
    <div className="bar-modal-content bar-stack">{children}</div>
  </dialog>;
}
