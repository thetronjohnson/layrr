import React, { useCallback } from 'react';
import { useLayyrrStore } from '../../store';
import type { DragHandleState } from '../../types';

/**
 * ResizeHandles component
 * Displays 8-directional resize handles around a selected element
 * Allows users to resize elements in all directions
 */
interface ResizeHandlesProps {
  /** CSS style string from Zustand store (parsed as inline styles) */
  style?: string;
  /** Callback fired when resize completes */
  onResize?: (element: HTMLElement) => void;
}

const ResizeHandles: React.FC<ResizeHandlesProps> = ({ style = '', onResize: _ }) => {
  const { startResize, selectedElement } = useLayyrrStore((state) => ({
    startResize: state.startResize,
    selectedElement: state.selectedElement,
  }));

  // Parse the style string into individual style properties
  const parseStyleString = (styleStr: string): React.CSSProperties => {
    if (!styleStr) return {};

    const styles: React.CSSProperties = {};
    const declarations = styleStr.split(';').filter((decl) => decl.trim());

    declarations.forEach((decl) => {
      const [property, value] = decl.split(':').map((part) => part.trim());
      if (property && value) {
        // Convert kebab-case to camelCase
        const camelProperty = property.replace(/-([a-z])/g, (g) =>
          g[1].toUpperCase()
        ) as keyof React.CSSProperties;
        styles[camelProperty] = value as any;
      }
    });

    return styles;
  };

  const parsedStyle = parseStyleString(style);

  // Define resize directions with their positions and cursor styles
  const directions: Array<{
    direction: DragHandleState['resizeDirection'];
    position: React.CSSProperties;
    cursor: string;
  }> = [
    {
      direction: 'n',
      position: { top: '-6px', left: '50%', transform: 'translateX(-50%)' },
      cursor: 'ns-resize',
    },
    {
      direction: 's',
      position: { bottom: '-6px', left: '50%', transform: 'translateX(-50%)' },
      cursor: 'ns-resize',
    },
    {
      direction: 'e',
      position: { top: '50%', right: '-6px', transform: 'translateY(-50%)' },
      cursor: 'ew-resize',
    },
    {
      direction: 'w',
      position: { top: '50%', left: '-6px', transform: 'translateY(-50%)' },
      cursor: 'ew-resize',
    },
    {
      direction: 'ne',
      position: { top: '-6px', right: '-6px' },
      cursor: 'nesw-resize',
    },
    {
      direction: 'nw',
      position: { top: '-6px', left: '-6px' },
      cursor: 'nwse-resize',
    },
    {
      direction: 'se',
      position: { bottom: '-6px', right: '-6px' },
      cursor: 'nwse-resize',
    },
    {
      direction: 'sw',
      position: { bottom: '-6px', left: '-6px' },
      cursor: 'nesw-resize',
    },
  ];

  // Handle mouse down to start resizing
  const handleResizeStart = useCallback(
    (direction: DragHandleState['resizeDirection']) =>
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!selectedElement) return;
        e.preventDefault();
        e.stopPropagation();
        startResize(direction, e.clientX, e.clientY, selectedElement);
      },
    [selectedElement, startResize]
  );

  // Return null if no element or style provided
  if (!selectedElement || !style || Object.keys(parsedStyle).length === 0) {
    return null;
  }

  return (
    <div
      className="vc-resize-handles-container"
      style={{
        ...parsedStyle,
        position: 'fixed',
        pointerEvents: 'auto',
        zIndex: 9999,
      }}
      data-testid="resize-handles"
    >
      {directions.map((dir) => (
        <div
          key={dir.direction}
          className={`vc-resize-handle vc-resize-handle-${dir.direction}`}
          style={{
            position: 'absolute',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'rgb(168, 85, 247)',
            border: '2px solid white',
            cursor: dir.cursor,
            pointerEvents: 'auto',
            ...dir.position,
            boxShadow: '0 1px 4px rgba(168, 85, 247, 0.4)',
            transition: 'all 0.2s ease',
          }}
          onMouseDown={handleResizeStart(dir.direction)}
          data-testid={`resize-handle-${dir.direction}`}
          title={`Resize ${dir.direction || 'corner'}`}
        />
      ))}
    </div>
  );
};

export default ResizeHandles;
