import React, { useEffect, useRef, useState } from 'react';
import { useLayyrrStore } from '../../store';
import ImageUploader from './ImageUploader';
import DesignAnalyzer from './DesignAnalyzer';

/**
 * DesignModal component
 * Main modal for design upload and analysis
 * - Modal overlay with backdrop
 * - Purple gradient header with "Design to Code" title
 * - Draggable header for repositioning
 * - Contains ImageUploader and DesignAnalyzer components
 * - Close on Escape key or backdrop click
 */
interface DesignModalProps {
  /** Whether the modal should be visible */
  show: boolean;
}

const DesignModal: React.FC<DesignModalProps> = ({ show }) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const { toggleDesignModal, uploadedImage, imagePreview } = useLayyrrStore();

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

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      toggleDesignModal();
    }
  };

  // Return null if not shown
  if (!show) {
    return null;
  }

  return (
    <div
      className="vc-design-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2px)',
        zIndex: 10000,
        pointerEvents: 'auto',
      }}
      onClick={toggleDesignModal}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="vc-design-modal"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '600px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          zIndex: 10001,
          pointerEvents: 'auto',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="design-modal"
      >
        {/* Header */}
        <div
          ref={headerRef}
          className="vc-design-modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            background: 'linear-gradient(135deg, rgb(168, 85, 247), rgb(126, 34, 206))',
            color: 'white',
            flexShrink: 0,
            cursor: 'grab',
            userSelect: 'none',
          }}
          onMouseDown={handleHeaderMouseDown}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '700',
              letterSpacing: '0.3px',
            }}
          >
            Design to Code
          </h2>
          <button
            onClick={toggleDesignModal}
            className="vc-design-modal-close-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '6px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          className="vc-design-modal-content"
          style={{
            flex: 1,
            padding: '24px',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <ImageUploader />
          {uploadedImage && <DesignAnalyzer image={imagePreview} imageType="design" />}
        </div>
      </div>
    </div>
  );
};

export default DesignModal;
