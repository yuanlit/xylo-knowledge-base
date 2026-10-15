"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/contexts/theme-context";
import type CanvasNest from "canvas-nest.js";

export function ConstellationBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mode } = useTheme();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let disposed = false;
    let instance: CanvasNest | null = null;
    let target: { x: number; y: number } | null = null;
    const move = (event: PointerEvent) => {
      if (event.pointerType === "mouse") target = { x: event.clientX, y: event.clientY };
    };
    const leave = () => { target = null; };
    const stop = () => {
      if (!instance) return;
      // canvas-nest uses legacy window handlers; preserve other integrations on teardown.
      instance.onmousemove = window.onmousemove;
      instance.onmouseout = window.onmouseout;
      instance.destroy();
      instance = null;
    };
    const start = async () => {
      const { default: CanvasNest } = await import("canvas-nest.js");
      if (disposed || document.hidden || instance) return;
      const color = mode === "dark" ? "83,212,227" : "8,126,145";
      const nest = new CanvasNest(element, {
        color, pointColor: color,
        opacity: mode === "dark" ? 0.6 : 0.4,
        count: Math.min(150, Math.max(55, Math.round(window.innerWidth * window.innerHeight / 10000))),
        zIndex: 0,
      });
      instance = nest;
      window.onmousemove = nest.onmousemove;
      window.onmouseout = nest.onmouseout;
      nest.points.forEach((point) => {
        point.xa *= 0.3;
        point.ya *= 0.3;
        point.max = 14000;
      });
      nest.current.max = 50000;
      const draw = nest.drawCanvas.bind(nest);
      nest.drawCanvas = () => {
        if (target) {
          nest.current.x = (nest.current.x ?? target.x) + (target.x - (nest.current.x ?? target.x)) * 0.045;
          nest.current.y = (nest.current.y ?? target.y) + (target.y - (nest.current.y ?? target.y)) * 0.045;
        } else {
          nest.current.x = null;
          nest.current.y = null;
        }
        draw();
      };
    };
    const resume = () => void start().catch((error) => console.error("Failed to initialize canvas-nest", error));
    const visibility = () => { if (document.hidden) stop(); else resume(); };
    resume();
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      stop();
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [mode]);

  return createPortal(<div ref={containerRef} className="constellation-background" aria-hidden="true" />, document.body);
}
