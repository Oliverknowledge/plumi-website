"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

type Point = { x: number; y: number };
type Drag = { id: number; start: Point; origin: Point; moved: boolean };

/** Pointer moves update only the floating element, leaving the iframe untouched. */
export function useCalculatorDrag<T extends HTMLElement>(visible: boolean) {
  const ref = useRef<T>(null);
  const position = useRef<Point | null>(null);
  const gesture = useRef<Drag | null>(null);
  const ignoreClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  const place = useCallback((point: Point) => {
    const element = ref.current;
    if (!element || !element.offsetWidth || element.dataset.fullscreen === "true") return;
    // Leave room for the tilted picture and the controls outside the shell.
    const margin = 24;
    const next = {
      x: Math.max(margin, Math.min(point.x, innerWidth - element.offsetWidth - margin)),
      y: Math.max(margin, Math.min(point.y, innerHeight - element.offsetHeight - margin)),
    };
    position.current = next;
    Object.assign(element.style, { left: `${next.x}px`, top: `${next.y}px`, right: "auto", bottom: "auto" });
  }, []);

  const clamp = useCallback(() => {
    if (position.current) place(position.current);
  }, [place]);

  useEffect(() => {
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [clamp]);

  useEffect(() => {
    if (visible) clamp();
  }, [visible, clamp]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ignoreClick.current = false;
    gesture.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { x: rect.x, y: rect.y }, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.start.x, dy = event.clientY - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; setDragging(true); }
    event.preventDefault();
    place({ x: drag.origin.x + dx, y: drag.origin.y + dy });
  };

  const finish = (event: PointerEvent<HTMLElement>) => {
    if (gesture.current?.id !== event.pointerId) return;
    ignoreClick.current = gesture.current.moved;
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const directions: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    const direction = directions[event.key];
    if (!direction || !ref.current) return;
    event.preventDefault();
    const rect = ref.current.getBoundingClientRect(), step = event.shiftKey ? 32 : 12;
    place({ x: rect.x + direction.x * step, y: rect.y + direction.y * step });
  };

  return {
    ref, dragging, clamp,
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish, onLostPointerCapture: finish, onKeyDown },
    consumeDragClick: () => { const ignored = ignoreClick.current; ignoreClick.current = false; return ignored; },
  };
}
