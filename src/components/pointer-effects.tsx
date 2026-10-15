"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, useSpring } from "motion/react";
import { ConstellationBackground } from "@/components/constellation-background";
import { Live2DCompanion } from "@/components/live2d-companion";

const STORAGE_KEY = "xylo-pointer-effects";
const LINES_KEY = "xylo-constellation";
const COMPANION_KEY = "xylo-companion";
const PointerEffectsContext = createContext({
  enabled: true, toggle: () => {},
  linesEnabled: true, toggleLines: () => {},
  companionEnabled: true, toggleCompanion: () => {},
});

export function usePointerEffects() {
  return useContext(PointerEffectsContext);
}

function PointerOverlay({ enabled }: { enabled: boolean }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const opacity = useMotionValue(0);
  const spring = { stiffness: 430, damping: 34, mass: 0.45 };
  const targetX = useSpring(x, spring);
  const targetY = useSpring(y, spring);
  const targetWidth = useSpring(width, spring);
  const targetHeight = useSpring(height, spring);

  useEffect(() => {
    let pendingFrame = 0;
    let latestEvent: PointerEvent | null = null;
    const hide = () => {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
      latestEvent = null;
      opacity.set(0);
    };
    const move = (event: PointerEvent) => {
      if (!enabled || event.pointerType !== "mouse") {
        hide();
        return;
      }
      const element = event.target instanceof Element ? event.target : null;
      if (!element || element.closest("input, textarea, select, iframe, [contenteditable='true'], [data-pointer-effects='off']")) {
        hide();
        return;
      }
      latestEvent = event;
      if (pendingFrame) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        const latest = latestEvent;
        if (!latest || !(latest.target instanceof Element)) return;
        const target = latest.target.closest("button, a, [role='treeitem'], [role='menuitem']");
        if (!target || target.matches(":disabled")) { opacity.set(0); return; }
        const bounds = target.getBoundingClientRect();
        if (opacity.get() === 0) {
          targetX.jump(bounds.left);
          targetY.jump(bounds.top);
          targetWidth.jump(bounds.width);
          targetHeight.jump(bounds.height);
        }
        x.set(bounds.left);
        y.set(bounds.top);
        width.set(bounds.width);
        height.set(bounds.height);
        opacity.set(1);
      });
    };
    const leaveSurface = (event: PointerEvent) => {
      if (event.relatedTarget === null) hide();
    };
    window.addEventListener("pointermove", move, { passive: true, capture: true });
    window.addEventListener("pointerover", move, { passive: true, capture: true });
    window.addEventListener("pointerout", leaveSurface, true);
    window.addEventListener("pointercancel", hide);
    window.addEventListener("dragstart", hide);
    document.addEventListener("pointerleave", hide);
    document.addEventListener("visibilitychange", hide);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    window.addEventListener("resize", hide);
    return () => {
      hide();
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerover", move, true);
      window.removeEventListener("pointerout", leaveSurface, true);
      window.removeEventListener("pointercancel", hide);
      window.removeEventListener("dragstart", hide);
      document.removeEventListener("pointerleave", hide);
      document.removeEventListener("visibilitychange", hide);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
      window.removeEventListener("resize", hide);
    };
  }, [enabled, x, y, width, height, opacity, targetX, targetY, targetWidth, targetHeight]);

  return createPortal(
    <div className="pointer-effects" aria-hidden="true">
      <motion.div className="pointer-target" style={{ x: targetX, y: targetY, width: targetWidth, height: targetHeight, opacity }} />
    </div>,
    document.body,
  );
}

export function PointerEffectsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const [linesEnabled, setLinesEnabled] = useState(true);
  const [companionEnabled, setCompanionEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Portals can only be created after the client document is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const restore = () => {
      const read = (key: string) => {
        try {
          const preference = localStorage.getItem(key);
          return preference === null ? !reducedMotion.matches : preference === "true";
        } catch {
          return !reducedMotion.matches;
        }
      };
      setEnabled(read(STORAGE_KEY));
      setLinesEnabled(read(LINES_KEY));
      setCompanionEnabled(read(COMPANION_KEY));
    };
    restore();
    reducedMotion.addEventListener("change", restore);
    return () => reducedMotion.removeEventListener("change", restore);
  }, []);
  const update = (key: string, next: boolean, setter: (value: boolean) => void) => {
    setter(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // A blocked storage context still supports the in-memory toggle.
    }
  };
  const toggle = () => update(STORAGE_KEY, !enabled, setEnabled);
  const toggleLines = () => update(LINES_KEY, !linesEnabled, setLinesEnabled);
  const toggleCompanion = () => update(COMPANION_KEY, !companionEnabled, setCompanionEnabled);
  return (
    <PointerEffectsContext.Provider value={{ enabled, toggle, linesEnabled, toggleLines, companionEnabled, toggleCompanion }}>
      {children}
      {mounted && enabled && <PointerOverlay enabled={enabled} />}
      {mounted && linesEnabled && <ConstellationBackground />}
      {mounted && companionEnabled && <Live2DCompanion onClose={toggleCompanion} />}
    </PointerEffectsContext.Provider>
  );
}
