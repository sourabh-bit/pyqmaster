import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  threshold?: number;
  moveThreshold?: number;
}

export function useLongPress({
  onLongPress,
  onClick,
  threshold = 350,
  moveThreshold = 15,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  const isActiveRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isActiveRef.current = false;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      
      clear();
      isLongPressRef.current = false;
      hasMovedRef.current = false;
      isActiveRef.current = true;
      startPosRef.current = { x: e.clientX, y: e.clientY };

      timerRef.current = setTimeout(() => {
        if (!hasMovedRef.current && isActiveRef.current) {
          isLongPressRef.current = true;
          onLongPress();
        }
      }, threshold);
    },
    [onLongPress, threshold, clear]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPosRef.current || !isActiveRef.current) return;

      const dx = Math.abs(e.clientX - startPosRef.current.x);
      const dy = Math.abs(e.clientY - startPosRef.current.y);

      if (dx > moveThreshold || dy > moveThreshold) {
        hasMovedRef.current = true;
        clear();
      }
    },
    [moveThreshold, clear]
  );

  const onPointerUp = useCallback(() => {
    const wasActive = isActiveRef.current;
    const wasLongPress = isLongPressRef.current;
    const hasMoved = hasMovedRef.current;
    
    clear();
    startPosRef.current = null;

    if (wasActive && !wasLongPress && !hasMoved && onClick) {
      onClick();
    }
  }, [clear, onClick]);

  const onPointerCancel = useCallback(() => {
    clear();
    startPosRef.current = null;
    hasMovedRef.current = false;
  }, [clear]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave: onPointerCancel,
    onContextMenu,
  };
}
