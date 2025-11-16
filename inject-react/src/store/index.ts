import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createSelectionSlice, type SelectionSlice } from './selectionSlice';
import { createDragDropSlice, type DragDropSlice } from './dragDropSlice';
import { createHistorySlice, type HistorySlice } from './historySlice';
import { createDesignSlice, type DesignSlice } from './designSlice';
import { createEditorSlice, type EditorSlice } from './editorSlice';

export interface LayyrrStore extends
  SelectionSlice,
  DragDropSlice,
  HistorySlice,
  DesignSlice,
  EditorSlice {
  // Global app state
  isEditMode: boolean;
  isProcessing: boolean;
  messageIdCounter: number;
  currentMessageId: number | null;
  showStatusIndicator: boolean;
  statusText: string;
  statusClass: string;
  showActionMenu: boolean;
  actionMenuStyle: string;
  actionMenuElement: HTMLElement | null;
  pendingBatchResolvers: Record<number, (value: unknown) => void>;
  batchIdMapping: Record<number, number>;

  // Global actions
  setEditMode: (isEditMode: boolean) => void;
  toggleEditMode: () => void;
  setProcessing: (isProcessing: boolean, text?: string) => void;
  showStatus: (text: string, className: string, duration?: number) => void;
  hideStatus: () => void;
  incrementMessageId: () => number;
  setActionMenu: (element: HTMLElement | null, style?: string) => void;
  hideActionMenu: () => void;
  addBatchResolver: (messageId: number, batchNumber: number, resolver: (value: unknown) => void) => void;
  resolveBatch: (batchNumber: number, value: unknown) => void;
}

export const useLayyrrStore = create<LayyrrStore>()(
  devtools(
    (set, get) => ({
      // Global state
      isEditMode: true,
      isProcessing: false,
      messageIdCounter: 0,
      currentMessageId: null,
      showStatusIndicator: false,
      statusText: '',
      statusClass: '',
      showActionMenu: false,
      actionMenuStyle: '',
      actionMenuElement: null,
      pendingBatchResolvers: {},
      batchIdMapping: {},

      // Global actions
      setEditMode: (isEditMode) => {
        set({ isEditMode });
        localStorage.setItem('vc-edit-mode', String(isEditMode));
      },

      toggleEditMode: () => {
        const { isEditMode } = get();
        get().setEditMode(!isEditMode);
      },

      setProcessing: (isProcessing, text = 'Processing...') => {
        set({
          isProcessing,
          showStatusIndicator: isProcessing,
          statusText: text,
          statusClass: 'processing',
        });
      },

      showStatus: (text, className, duration = 3000) => {
        set({
          showStatusIndicator: true,
          statusText: text,
          statusClass: className,
        });

        if (duration > 0) {
          setTimeout(() => {
            get().hideStatus();
          }, duration);
        }
      },

      hideStatus: () => {
        set({
          showStatusIndicator: false,
          statusText: '',
          statusClass: '',
        });
      },

      incrementMessageId: () => {
        const newId = get().messageIdCounter + 1;
        set({
          messageIdCounter: newId,
          currentMessageId: newId,
        });
        return newId;
      },

      setActionMenu: (element, style = '') => {
        set({
          showActionMenu: !!element,
          actionMenuElement: element,
          actionMenuStyle: style,
        });
      },

      hideActionMenu: () => {
        set({
          showActionMenu: false,
          actionMenuElement: null,
          actionMenuStyle: '',
        });
      },

      addBatchResolver: (messageId, batchNumber, resolver) => {
        set((state) => ({
          pendingBatchResolvers: {
            ...state.pendingBatchResolvers,
            [batchNumber]: resolver,
          },
          batchIdMapping: {
            ...state.batchIdMapping,
            [messageId]: batchNumber,
          },
        }));
      },

      resolveBatch: (batchNumber, value) => {
        const { pendingBatchResolvers } = get();
        const resolver = pendingBatchResolvers[batchNumber];

        if (resolver) {
          resolver(value);

          set((state) => {
            const { [batchNumber]: _, ...rest } = state.pendingBatchResolvers;
            return { pendingBatchResolvers: rest };
          });
        }
      },

      // Merge slice creators
      ...(createSelectionSlice as any)(set, get),
      ...(createDragDropSlice as any)(set, get),
      ...(createHistorySlice as any)(set, get),
      ...(createDesignSlice as any)(set, get),
      ...(createEditorSlice as any)(set, get),
    }),
    { name: 'Layrr Store' }
  )
);

// Selector hooks for performance optimization
export const useIsEditMode = () => useLayyrrStore((state) => state.isEditMode);
export const useIsProcessing = () => useLayyrrStore((state) => state.isProcessing);
export const useSelection = () => useLayyrrStore((state) => ({
  selectedElements: state.selectedElements,
  selectedElement: state.selectedElement,
  showSelectionRect: state.showSelectionRect,
}));
export const useDragDrop = () => useLayyrrStore((state) => ({
  dragHandle: state.dragHandle,
  reorderMode: state.reorderMode,
  showResizeHandles: state.showResizeHandles,
}));
export const useHistory = () => useLayyrrStore((state) => ({
  changeHistory: state.changeHistory,
  canUndo: state.undoStack.length > 0,
  canRedo: state.redoStack.length > 0,
}));
