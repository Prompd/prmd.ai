import { useCallback, useEffect, useState } from 'react';

interface UseResizableOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

interface UseResizableResult {
  width: number;
  startDrag: (e: React.MouseEvent) => void;
  dragging: boolean;
}

function readStored(key: string): number | null {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // ignore storage errors
  }
}

export function useResizable({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
}: UseResizableOptions): UseResizableResult {
  const [width, setWidth] = useState<number>(() => {
    const stored = readStored(storageKey);
    if (stored === null) return defaultWidth;
    return Math.min(maxWidth, Math.max(minWidth, stored));
  });
  const [dragging, setDragging] = useState(false);

  const startDrag = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      setDragging(true);

      const onMove = (moveEvent: MouseEvent): void => {
        const delta = moveEvent.clientX - startX;
        const next = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
        setWidth(next);
      };
      const onUp = (): void => {
        setDragging(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [width, minWidth, maxWidth],
  );

  useEffect(() => {
    if (dragging) return;
    writeStored(storageKey, width);
  }, [width, dragging, storageKey]);

  return { width, startDrag, dragging };
}
