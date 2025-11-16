import { useEffect, useCallback } from 'react';
import { useLayyrrStore } from '../store';

/**
 * Determines if the user is currently typing in an input or textarea element.
 * Used to prevent keyboard shortcuts from triggering while user is actively editing text.
 *
 * @returns {boolean} True if focus is on an input/textarea element, false otherwise
 */
const isUserTyping = (): boolean => {
  const activeElement = document.activeElement as HTMLElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';

  return tagName === 'input' || tagName === 'textarea' || isContentEditable;
};

/**
 * Determines if the current platform is macOS.
 * Used to apply the correct modifier key (Cmd on Mac, Ctrl on Windows/Linux).
 *
 * @returns {boolean} True if running on macOS, false otherwise
 */
const isMacOS = (): boolean => {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
};

/**
 * Custom React hook for managing global keyboard shortcuts in the application.
 *
 * Registers keyboard shortcuts for common editor operations:
 * - Cmd/Ctrl+Shift+E: Toggle edit/browse mode
 * - Cmd/Ctrl+Shift+H: Toggle history panel
 * - Cmd/Ctrl+Z: Undo (when not in input field)
 * - Cmd/Ctrl+Shift+Z: Redo (when not in input field)
 * - Escape: Cancel current operation/close modals
 *
 * Features:
 * - Automatically detects Mac vs Windows/Linux for correct modifier key
 * - Prevents shortcuts from triggering while user is typing in inputs/textareas
 * - Handles both preventDefault and stopPropagation to prevent conflicts
 * - Sets up global event listener on mount and cleans up on unmount
 * - Integrates with Zustand store actions via useLayyrrStore
 *
 * @returns {void}
 *
 * @example
 * ```tsx
 * function App() {
 *   useKeyboardShortcuts();
 *
 *   return (
 *     <div>
 *       <Editor />
 *     </div>
 *   );
 * }
 * ```
 */
const useKeyboardShortcuts = (): void => {
  const {
    toggleEditMode,
    toggleHistoryPanel,
    undo,
    redo,
    hideInlineInput,
    hideTextEditor,
    hideActionMenu,
  } = useLayyrrStore();

  /**
   * Handle keydown events and trigger appropriate actions based on the key combination.
   * Checks for modifier keys (Cmd on Mac, Ctrl on Windows/Linux) and prevents
   * shortcuts from triggering when user is typing in input fields.
   *
   * @param {KeyboardEvent} event - The keyboard event from the keydown listener
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Determine the modifier key based on platform
      const isMac = isMacOS();
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      // Handle Escape key - cancel current operations and close modals
      if (event.key === 'Escape') {
        hideInlineInput();
        hideTextEditor();
        hideActionMenu();
        return;
      }

      // Prevent shortcuts from triggering while user is typing
      if (isUserTyping()) {
        return;
      }

      // Cmd/Ctrl+Shift+E: Toggle edit/browse mode
      if (modifierKey && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        event.stopPropagation();
        toggleEditMode();
        return;
      }

      // Cmd/Ctrl+Shift+H: Toggle history panel
      if (modifierKey && event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        event.stopPropagation();
        toggleHistoryPanel();
        return;
      }

      // Cmd/Ctrl+Z: Undo (when not using shift)
      if (modifierKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.stopPropagation();
        undo();
        return;
      }

      // Cmd/Ctrl+Shift+Z: Redo
      if (modifierKey && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.stopPropagation();
        redo();
        return;
      }
    },
    [toggleEditMode, toggleHistoryPanel, undo, redo, hideInlineInput, hideTextEditor, hideActionMenu]
  );

  /**
   * Register global keyboard event listener on component mount.
   * Listens for keydown events and triggers appropriate actions.
   * Cleans up event listener on component unmount to prevent memory leaks.
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

export default useKeyboardShortcuts;
