import React, { useEffect, useRef } from 'react';
import { useLayyrrStore } from '../../store';
import HistoryItem from './HistoryItem';
import type { ChangeHistoryItem } from '../../types';

/**
 * HistoryPanel component
 * Fixed-position sidebar displaying change history
 * - Slide in/out animation from right side
 * - Header with "Change History" title and close button
 * - Scrollable list of history items
 * - Footer with undo/redo buttons
 * - Purple gradient styling
 * - Full height with max content area
 */
interface HistoryPanelProps {
  /** Whether the panel should be shown */
  show: boolean;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ show }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const {
    changeHistory,
    undoStack,
    redoStack,
    toggleHistoryPanel,
    undo,
    redo,
  } = useLayyrrStore((state) => ({
    changeHistory: state.changeHistory,
    undoStack: state.undoStack,
    redoStack: state.redoStack,
    toggleHistoryPanel: state.toggleHistoryPanel,
    undo: state.undo,
    redo: state.redo,
  }));

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  // Auto-scroll to bottom when new history items are added
  useEffect(() => {
    if (listRef.current && show) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [changeHistory, show]);

  // Handle item click
  const handleHistoryItemClick = (change: ChangeHistoryItem) => {
    // TODO: Navigate to or highlight the specific change
    console.log('[HistoryPanel] Selected change:', change);
  };

  // Handle close button click
  const handleClose = () => {
    toggleHistoryPanel();
  };

  return (
    <>
      {/* Overlay backdrop */}
      {show && (
        <div
          className="vc-history-panel-backdrop"
          onClick={handleClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease',
          }}
          data-testid="history-panel-backdrop"
        />
      )}

      {/* History Panel */}
      <div
        ref={panelRef}
        className="vc-history-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '320px',
          backgroundColor: 'white',
          boxShadow: show ? '-4px 0 12px rgba(0, 0, 0, 0.15)' : 'none',
          zIndex: 10001,
          display: 'flex',
          flexDirection: 'column',
          transform: show ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: show ? 'auto' : 'none',
        }}
        data-testid="history-panel"
      >
        {/* Header */}
        <div
          className="vc-history-panel-header"
          style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgb(168, 85, 247), rgb(126, 34, 206))',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgb(168, 85, 247)',
            flexShrink: 0,
          }}
        >
          <h2
            className="vc-history-panel-title"
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              letterSpacing: '0.3px',
            }}
          >
            Change History
          </h2>

          <button
            onClick={handleClose}
            className="vc-history-panel-close-btn"
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '0',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.backgroundColor = 'transparent';
            }}
            title="Close history panel"
            aria-label="Close history panel"
          >
            ✕
          </button>
        </div>

        {/* Content Area */}
        <div
          className="vc-history-panel-content"
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* History Items List */}
          <div
            ref={listRef}
            className="vc-history-panel-list"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {changeHistory.length === 0 ? (
              <div
                className="vc-history-panel-empty"
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'rgb(107, 114, 128)',
                  fontSize: '13px',
                }}
              >
                <div style={{ marginBottom: '8px', fontSize: '28px' }}>📋</div>
                No changes yet
              </div>
            ) : (
              changeHistory.map((change) => (
                <HistoryItem
                  key={change.id}
                  change={change}
                  onClick={handleHistoryItemClick}
                />
              ))
            )}
          </div>
        </div>

        {/* Footer with Undo/Redo buttons */}
        <div
          className="vc-history-panel-footer"
          style={{
            padding: '12px',
            borderTop: '1px solid rgb(229, 231, 235)',
            display: 'flex',
            gap: '8px',
            flexShrink: 0,
            background: 'rgb(249, 250, 251)',
          }}
        >
          {/* Undo Button */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="vc-history-panel-undo-btn"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid rgb(229, 231, 235)',
              borderRadius: '6px',
              background: 'white',
              color: canUndo ? 'rgb(31, 41, 55)' : 'rgb(209, 213, 219)',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: '500',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              if (canUndo) {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = 'rgb(243, 244, 246)';
                target.style.borderColor = 'rgb(209, 213, 219)';
              }
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.backgroundColor = 'white';
              target.style.borderColor = 'rgb(229, 231, 235)';
            }}
            title={canUndo ? 'Undo last change' : 'No changes to undo'}
            aria-label="Undo"
          >
            <span>↶</span>
            <span>Undo</span>
          </button>

          {/* Redo Button */}
          <button
            onClick={redo}
            disabled={!canRedo}
            className="vc-history-panel-redo-btn"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid rgb(229, 231, 235)',
              borderRadius: '6px',
              background: 'white',
              color: canRedo ? 'rgb(31, 41, 55)' : 'rgb(209, 213, 219)',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: '500',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              if (canRedo) {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = 'rgb(243, 244, 246)';
                target.style.borderColor = 'rgb(209, 213, 219)';
              }
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.backgroundColor = 'white';
              target.style.borderColor = 'rgb(229, 231, 235)';
            }}
            title={canRedo ? 'Redo last undone change' : 'No changes to redo'}
            aria-label="Redo"
          >
            <span>↷</span>
            <span>Redo</span>
          </button>
        </div>
      </div>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          .vc-history-panel-list {
            scrollbar-width: thin;
            scrollbar-color: rgb(209, 213, 219) rgb(243, 244, 246);
          }

          .vc-history-panel-list::-webkit-scrollbar {
            width: 6px;
          }

          .vc-history-panel-list::-webkit-scrollbar-track {
            background: rgb(243, 244, 246);
          }

          .vc-history-panel-list::-webkit-scrollbar-thumb {
            background: rgb(209, 213, 219);
            border-radius: 3px;
          }

          .vc-history-panel-list::-webkit-scrollbar-thumb:hover {
            background: rgb(156, 163, 175);
          }
        `}
      </style>
    </>
  );
};

export default HistoryPanel;
