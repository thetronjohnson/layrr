import React from 'react';

/**
 * SelectionInfo component
 * Displays element information tooltip above the selection
 * Shows details like tag name, classes, and other element metadata
 */
interface SelectionInfoProps {
  /** CSS style string from Zustand store (parsed as inline styles) */
  style: string;
  /** Text content to display in the tooltip */
  text: string;
}

const SelectionInfo: React.FC<SelectionInfoProps> = ({ style, text }) => {
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

  // Return null if no text or style provided
  if (!text || !style || Object.keys(parsedStyle).length === 0) {
    return null;
  }

  return (
    <div
      className="vc-selection-info"
      style={{
        ...parsedStyle,
        position: 'fixed',
        background: 'linear-gradient(135deg, rgb(168, 85, 247), rgb(126, 34, 206))',
        color: 'white',
        padding: '6px 10px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
        fontFamily: 'monospace',
        pointerEvents: 'none',
        zIndex: 9999,
        maxWidth: '300px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }}
      data-testid="selection-info"
    >
      {text}
    </div>
  );
};

export default SelectionInfo;
