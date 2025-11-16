import type { StateCreator } from 'zustand';
import type { LayyrrStore } from './index';
import type { DragHandleState, ReorderModeState } from '../types';

export interface DragDropSlice {
  // Drag handle state
  dragHandle: DragHandleState;
  showResizeHandles: boolean;
  resizeHandlesStyle: string;
  showHoverDragHandle: boolean;
  hoverDragHandleStyle: string;
  hoverDragHandleElement: HTMLElement | null;

  // Reorder mode state
  reorderMode: ReorderModeState;
  showReorderPlaceholder: boolean;
  reorderPlaceholderStyle: string;

  // Drop validation state
  currentDropTarget: HTMLElement | null;
  showDropWarning: boolean;
  dropWarningText: string;
  dropWarningStyle: string;
  isValidDrop: boolean;

  // Actions
  startDragFromHandle: (element: HTMLElement, x: number, y: number) => void;
  startResize: (direction: DragHandleState['resizeDirection'], x: number, y: number, element: HTMLElement) => void;
  updateDragHandle: (x: number, y: number) => void;
  endDragHandle: () => void;
  showResizeHandlesFor: (element: HTMLElement, style: string) => void;
  hideResizeHandles: () => void;
  showHoverHandle: (element: HTMLElement, style: string) => void;
  hideHoverHandle: () => void;
  startReorderMode: (element: HTMLElement) => void;
  updateReorderMode: (target: HTMLElement | null, insertBefore: boolean) => void;
  endReorderMode: () => void;
  setDropTarget: (target: HTMLElement | null, isValid: boolean, warning?: string) => void;
  clearDropTarget: () => void;
}

export const createDragDropSlice: StateCreator<
  LayyrrStore,
  [],
  [],
  DragDropSlice
> = (set, get) => ({
  // Initial state
  dragHandle: {
    isDragging: false,
    isResizing: false,
    isDraggingFromHandle: false,
    resizeDirection: '',
    startX: 0,
    startY: 0,
    elementStartX: 0,
    elementStartY: 0,
    elementStartWidth: 0,
    elementStartHeight: 0,
  },
  showResizeHandles: false,
  resizeHandlesStyle: '',
  showHoverDragHandle: false,
  hoverDragHandleStyle: '',
  hoverDragHandleElement: null,

  reorderMode: {
    isActive: false,
    layoutContext: null,
    siblingArrangement: null,
    currentTarget: null,
    insertBefore: true,
    originalIndex: -1,
    newIndex: -1,
    draggedElementWidth: 0,
    draggedElementHeight: 0,
  },
  showReorderPlaceholder: false,
  reorderPlaceholderStyle: '',

  currentDropTarget: null,
  showDropWarning: false,
  dropWarningText: '',
  dropWarningStyle: '',
  isValidDrop: true,

  // Actions
  startDragFromHandle: (element, x, y) => {
    const rect = element.getBoundingClientRect();
    set({
      dragHandle: {
        isDragging: true,
        isResizing: false,
        isDraggingFromHandle: true,
        resizeDirection: '',
        startX: x,
        startY: y,
        elementStartX: rect.left,
        elementStartY: rect.top,
        elementStartWidth: rect.width,
        elementStartHeight: rect.height,
      },
      showHoverDragHandle: false,
    });
  },

  startResize: (direction, x, y, element) => {
    const rect = element.getBoundingClientRect();
    set({
      dragHandle: {
        isDragging: false,
        isResizing: true,
        isDraggingFromHandle: false,
        resizeDirection: direction,
        startX: x,
        startY: y,
        elementStartX: rect.left,
        elementStartY: rect.top,
        elementStartWidth: rect.width,
        elementStartHeight: rect.height,
      },
    });
  },

  updateDragHandle: (x, y) => {
    const { dragHandle } = get();
    if (!dragHandle.isDragging && !dragHandle.isResizing) return;

    // Just update the coordinates, actual element manipulation happens in the component
    set({
      dragHandle: {
        ...dragHandle,
        startX: x,
        startY: y,
      },
    });
  },

  endDragHandle: () => {
    set({
      dragHandle: {
        isDragging: false,
        isResizing: false,
        isDraggingFromHandle: false,
        resizeDirection: '',
        startX: 0,
        startY: 0,
        elementStartX: 0,
        elementStartY: 0,
        elementStartWidth: 0,
        elementStartHeight: 0,
      },
      showResizeHandles: false,
    });
  },

  showResizeHandlesFor: (_element, style) => {
    set({
      showResizeHandles: true,
      resizeHandlesStyle: style,
    });
  },

  hideResizeHandles: () => {
    set({
      showResizeHandles: false,
      resizeHandlesStyle: '',
    });
  },

  showHoverHandle: (element, style) => {
    set({
      showHoverDragHandle: true,
      hoverDragHandleStyle: style,
      hoverDragHandleElement: element,
    });
  },

  hideHoverHandle: () => {
    set({
      showHoverDragHandle: false,
      hoverDragHandleStyle: '',
      hoverDragHandleElement: null,
    });
  },

  startReorderMode: (element) => {
    const rect = element.getBoundingClientRect();
    set({
      reorderMode: {
        isActive: true,
        layoutContext: null,
        siblingArrangement: null,
        currentTarget: null,
        insertBefore: true,
        originalIndex: -1,
        newIndex: -1,
        draggedElementWidth: rect.width,
        draggedElementHeight: rect.height,
      },
    });
  },

  updateReorderMode: (target, insertBefore) => {
    const { reorderMode } = get();
    set({
      reorderMode: {
        ...reorderMode,
        currentTarget: target,
        insertBefore,
      },
      showReorderPlaceholder: !!target,
    });
  },

  endReorderMode: () => {
    set({
      reorderMode: {
        isActive: false,
        layoutContext: null,
        siblingArrangement: null,
        currentTarget: null,
        insertBefore: true,
        originalIndex: -1,
        newIndex: -1,
        draggedElementWidth: 0,
        draggedElementHeight: 0,
      },
      showReorderPlaceholder: false,
      reorderPlaceholderStyle: '',
    });
  },

  setDropTarget: (target, isValid, warning = '') => {
    set({
      currentDropTarget: target,
      isValidDrop: isValid,
      showDropWarning: !isValid && !!warning,
      dropWarningText: warning,
    });
  },

  clearDropTarget: () => {
    set({
      currentDropTarget: null,
      isValidDrop: true,
      showDropWarning: false,
      dropWarningText: '',
      dropWarningStyle: '',
    });
  },
});
