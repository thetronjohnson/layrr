import React, { useState } from 'react';
import type { ChangeHistoryItem } from '../../types';

/**
 * HistoryItem component
 * Displays a single change history entry with timestamp and file changes
 * - Shows relative time (e.g., "2 minutes ago")
 * - Expandable file changes list
 * - Hover effects for better interactivity
 * - Click callback for selection
 */
interface HistoryItemProps {
  /** The change history item to display */
  change: ChangeHistoryItem;
  /** Callback fired when the item is clicked */
  onClick: (change: ChangeHistoryItem) => void;
}

/**
 * Format relative time from timestamp
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string (e.g., "2 minutes ago")
 */
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
};

const HistoryItem: React.FC<HistoryItemProps> = ({ change, onClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const relativeTime = formatRelativeTime(change.timestamp);

  return (
    <div
      onClick={() => onClick(change)}
      className="vc-history-item"
      style={{
        padding: '12px',
        borderBottom: '1px solid rgb(243, 244, 246)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={(e) => {
        const target = e.currentTarget as HTMLElement;
        target.style.backgroundColor = 'rgb(249, 250, 251)';
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget as HTMLElement;
        target.style.backgroundColor = 'transparent';
      }}
      data-testid={`history-item-${change.id}`}
    >
      {/* Main content */}
      <div
        className="vc-history-item-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '8px',
        }}
      >
        <div
          className="vc-history-item-content"
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Description */}
          <div
            className="vc-history-item-description"
            style={{
              fontSize: '13px',
              fontWeight: '500',
              color: 'rgb(31, 41, 55)',
              marginBottom: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={change.description}
          >
            {change.description}
          </div>

          {/* Relative time */}
          <div
            className="vc-history-item-time"
            style={{
              fontSize: '12px',
              color: 'rgb(107, 114, 128)',
            }}
          >
            {relativeTime}
          </div>
        </div>

        {/* Expand button */}
        {change.fileChanges.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="vc-history-item-expand-btn"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'rgb(107, 114, 128)',
              fontSize: '14px',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '24px',
              height: '24px',
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
            aria-label="Toggle file changes"
          >
            <span
              style={{
                transform: `rotate(${isExpanded ? 90 : 0}deg)`,
                transition: 'transform 0.2s ease',
                display: 'inline-block',
              }}
            >
              ▶
            </span>
          </button>
        )}
      </div>

      {/* Expandable file changes */}
      {isExpanded && change.fileChanges.length > 0 && (
        <div
          className="vc-history-item-file-changes"
          style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid rgb(229, 231, 235)',
            animation: 'slideDown 0.2s ease',
          }}
        >
          {change.fileChanges.map((fileChange, index) => (
            <div
              key={index}
              className="vc-history-item-file-change"
              style={{
                marginBottom: index < change.fileChanges.length - 1 ? '8px' : 0,
              }}
            >
              {/* File name */}
              <div
                className="vc-history-item-file-name"
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'rgb(55, 65, 81)',
                  marginBottom: '4px',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={fileChange.file}
              >
                {fileChange.file}
              </div>

              {/* Changes summary */}
              <div
                className="vc-history-item-changes-summary"
                style={{
                  fontSize: '11px',
                  color: 'rgb(107, 114, 128)',
                  fontFamily: 'monospace',
                  background: 'rgb(249, 250, 251)',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '80px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {fileChange.changes}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File count indicator */}
      {!isExpanded && change.fileChanges.length > 0 && (
        <div
          className="vc-history-item-file-count"
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: 'rgb(107, 114, 128)',
          }}
        >
          {change.fileChanges.length} file{change.fileChanges.length > 1 ? 's' : ''} changed
        </div>
      )}

      {/* CSS animation */}
      <style>
        {`
          @keyframes slideDown {
            from {
              opacity: 0;
              max-height: 0;
            }
            to {
              opacity: 1;
              max-height: 300px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default HistoryItem;
