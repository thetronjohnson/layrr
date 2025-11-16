import React, { useEffect, useRef } from 'react';
import { useLayyrrStore } from '../../store';

/**
 * InlineInput component
 * Quick text input form for AI instructions with badge showing element type
 * - Auto-focuses when shown
 * - Submits on Enter, closes on Escape
 * - Purple gradient background with white text
 * - Positioned via style prop
 */
interface InlineInputProps {
  /** Whether the input should be visible */
  show: boolean;
  /** CSS style string for positioning (e.g., "top: 100px; left: 50px;") */
  style?: string;
  /** Badge text showing element type (e.g., "BUTTON", "INPUT") */
  badge: string;
  /** Current input text value */
  text: string;
  /** Callback when form is submitted */
  onSubmit?: () => void;
}

const InlineInput: React.FC<InlineInputProps> = ({ show, style = '', badge, text, onSubmit }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { setInlineInputText, submitInlineInput, hideInlineInput } = useLayyrrStore();

  // Parse style string into React.CSSProperties
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

  // Auto-focus when shown
  useEffect(() => {
    if (show && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [show]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitInlineInput();
      onSubmit?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideInlineInput();
    }
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInlineInputText(e.target.value);
  };

  // Return null if not shown
  if (!show) {
    return null;
  }

  return (
    <div
      className="vc-inline-input-container"
      style={{
        ...parsedStyle,
        position: 'fixed',
        zIndex: 10000,
        pointerEvents: 'auto',
      }}
      data-testid="inline-input-container"
    >
      <div
        className="vc-inline-input-wrapper"
        style={{
          display: 'flex',
          gap: '8px',
          background: 'linear-gradient(135deg, rgb(168, 85, 247), rgb(126, 34, 206))',
          padding: '8px 12px',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          className="vc-inline-input-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            minWidth: '40px',
            textAlign: 'center',
          }}
        >
          {badge}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type instruction..."
          className="vc-inline-input-field"
          style={{
            flex: 1,
            minWidth: '200px',
            border: 'none',
            background: 'transparent',
            color: 'white',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            padding: '4px 0',
            '::placeholder': {
              color: 'rgba(255, 255, 255, 0.6)',
            },
          } as any}
        />
      </div>

      <div
        className="vc-inline-input-hint"
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          fontSize: '11px',
          color: 'rgba(0, 0, 0, 0.5)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        Press Enter to submit, Esc to cancel
      </div>
    </div>
  );
};

export default InlineInput;
