import React, { useEffect, useState } from 'react';
import { useLayyrrStore } from '../../store';

/**
 * ModeToggle component
 * Fixed position top-right button to toggle between Edit and Browse modes
 * - Shows current mode with icon
 * - Green when in edit mode, gray when in browse mode
 * - Smooth transitions on mode change
 * - Keyboard shortcut: Cmd+Shift+E
 */
const ModeToggle: React.FC = () => {
  const { isEditMode, toggleEditMode } = useLayyrrStore();
  const [mounted, setMounted] = useState(false);

  // Handle keyboard shortcut Cmd+Shift+E
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'e') {
        event.preventDefault();
        toggleEditMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    setMounted(true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleEditMode]);

  if (!mounted) return null;

  // Determine button styling based on mode
  const bgColor = isEditMode ? 'rgb(34, 197, 94)' : 'rgb(107, 114, 128)';
  const hoverBgColor = isEditMode ? 'rgb(22, 163, 74)' : 'rgb(75, 85, 99)';
  const modeText = isEditMode ? 'Edit Mode' : 'Browse Mode';
  const modeIcon = isEditMode ? '✏️' : '👁️';

  return (
    <div
      className="vc-mode-toggle"
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 10000,
        pointerEvents: 'auto',
      }}
    >
      <button
        onClick={toggleEditMode}
        className="vc-mode-toggle-button"
        title={`Toggle mode (Cmd+Shift+E)`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '6px',
          border: 'none',
          background: bgColor,
          color: 'white',
          fontSize: '13px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
        onMouseEnter={(e) => {
          const target = e.target as HTMLButtonElement;
          target.style.background = hoverBgColor;
          target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
          target.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLButtonElement;
          target.style.background = bgColor;
          target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
          target.style.transform = 'translateY(0)';
        }}
        data-testid="mode-toggle-button"
      >
        <span style={{ fontSize: '14px' }}>{modeIcon}</span>
        <span>{modeText}</span>
      </button>

      {/* Keyboard hint */}
      <div
        className="vc-mode-toggle-hint"
        style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          marginTop: '6px',
          fontSize: '11px',
          color: 'rgb(107, 114, 128)',
          whiteSpace: 'nowrap',
          opacity: 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: 'none',
        }}
        onMouseEnter={(e) => {
          const hint = e.target as HTMLDivElement;
          hint.style.opacity = '1';
        }}
      >
        Cmd+Shift+E
      </div>
    </div>
  );
};

export default ModeToggle;
