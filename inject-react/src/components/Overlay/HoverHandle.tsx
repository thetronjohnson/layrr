import React, { useCallback } from 'react';
import { useLayyrrStore } from '../../store';

/**
 * HoverHandle component
 * Displays a draggable handle that appears on hover at the top-left of elements
 * Allows users to drag elements around the page
 */
interface HoverHandleProps {
  /** CSS style string from Zustand store (parsed as inline styles) */
  style?: string;
  /** The element being hovered, used for drag operations */
  element: HTMLElement;
}

const HoverHandle: React.FC<HoverHandleProps> = ({ style, element }) => {
  const { startDragFromHandle } = useLayyrrStore();

  // Parse the style string into individual style properties
  const parseStyleString = (styleStr: string | undefined): React.CSSProperties => {
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

  // Handle mouse down to start dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      startDragFromHandle(element, e.clientX, e.clientY);
    },
    [element, startDragFromHandle]
  );

  return (
    <div
      className="vc-hover-handle"
      style={{
        ...parsedStyle,
        position: 'fixed',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: 'rgb(168, 85, 247)',
        border: '2px solid white',
        cursor: 'grab',
        pointerEvents: 'auto',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(168, 85, 247, 0.4)',
        transition: 'all 0.2s ease',
      }}
      onMouseDown={handleMouseDown}
      data-testid="hover-handle"
      title="Drag to move element"
    >
      {/* Drag icon */}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="3" cy="3" r="1" />
        <circle cx="7" cy="3" r="1" />
        <circle cx="3" cy="7" r="1" />
        <circle cx="7" cy="7" r="1" />
      </svg>
    </div>
  );
};

export default HoverHandle;
