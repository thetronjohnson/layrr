import React, { useEffect, useRef } from 'react';
import { useLayyrrStore } from '../../store';

/**
 * ActionMenu component
 * Context menu for editing DOM elements
 * - Menu items: Edit, Delete, Duplicate, Reorder
 * - Positioned near the target element
 * - Auto-closes on click outside
 * - Properly null-safe and type-safe
 */
interface ActionMenuProps {
  /** Whether the menu should be visible */
  show: boolean;
  /** CSS style string for positioning */
  style?: string;
  /** The HTMLElement this menu is attached to */
  element: HTMLElement | null;
}

interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
  className: string;
}

const ActionMenu: React.FC<ActionMenuProps> = ({ show, style = '', element }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { hideActionMenu, setSelectedElement } = useLayyrrStore();

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

  // Get element tag name for display
  const getElementLabel = (): string => {
    if (!element) return 'Element';
    const tag = element.tagName.toLowerCase();
    const id = element.id ? ` #${element.id}` : '';
    const classList = element.className ? ` .${element.className.split(' ').join('.')}` : '';
    return `${tag}${id}${classList}`;
  };

  // Handle Edit action
  const handleEdit = () => {
    if (element) {
      setSelectedElement(element);
      // TODO: Trigger appropriate editor based on element type
      console.log('[ActionMenu] Edit:', element);
    }
    hideActionMenu();
  };

  // Handle Delete action
  const handleDelete = () => {
    if (element) {
      element.remove();
      console.log('[ActionMenu] Delete:', element);
    }
    hideActionMenu();
  };

  // Handle Duplicate action
  const handleDuplicate = () => {
    if (element) {
      const clone = element.cloneNode(true) as HTMLElement;
      element.parentNode?.insertBefore(clone, element.nextSibling);
      console.log('[ActionMenu] Duplicate:', element);
    }
    hideActionMenu();
  };

  // Handle Reorder action
  const handleReorder = () => {
    if (element) {
      setSelectedElement(element);
      // TODO: Enter reorder mode in store
      console.log('[ActionMenu] Reorder:', element);
    }
    hideActionMenu();
  };

  // Menu items configuration
  const menuItems: MenuItem[] = [
    {
      label: 'Edit',
      icon: '✏️',
      action: handleEdit,
      className: 'vc-action-menu-edit',
    },
    {
      label: 'Delete',
      icon: '🗑️',
      action: handleDelete,
      className: 'vc-action-menu-delete',
    },
    {
      label: 'Duplicate',
      icon: '📋',
      action: handleDuplicate,
      className: 'vc-action-menu-duplicate',
    },
    {
      label: 'Reorder',
      icon: '↔️',
      action: handleReorder,
      className: 'vc-action-menu-reorder',
    },
  ];

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        hideActionMenu();
      }
    };

    if (show) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [show, hideActionMenu]);

  // Handle escape key to close menu
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideActionMenu();
      }
    };

    if (show) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [show, hideActionMenu]);

  // Return null if not shown or no element
  if (!show || !element) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="vc-action-menu"
      style={{
        ...parsedStyle,
        position: 'fixed',
        zIndex: 10001,
        pointerEvents: 'auto',
      }}
      data-testid="action-menu"
    >
      {/* Menu container */}
      <div
        className="vc-action-menu-container"
        style={{
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          minWidth: '180px',
          border: '1px solid rgb(229, 231, 235)',
        }}
      >
        {/* Header showing element info */}
        <div
          className="vc-action-menu-header"
          style={{
            padding: '10px 14px',
            background: 'linear-gradient(135deg, rgb(168, 85, 247), rgb(126, 34, 206))',
            color: 'white',
            fontSize: '12px',
            fontWeight: '600',
            letterSpacing: '0.3px',
            borderBottom: '1px solid rgb(168, 85, 247)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '220px',
          }}
          title={getElementLabel()}
        >
          {getElementLabel()}
        </div>

        {/* Menu items */}
        <div
          className="vc-action-menu-items"
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                item.action();
              }}
              className={item.className}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                color: 'rgb(31, 41, 55)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderBottom:
                  index < menuItems.length - 1 ? '1px solid rgb(243, 244, 246)' : 'none',
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'rgb(243, 244, 246)';
                target.style.paddingLeft = '16px';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.background = 'transparent';
                target.style.paddingLeft = '14px';
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div
          className="vc-action-menu-footer"
          style={{
            padding: '8px 14px',
            background: 'rgb(249, 250, 251)',
            borderTop: '1px solid rgb(229, 231, 235)',
            fontSize: '11px',
            color: 'rgb(107, 114, 128)',
            fontStyle: 'italic',
          }}
        >
          Right-click to reposition
        </div>
      </div>
    </div>
  );
};

export default ActionMenu;
