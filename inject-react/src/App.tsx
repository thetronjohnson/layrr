import React from 'react';

// Import Overlay components
import SelectionRect from './components/Overlay/SelectionRect';
import SelectionInfo from './components/Overlay/SelectionInfo';
import HoverHandle from './components/Overlay/HoverHandle';
import ResizeHandles from './components/Overlay/ResizeHandles';

// Import Editor components
import InlineInput from './components/Editors/InlineInput';
import TextEditor from './components/Editors/TextEditor';
import ActionMenu from './components/Editors/ActionMenu';

// Import Toolbar components
import ModeToggle from './components/Toolbar/ModeToggle';
import StatusIndicator from './components/Toolbar/StatusIndicator';

// Import Panel components
import HistoryPanel from './components/History/HistoryPanel';

// Import Design components
import DesignModal from './components/Design/DesignModal';

// Import hooks
import useWebSocket from './hooks/useWebSocket';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';

// Import Zustand store and selectors
import { useLayyrrStore } from './store';

/**
 * Main App component - Orchestrates all features
 *
 * This component serves as the main orchestrator that:
 * - Initializes WebSocket connections for real-time communication
 * - Sets up global keyboard shortcuts
 * - Manages and renders all overlay, editor, toolbar, and panel components
 * - Conditionally displays components based on Zustand state
 * - Ensures proper z-index ordering and component hierarchy
 *
 * Features:
 * - Performance optimized with Zustand selectors to prevent unnecessary re-renders
 * - Clean component composition with proper separation of concerns
 * - TypeScript typing for all props and state
 * - Proper modal and overlay z-index management
 *
 * @returns {React.ReactElement} The main application UI
 *
 * @example
 * ```tsx
 * // In your root entry point
 * import App from './App';
 *
 * ReactDOM.render(<App />, document.getElementById('root'));
 * ```
 */
const App: React.FC = () => {
  // Initialize WebSocket connections
  useWebSocket();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // === SELECTION STATE ===
  const {
    showSelectionRect,
    selectionRectStyle,
    showSelectionInfo,
    selectionInfoStyle,
    selectionInfoText,
    selectedElement,
  } = useLayyrrStore((state) => ({
    showSelectionRect: state.showSelectionRect,
    selectionRectStyle: state.selectionRectStyle,
    showSelectionInfo: state.showSelectionInfo,
    selectionInfoStyle: state.selectionInfoStyle,
    selectionInfoText: state.selectionInfoText,
    selectedElement: state.selectedElement,
  }));

  // === EDITOR STATE ===
  const {
    showInlineInput,
    inlineInputStyle,
    inlineInputBadge,
    inlineInputText,
    showTextEditor,
    textEditorStyle,
    textEditorLabel,
    textEditorValue,
  } = useLayyrrStore((state) => ({
    showInlineInput: state.showInlineInput,
    inlineInputStyle: state.inlineInputStyle,
    inlineInputBadge: state.inlineInputBadge,
    inlineInputText: state.inlineInputText,
    showTextEditor: state.showTextEditor,
    textEditorStyle: state.textEditorStyle,
    textEditorLabel: state.textEditorLabel,
    textEditorValue: state.textEditorValue,
  }));

  // === ACTION MENU STATE ===
  const {
    showActionMenu,
    actionMenuElement,
    actionMenuStyle,
  } = useLayyrrStore((state) => ({
    showActionMenu: state.showActionMenu,
    actionMenuElement: state.actionMenuElement,
    actionMenuStyle: state.actionMenuStyle,
  }));

  // === TOOLBAR STATE ===
  const {
    showStatusIndicator,
    statusText,
    statusClass,
  } = useLayyrrStore((state) => ({
    showStatusIndicator: state.showStatusIndicator,
    statusText: state.statusText,
    statusClass: state.statusClass,
  }));

  // === HISTORY PANEL STATE ===
  const { showHistoryPanel } = useLayyrrStore((state) => ({
    showHistoryPanel: state.showHistoryPanel,
  }));

  // === DESIGN MODAL STATE ===
  const { showDesignModal } = useLayyrrStore((state) => ({
    showDesignModal: state.showDesignModal,
  }));

  // === HOVER HANDLE STATE ===
  const {
    currentHoveredElement,
  } = useLayyrrStore((state) => ({
    currentHoveredElement: state.currentHoveredElement,
  }));

  return (
    <>
      {/* ========================================
          OVERLAY COMPONENTS (z-index: 9998-9999)
          ======================================== */}

      {/* Selection Rectangle - Visible during drag operations */}
      {showSelectionRect && (
        <SelectionRect style={selectionRectStyle} />
      )}

      {/* Selection Info - Displays info about selected element */}
      {showSelectionInfo && (
        <SelectionInfo
          style={selectionInfoStyle}
          text={selectionInfoText}
        />
      )}

      {/* Hover Handle - Interactive handle on hovered elements */}
      {currentHoveredElement && (
        <HoverHandle element={currentHoveredElement} style="" />
      )}

      {/* Resize Handles - Handles for resizing selected elements */}
      {selectedElement && (
        <ResizeHandles style="" />
      )}

      {/* ========================================
          EDITOR COMPONENTS (z-index: 9997-9998)
          ======================================== */}

      {/* Inline Input - Quick inline text input for single fields */}
      {showInlineInput && (
        <InlineInput
          show={showInlineInput}
          style={inlineInputStyle}
          badge={inlineInputBadge}
          text={inlineInputText}
        />
      )}

      {/* Text Editor - Extended text editor for longer content */}
      {showTextEditor && (
        <TextEditor
          show={showTextEditor}
          style={textEditorStyle}
          label={textEditorLabel}
          value={textEditorValue}
        />
      )}

      {/* Action Menu - Context menu for element actions */}
      {showActionMenu && actionMenuElement && (
        <ActionMenu
          show={showActionMenu}
          element={actionMenuElement}
          style={actionMenuStyle}
        />
      )}

      {/* ========================================
          TOOLBAR COMPONENTS (z-index: 9999)
          ======================================== */}

      {/* Mode Toggle - Toggle between edit and browse modes */}
      <ModeToggle />

      {/* Status Indicator - Shows processing/success/error messages */}
      <StatusIndicator
        show={showStatusIndicator}
        text={statusText}
        className={statusClass}
      />

      {/* ========================================
          SIDE PANELS (z-index: 10000-10001)
          ======================================== */}

      {/* History Panel - Change history sidebar */}
      <HistoryPanel show={showHistoryPanel} />

      {/* ========================================
          MODALS (z-index: 10000-10001)
          ======================================== */}

      {/* Design Modal - Design to code analysis modal */}
      <DesignModal show={showDesignModal} />
    </>
  );
};

export default App;
