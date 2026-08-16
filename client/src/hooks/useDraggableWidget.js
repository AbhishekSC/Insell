import { useRef, useState } from "react";

// Pointer-Events-based free drag (mouse + touch in one API), for any small
// floating element positioned via `position: fixed`. Position stays null —
// letting the caller's default CSS position apply — until the first actual
// drag; a small movement threshold distinguishes a genuine drag from a tap,
// so `onTap` fires for a plain click/tap without also being treated as a
// (zero-distance) drag. setPointerCapture keeps move/up events firing on the
// dragged element even if the pointer leaves its bounds mid-drag.
export function useDraggableWidget({ onTap } = {}) {
  const elementRef = useRef(null);
  const dragInfo = useRef({
    dragging: false,
    moved: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });
  const [position, setPosition] = useState(null);

  const onPointerDown = (e) => {
    const el = elementRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragInfo.current = {
      dragging: true,
      moved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const info = dragInfo.current;
    if (!info.dragging) return;

    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      info.moved = true;
    }
    if (!info.moved) return;

    const el = elementRef.current;
    const width = el?.offsetWidth || 0;
    const height = el?.offsetHeight || 0;
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const maxTop = Math.max(8, window.innerHeight - height - 8);
    setPosition({
      left: Math.min(Math.max(8, info.startLeft + dx), maxLeft),
      top: Math.min(Math.max(8, info.startTop + dy), maxTop),
    });
  };

  const onPointerUp = (e) => {
    const info = dragInfo.current;
    const wasDrag = info.moved;
    dragInfo.current = { ...info, dragging: false, moved: false };
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (!wasDrag) onTap?.();
  };

  const style = position ? { left: position.left, top: position.top, right: "auto", bottom: "auto" } : undefined;

  return {
    elementRef,
    style,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
