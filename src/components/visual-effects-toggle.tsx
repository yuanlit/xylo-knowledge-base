"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Network, Scan, UserRound } from "lucide-react";
import { IconButton } from "@/components/icon-button";
import { usePointerEffects } from "@/components/pointer-effects";

export function VisualEffectsToggle() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const effects = usePointerEffects();
  const items = [
    { label: "悬停高亮", icon: Scan, checked: effects.enabled, toggle: effects.toggle },
    { label: "星网连线", icon: Network, checked: effects.linesEnabled, toggle: effects.toggleLines },
    { label: "看板娘", icon: UserRound, checked: effects.companionEnabled, toggle: effects.toggleCompanion },
  ];
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return (
    <div ref={containerRef} className="visual-effects-toggle" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      <IconButton title="视觉特效" size="sm" onClick={() => {
        const rect = containerRef.current!.getBoundingClientRect();
        setPosition({ top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 150)), left: Math.max(8, Math.min(rect.left, window.innerWidth - 220)) });
        setOpen(!open);
      }} aria-expanded={open} aria-pressed={effects.enabled || effects.linesEnabled || effects.companionEnabled}>
        <Sparkles strokeWidth={1.75} />
      </IconButton>
      {open && createPortal(<div ref={panelRef} style={position} className="visual-effects-panel" role="group" aria-label="视觉特效" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
        {items.map((item) => <label key={item.label} className="visual-effect-option">
          <item.icon size={15} strokeWidth={1.75} />
          <span>{item.label}</span>
          <input type="checkbox" role="switch" checked={item.checked} onChange={item.toggle} />
        </label>)}
      </div>, document.body)}
    </div>
  );
}
