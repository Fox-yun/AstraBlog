"use client";
import { useEffect } from "react";

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.href === window.location.href) return;
      if (!window.confirm("有未保存的修改，确定离开？")) { event.preventDefault(); event.stopPropagation(); }
    };
    // Also protect same-document Back/Forward, which does not fire beforeunload.
    const currentUrl = window.location.href;
    if (!window.history.state?.barEditorGuard) {
      window.history.pushState({ ...window.history.state, barEditorGuard: true }, "", currentUrl);
    }
    const pop = () => {
      if (window.confirm("有未保存的修改，确定离开？")) {
        window.removeEventListener("popstate", pop);
        window.history.back();
      } else window.history.pushState({ ...window.history.state, barEditorGuard: true }, "", currentUrl);
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", pop);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", pop);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
}
