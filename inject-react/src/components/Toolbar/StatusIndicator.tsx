import React, { useEffect, useState } from 'react';
import { useLayyrrStore } from '../../store';

/**
 * StatusIndicator component
 * Fixed position bottom-center status display with fade in/out animations
 * - Shows processing status with spinner
 * - Different colors based on status type: processing (purple), success (green), error (red)
 * - Auto-fades in and out
 * - Uses Zustand store for state management
 */
interface StatusIndicatorProps {
  /** Whether to show the indicator */
  show?: boolean;
  /** Status text to display */
  text?: string;
  /** CSS class name for styling (processing, success, error) */
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  show: propShow,
  text: propText,
  className: propClassName,
}) => {
  const { showStatusIndicator, statusText, statusClass } = useLayyrrStore();
  const [mounted, setMounted] = useState(false);

  // Use props if provided, otherwise fall back to store values
  const show = propShow !== undefined ? propShow : showStatusIndicator;
  const text = propText !== undefined ? propText : statusText;
  const className = propClassName !== undefined ? propClassName : statusClass;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !show || !text) return null;

  // Determine styling based on status class
  const getStatusColors = (
    statusClass: string
  ): { bgColor: string; borderColor: string; textColor: string; spinnerColor: string } => {
    switch (statusClass) {
      case 'success':
        return {
          bgColor: 'rgb(220, 252, 231)',
          borderColor: 'rgb(34, 197, 94)',
          textColor: 'rgb(22, 101, 52)',
          spinnerColor: 'rgb(34, 197, 94)',
        };
      case 'error':
        return {
          bgColor: 'rgb(254, 226, 226)',
          borderColor: 'rgb(239, 68, 68)',
          textColor: 'rgb(127, 29, 29)',
          spinnerColor: 'rgb(239, 68, 68)',
        };
      case 'processing':
      default:
        return {
          bgColor: 'rgb(243, 232, 255)',
          borderColor: 'rgb(168, 85, 247)',
          textColor: 'rgb(88, 28, 135)',
          spinnerColor: 'rgb(168, 85, 247)',
        };
    }
  };

  const colors = getStatusColors(className);

  // Spinner animation keyframes
  const spinnerStyle = `
    @keyframes vc-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .vc-status-spinner {
      animation: vc-spin 1s linear infinite;
    }
  `;

  return (
    <>
      <style>{spinnerStyle}</style>
      <div
        className="vc-status-indicator"
        style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          pointerEvents: 'auto',
          animation: 'fadeInOut 0.3s ease-in-out',
        }}
      >
        <style>
          {`
            @keyframes fadeInOut {
              0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
              100% { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}
        </style>

        {/* Status container */}
        <div
          className="vc-status-indicator-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: `1px solid ${colors.borderColor}`,
            background: colors.bgColor,
            color: colors.textColor,
            fontSize: '13px',
            fontWeight: '500',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            minWidth: '200px',
            maxWidth: '400px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          data-testid="status-indicator"
        >
          {/* Spinner - only show for processing status */}
          {className === 'processing' && (
            <div
              className="vc-status-spinner"
              style={{
                width: '16px',
                height: '16px',
                border: `2px solid ${colors.spinnerColor}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
          )}

          {/* Success icon */}
          {className === 'success' && (
            <span
              style={{
                fontSize: '14px',
                flexShrink: 0,
              }}
            >
              ✓
            </span>
          )}

          {/* Error icon */}
          {className === 'error' && (
            <span
              style={{
                fontSize: '14px',
                flexShrink: 0,
              }}
            >
              ✕
            </span>
          )}

          {/* Status text */}
          <span>{text}</span>
        </div>
      </div>
    </>
  );
};

export default StatusIndicator;
