import React, { useEffect, useRef, useState } from 'react';
import { useLayyrrStore } from '../../store';

/**
 * TextEditor component
 * Full text editor modal with preview, submit, and cancel buttons
 * - Modal overlay with backdrop
 * - Draggable header for repositioning
 * - Real-time preview of changes
 * - Submit and Cancel buttons
 */
interface TextEditorProps {
  /** Whether the editor should be visible */
  show: boolean;
  /** CSS style string for positioning */
  style?: string;
  /** Label text displayed in the header */
  label: string;
  /** Current text content being edited */
  value: string;
}

const TextEditor: React.FC<TextEditorProps> = ({ show, style = '', label, value }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const { setTextEditorValue, submitTextEditor, hideTextEditor, textEditorPreview } =
    useLayyrrStore();

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

  // Auto-focus textarea when shown
  useEffect(() => {
    if (show && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [show]);

  // Handle textarea change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextEditorValue(e.target.value);
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      hideTextEditor();
    }
  };

  // Handle header mouse down for dragging
  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      setIsDragging(true);
      const rect = headerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Handle submit
  const handleSubmit = () => {
    submitTextEditor();
  };

  // Handle cancel
  const handleCancel = () => {
    hideTextEditor();
  };

  // Return null if not shown
  if (!show) {
    return null;
  }

  return (
    <div
      className="vc-text-editor-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2px)',
        zIndex: 10000,
        pointerEvents: 'auto',
      }}
      onClick={handleCancel}
      data-testid="text-editor-backdrop"
    >
      <div
        className="vc-text-editor-modal"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '500px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          zIndex: 10001,
          pointerEvents: 'auto',
          ...parsedStyle,
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="text-editor-modal"
      >
        {/* Header */}
        <div
          ref={headerRef}
          className="vc-text-editor-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgb(168, 85, 247), rgb(126, 34, 206))',
            color: 'white',
            borderRadius: '8px 8px 0 0',
            cursor: 'grab',
            userSelect: 'none',
            flexShrink: 0,
          }}
          onMouseDown={handleHeaderMouseDown}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              letterSpacing: '0.3px',
            }}
          >
            {label}
          </h2>
          <div
            style={{
              fontSize: '12px',
              opacity: 0.8,
              fontFamily: 'monospace',
            }}
          >
            {value.length} chars
          </div>
        </div>

        {/* Content Area */}
        <div
          className="vc-text-editor-content"
          style={{
            display: 'flex',
            gap: '12px',
            padding: '16px',
            flex: 1,
            minHeight: '300px',
            overflow: 'hidden',
          }}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter text content..."
            className="vc-text-editor-textarea"
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid rgb(229, 231, 235)',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'monospace',
              color: 'rgb(31, 41, 55)',
              outline: 'none',
              resize: 'none',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.05)',
              transition: 'border-color 0.2s',
            }}
          />

          {/* Preview */}
          {textEditorPreview && (
            <div
              className="vc-text-editor-preview"
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid rgb(229, 231, 235)',
                borderRadius: '6px',
                background: 'rgb(249, 250, 251)',
                fontSize: '14px',
                fontFamily: 'inherit',
                color: 'rgb(31, 41, 55)',
                overflowY: 'auto',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {textEditorPreview}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="vc-text-editor-footer"
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '16px 20px',
            borderTop: '1px solid rgb(229, 231, 235)',
            background: 'rgb(249, 250, 251)',
            borderRadius: '0 0 8px 8px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleCancel}
            className="vc-text-editor-cancel-btn"
            style={{
              padding: '8px 16px',
              border: '1px solid rgb(229, 231, 235)',
              borderRadius: '6px',
              background: 'white',
              color: 'rgb(75, 85, 99)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgb(243, 244, 246)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = 'white';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="vc-text-editor-submit-btn"
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, rgb(168, 85, 247), rgb(126, 34, 206))',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(168, 85, 247, 0.3)',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.boxShadow =
                '0 4px 12px rgba(168, 85, 247, 0.4)';
              (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.boxShadow =
                '0 2px 8px rgba(168, 85, 247, 0.3)';
              (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextEditor;
