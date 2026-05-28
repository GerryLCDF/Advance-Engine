import React, { useRef, useCallback } from 'react';

interface Props {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  bottom?: React.ReactNode;
  leftWidth: number;
  rightWidth: number;
  bottomHeight?: number;
  minLeft?: number;
  maxLeft?: number;
  minRight?: number;
  maxRight?: number;
  minBottom?: number;
  maxBottom?: number;
  onLeftWidthChange: (w: number) => void;
  onRightWidthChange: (w: number) => void;
  onBottomHeightChange?: (h: number) => void;
}

export function ResizableEditorLayout({
  left, center, right, bottom,
  leftWidth, rightWidth, bottomHeight,
  minLeft = 120, maxLeft = 500,
  minRight = 120, maxRight = 500,
  minBottom = 40, maxBottom = 400,
  onLeftWidthChange, onRightWidthChange, onBottomHeightChange,
}: Props) {
  const dragRef = useRef<{ target: 'left' | 'right' | 'bottom'; start: number; size: number } | null>(null);

  const onDown = useCallback((target: 'left' | 'right' | 'bottom', e: React.MouseEvent) => {
    e.preventDefault();
    const size = target === 'bottom' ? (bottomHeight ?? 72) : (target === 'left' ? leftWidth : rightWidth);
    dragRef.current = { target, start: target === 'bottom' ? e.clientY : e.clientX, size };

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = (d.target === 'bottom' ? ev.clientY : ev.clientX) - d.start;
      if (d.target === 'bottom') {
        onBottomHeightChange?.(Math.max(minBottom, Math.min(maxBottom, d.size - delta)));
      } else if (d.target === 'left') {
        onLeftWidthChange(Math.max(minLeft, Math.min(maxLeft, d.size + delta)));
      } else {
        onRightWidthChange(Math.max(minRight, Math.min(maxRight, d.size - delta)));
      }
    };

    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [leftWidth, rightWidth, bottomHeight, minLeft, maxLeft, minRight, maxRight, minBottom, maxBottom, onLeftWidthChange, onRightWidthChange, onBottomHeightChange]);

  const isResizing = dragRef.current !== null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', userSelect: isResizing ? 'none' : undefined }}>
      {/* Left */}
      <div style={{ width: leftWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {left}
      </div>

      {/* Splitter left */}
      <div
        onMouseDown={(e) => onDown('left', e)}
        style={{ width: 4, cursor: 'col-resize', flexShrink: 0, background: '#2a2a30', position: 'relative' }}
      >
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 2, height: 20, background: '#3a3a42', borderRadius: 1 }} />
      </div>

      {/* Center */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {center}
        </div>

        {bottom && bottomHeight !== undefined && onBottomHeightChange && (
          <>
            {/* Splitter bottom */}
            <div
              onMouseDown={(e) => onDown('bottom', e)}
              style={{ height: 4, cursor: 'row-resize', flexShrink: 0, background: '#2a2a30', position: 'relative' }}
            >
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', height: 2, width: 20, background: '#3a3a42', borderRadius: 1 }} />
            </div>
            <div style={{ height: bottomHeight, flexShrink: 0, overflow: 'auto' }}>
              {bottom}
            </div>
          </>
        )}
      </div>

      {/* Splitter right */}
      <div
        onMouseDown={(e) => onDown('right', e)}
        style={{ width: 4, cursor: 'col-resize', flexShrink: 0, background: '#2a2a30', position: 'relative' }}
      >
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 2, height: 20, background: '#3a3a42', borderRadius: 1 }} />
      </div>

      {/* Right */}
      <div style={{ width: rightWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {right}
      </div>
    </div>
  );
}