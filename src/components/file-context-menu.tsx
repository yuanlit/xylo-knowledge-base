"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

export interface FileMenuAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export function FileContextMenu({
  x,
  y,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  actions: FileMenuAction[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - bounds.width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - bounds.height - 4))}px`;
    menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [x, y]);

  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const dismissOnScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("scroll", dismissOnScroll, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("scroll", dismissOnScroll, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="文件操作"
      className="tech-context-menu fixed z-50 w-44 max-w-[calc(100vw-8px)] max-h-[calc(100vh-8px)] overflow-y-auto rounded-md border p-1 text-sm shadow-lg"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Tab") {
          event.preventDefault();
          onClose();
          return;
        }
        const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const step = event.key === "ArrowDown" ? 1 : -1;
          buttons[(index + step + buttons.length) % buttons.length]?.focus();
        }
      }}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          disabled={action.disabled}
          onClick={() => {
            onClose();
            action.onSelect();
          }}
          className="tech-menu-item flex w-full items-center gap-2.5 rounded px-3 py-2 text-left outline-none"
          data-destructive={action.destructive || undefined}
        >
          {action.icon && <action.icon size={15} strokeWidth={1.75} aria-hidden="true" />}
          {action.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
