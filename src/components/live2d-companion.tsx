"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Grip, LoaderCircle, MessageCircle, RotateCw, UsersRound, X } from "lucide-react";
import { IconButton } from "@/components/icon-button";
import characters from "@/lib/companion-characters.json";

const POSITION_KEY = "xylo-companion-position";
const CHARACTER_KEY = "xylo-companion-character";
type Position = { left: number; top: number };

function constrainPosition(next: Position, element: HTMLElement): Position {
  const rect = element.getBoundingClientRect();
  return {
    left: Math.max(8, Math.min(next.left, window.innerWidth - rect.width - 8)),
    top: Math.max(8, Math.min(next.top, window.innerHeight - rect.height - 8)),
  };
}

export function Live2DCompanion({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<Position | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; origin: Position } | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("loading");
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [pageVisible, setPageVisible] = useState(true);
  const [characterId, setCharacterId] = useState(() => {
    try {
      const saved = localStorage.getItem(CHARACTER_KEY);
      if (characters.some((item) => item.id === saved)) return saved!;
    } catch { /* Use the default character when storage is unavailable. */ }
    return characters[0].id;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const character = characters.find((item) => item.id === characterId)!;
  const isExtension = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  const frameUrl = `${isExtension ? chrome.runtime.getURL("companion.html") : "/companion.html"}?character=${characterId}`;

  const selectCharacter = (id: string) => {
    setPickerOpen(false);
    if (id === characterId) return;
    setStatus("loading");
    setMessage("");
    setCharacterId(id);
    try { localStorage.setItem(CHARACTER_KEY, id); } catch { /* Keep the selection in memory when storage is unavailable. */ }
  };

  useEffect(() => {
    if (!pickerOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", escape);
    };
  }, [pickerOpen]);

  const moveTo = (next: Position) => {
    const bounded = constrainPosition(next, containerRef.current!);
    positionRef.current = bounded;
    setPosition(bounded);
  };
  const savePosition = () => {
    try { localStorage.setItem(POSITION_KEY, JSON.stringify(positionRef.current)); } catch { /* Keep the position in memory when storage is unavailable. */ }
  };
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const origin = { left: rect.left, top: rect.top };
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin };
    moveTo(origin);
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    moveTo({ left: drag.origin.left + event.clientX - drag.x, top: drag.origin.top + event.clientY - drag.y });
  };
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    savePosition();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    const clamp = (next: Position) => {
      const bounded = constrainPosition(next, containerRef.current!);
      positionRef.current = bounded;
      setPosition(bounded);
    };
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) clamp(saved);
    } catch { /* Use the default position when no saved position is available. */ }
    const resize = () => {
      if (positionRef.current) clamp(positionRef.current);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const visibility = () => {
      setPageVisible(!document.hidden);
      if (!document.hidden) {
        setStatus("loading");
        setRevision((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  useEffect(() => {
    let pendingFrame = 0;
    let latest: PointerEvent | null = null;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || document.hidden) return;
      latest = event;
      if (pendingFrame) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        const frame = frameRef.current;
        if (!frame || !latest) return;
        const rect = frame.getBoundingClientRect();
        frame.contentWindow?.postMessage({
          type: "xylo:companion-pointer",
          x: (latest.clientX - rect.left) * 220 / rect.width,
          y: (latest.clientY - rect.top) * 300 / rect.height,
        }, "*");
      });
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || event.data?.type !== "xylo:companion-status") return;
      if (["loading", "success", "fail"].includes(event.data.status)) setStatus(event.data.status);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("message", receive);
    const timeout = window.setTimeout(() => setStatus((current) => current === "loading" ? "fail" : current), 20000);
    return () => {
      cancelAnimationFrame(pendingFrame);
      clearTimeout(timeout);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("message", receive);
    };
  }, [revision, characterId]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timeout);
  }, [message]);

  return createPortal(
    <aside ref={containerRef} className="live2d-companion" style={position ? { left: position.left, top: position.top, right: "auto", bottom: "auto" } : undefined} aria-label="看板娘" data-pointer-effects="off" data-dragging={dragging}>
      {message && <div className="companion-message" role="status">{message}</div>}
      <div className="companion-controls">
        <IconButton title="拖动看板娘" size="sm" className="companion-drag-handle" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}><Grip strokeWidth={1.75} /></IconButton>
        <div ref={pickerRef} className="companion-character-picker">
          <IconButton title="切换角色" size="sm" aria-expanded={pickerOpen} aria-haspopup="true" onClick={() => setPickerOpen(!pickerOpen)}><UsersRound strokeWidth={1.75} /></IconButton>
          {pickerOpen && <div className="companion-character-options" role="group" aria-label="选择角色">
            {characters.map((item) => <button key={item.id} type="button" aria-pressed={item.id === characterId} onClick={() => selectCharacter(item.id)}>
              <span>{item.name}</span>
              {item.id === characterId && <Check size={14} />}
            </button>)}
          </div>}
        </div>
        <IconButton title="打个招呼" size="sm" onClick={() => {
          const messages = ["我在这里陪你，把灵感慢慢写下来吧。", "今天又收集了哪些新想法？", "记得偶尔伸个懒腰，休息一下。"];
          setMessage(messages[Math.floor(Math.random() * messages.length)]);
        }}><MessageCircle strokeWidth={1.75} /></IconButton>
        <IconButton title="收起看板娘" size="sm" onClick={onClose}><X strokeWidth={1.75} /></IconButton>
      </div>
      {status === "loading" && <div className="companion-status" role="status"><LoaderCircle size={17} className="animate-spin" /> 看板娘加载中</div>}
      {status === "fail" && <div className="companion-status" role="alert">
        <span>角色加载失败</span>
        <IconButton title="重新加载看板娘" size="sm" onClick={() => { setStatus("loading"); setRevision((value) => value + 1); }}><RotateCw /></IconButton>
      </div>}
      {pageVisible && <iframe key={`${characterId}-${revision}`} ref={frameRef} src={frameUrl} title={`${character.name} 看板娘`} sandbox={isExtension ? undefined : "allow-scripts"} className="companion-frame" />}
    </aside>, document.body,
  );
}
