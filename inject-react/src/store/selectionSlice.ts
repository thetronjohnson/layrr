import type { StateCreator } from 'zustand';
import type { LayyrrStore } from './index';

export interface SelectionSlice {
  // Selection state
  isDragging: boolean;
  dragStart: { x: number; y: number } | null;
  dragEnd: { x: number; y: number } | null;
  dragStartTime: number | null;
  selectedElements: HTMLElement[];
  currentHoveredElement: HTMLElement | null;
  selectedElement: HTMLElement | null;
  lastHoverCheckTime: number;

  // UI state
  showSelectionRect: boolean;
  showSelectionInfo: boolean;
  selectionRectStyle: string;
  selectionInfoStyle: string;
  selectionInfoText: string;

  // Actions
  startDragging: (x: number, y: number) => void;
  updateDragging: (x: number, y: number) => void;
  endDragging: () => void;
  setSelectedElements: (elements: HTMLElement[]) => void;
  setSelectedElement: (element: HTMLElement | null) => void;
  setHoveredElement: (element: HTMLElement | null) => void;
  updateSelectionRect: (style: string) => void;
  updateSelectionInfo: (style: string, text: string) => void;
  showSelectionUI: () => void;
  hideSelectionUI: () => void;
  clearSelection: () => void;
}

export const createSelectionSlice: StateCreator<
  LayyrrStore,
  [],
  [],
  SelectionSlice
> = (set, get) => ({
  // Initial state
  isDragging: false,
  dragStart: null,
  dragEnd: null,
  dragStartTime: null,
  selectedElements: [],
  currentHoveredElement: null,
  selectedElement: null,
  lastHoverCheckTime: 0,
  showSelectionRect: false,
  showSelectionInfo: false,
  selectionRectStyle: '',
  selectionInfoStyle: '',
  selectionInfoText: '',

  // Actions
  startDragging: (x, y) => {
    set({
      isDragging: true,
      dragStart: { x, y },
      dragEnd: { x, y },
      dragStartTime: Date.now(),
      showSelectionRect: false,
      selectedElements: [],
    });
  },

  updateDragging: (x, y) => {
    if (!get().isDragging) return;

    set({
      dragEnd: { x, y },
      showSelectionRect: true,
    });
  },

  endDragging: () => {
    set({
      isDragging: false,
      dragStart: null,
      dragEnd: null,
      dragStartTime: null,
      showSelectionRect: false,
    });
  },

  setSelectedElements: (elements) => {
    set({ selectedElements: elements });
  },

  setSelectedElement: (element) => {
    set({
      selectedElement: element,
      selectedElements: element ? [element] : [],
    });
  },

  setHoveredElement: (element) => {
    set({
      currentHoveredElement: element,
      lastHoverCheckTime: Date.now(),
    });
  },

  updateSelectionRect: (style) => {
    set({
      selectionRectStyle: style,
      showSelectionRect: true,
    });
  },

  updateSelectionInfo: (style, text) => {
    set({
      selectionInfoStyle: style,
      selectionInfoText: text,
      showSelectionInfo: true,
    });
  },

  showSelectionUI: () => {
    set({
      showSelectionRect: true,
      showSelectionInfo: true,
    });
  },

  hideSelectionUI: () => {
    set({
      showSelectionRect: false,
      showSelectionInfo: false,
      selectionRectStyle: '',
      selectionInfoStyle: '',
      selectionInfoText: '',
    });
  },

  clearSelection: () => {
    set({
      selectedElements: [],
      selectedElement: null,
      currentHoveredElement: null,
      showSelectionRect: false,
      showSelectionInfo: false,
      isDragging: false,
      dragStart: null,
      dragEnd: null,
    });
  },
});
