import { useCallback, useRef, useState } from 'react';

interface Props {
  orientation: 'vertical' | 'horizontal'; // vertical = drag left/right (col resize)
  onResize: (deltaPx: number) => void;
}

export function ResizableSplitter({ orientation, onResize }: Props) {
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    lastPos.current = orientation === 'vertical' ? e.clientX : e.clientY;
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [orientation]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const pos = orientation === 'vertical' ? e.clientX : e.clientY;
    const delta = pos - lastPos.current;
    lastPos.current = pos;
    onResize(delta);
  }, [dragging, orientation, onResize]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }, []);

  return (
    <div
      className={`splitter ${orientation === 'horizontal' ? 'horizontal' : ''} ${dragging ? 'dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      aria-orientation={orientation}
    />
  );
}
