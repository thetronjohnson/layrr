import React from 'react';

/**
 * SelectionRect component
 * Renders a visual selection rectangle during drag operations
 * Shows a dashed purple border around the dragged area
 */
interface SelectionRectProps {
  /** CSS style string from Zustand store (parsed as inline styles) */
  style: string;
}

const SelectionRect: React.FC<SelectionRectProps> = ({ style }) => {
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

  // Return null if no style is provided or element is not visible
  if (!style || Object.keys(parsedStyle).length === 0) {
    return null;
  }

  return (
    <div
      className="vc-selection-rect"
      style={{
        ...parsedStyle,
        position: 'fixed',
        border: '2px dashed rgb(168, 85, 247)', // Purple dashed border
        pointerEvents: 'none',
        zIndex: 9998,
      }}
      data-testid="selection-rect"
    />
  );
};

export default SelectionRect;
