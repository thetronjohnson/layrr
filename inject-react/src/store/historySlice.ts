import type { StateCreator } from 'zustand';
import type { LayyrrStore } from './index';
import type { ChangeHistoryItem } from '../types';

export interface HistorySlice {
  showHistoryPanel: boolean;
  changeHistory: ChangeHistoryItem[];
  nextChangeId: number;
  historyIndex: number;
  undoStack: ChangeHistoryItem[];
  redoStack: ChangeHistoryItem[];

  // Actions
  toggleHistoryPanel: () => void;
  addToHistory: (description: string, fileChanges: ChangeHistoryItem['fileChanges']) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const createHistorySlice: StateCreator<
  LayyrrStore,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  showHistoryPanel: false,
  changeHistory: [],
  nextChangeId: 1,
  historyIndex: -1,
  undoStack: [],
  redoStack: [],

  toggleHistoryPanel: () => {
    set((state) => ({
      showHistoryPanel: !state.showHistoryPanel,
    }));
  },

  addToHistory: (description, fileChanges) => {
    const { nextChangeId, changeHistory } = get();

    const newChange: ChangeHistoryItem = {
      id: nextChangeId,
      timestamp: Date.now(),
      description,
      fileChanges,
    };

    set({
      changeHistory: [...changeHistory, newChange],
      nextChangeId: nextChangeId + 1,
      undoStack: [...get().undoStack, newChange],
      redoStack: [], // Clear redo stack when new change is made
      historyIndex: -1,
    });
  },

  undo: () => {
    const { undoStack, redoStack } = get();

    if (undoStack.length === 0) return;

    const lastChange = undoStack[undoStack.length - 1];

    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, lastChange],
    });

    // TODO: Actually revert the changes (needs file system integration)
    console.log('[History] Undo:', lastChange.description);
  },

  redo: () => {
    const { undoStack, redoStack } = get();

    if (redoStack.length === 0) return;

    const lastUndone = redoStack[redoStack.length - 1];

    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, lastUndone],
    });

    // TODO: Actually reapply the changes (needs file system integration)
    console.log('[History] Redo:', lastUndone.description);
  },

  clearHistory: () => {
    set({
      changeHistory: [],
      nextChangeId: 1,
      historyIndex: -1,
      undoStack: [],
      redoStack: [],
    });
  },

  canUndo: () => {
    return get().undoStack.length > 0;
  },

  canRedo: () => {
    return get().redoStack.length > 0;
  },
});
