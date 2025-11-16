// Core Types for Layrr Visual Editor

export interface ElementInfo {
  tagName: string;
  id: string;
  classes: string;
  selector: string;
  innerText: string;
  outerHTML: string;
}

export interface AreaInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  elementCount: number;
  elements: ElementInfo[];
}

export interface Message {
  id: number;
  area: AreaInfo;
  instruction: string;
  screenshot: string; // Base64 encoded image
}

export interface DragHandleState {
  isDragging: boolean;
  isResizing: boolean;
  isDraggingFromHandle: boolean;
  resizeDirection: '' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  startX: number;
  startY: number;
  elementStartX: number;
  elementStartY: number;
  elementStartWidth: number;
  elementStartHeight: number;
}

export interface ReorderModeState {
  isActive: boolean;
  layoutContext: string | null;
  siblingArrangement: string | null;
  currentTarget: HTMLElement | null;
  insertBefore: boolean;
  originalIndex: number;
  newIndex: number;
  draggedElementWidth: number;
  draggedElementHeight: number;
}

export interface ChangeHistoryItem {
  id: number;
  timestamp: number;
  description: string;
  fileChanges: Array<{
    file: string;
    changes: string;
  }>;
}

export interface DesignUploadState {
  uploadedImage: string | null;
  uploadedImageType: string;
  imagePreview: string;
  designPrompt: string;
  isAnalyzing: boolean;
  analysisError: string;
  analysisStep: '' | 'analyzing' | 'sending' | 'processing';
  currentDesignMessageId: number | null;
}

export interface SelectionState {
  isDragging: boolean;
  dragStart: { x: number; y: number } | null;
  dragEnd: { x: number; y: number } | null;
  dragStartTime: number | null;
  selectedElements: HTMLElement[];
  currentHoveredElement: HTMLElement | null;
  selectedElement: HTMLElement | null; // For visual editing
  showSelectionRect: boolean;
  showSelectionInfo: boolean;
  selectionRectStyle: string;
  selectionInfoStyle: string;
  selectionInfoText: string;
}

export interface DragDropState {
  dragHandle: DragHandleState;
  reorderMode: ReorderModeState;
  showResizeHandles: boolean;
  resizeHandlesStyle: string;
  showHoverDragHandle: boolean;
  hoverDragHandleStyle: string;
  hoverDragHandleElement: HTMLElement | null;
  showReorderPlaceholder: boolean;
  reorderPlaceholderStyle: string;
  currentDropTarget: HTMLElement | null;
  showDropWarning: boolean;
  dropWarningText: string;
  dropWarningStyle: string;
  isValidDrop: boolean;
}

export interface EditorState {
  currentEditingElement: HTMLElement | null;
  showInlineInput: boolean;
  showTextEditor: boolean;
  inlineInputStyle: string;
  inlineInputBadge: string;
  inlineInputText: string;
  textEditorStyle: string;
  textEditorLabel: string;
  textEditorValue: string;
  textEditorPreview: string;
}

export interface HistoryState {
  showHistoryPanel: boolean;
  changeHistory: ChangeHistoryItem[];
  nextChangeId: number;
  historyIndex: number;
  undoStack: ChangeHistoryItem[];
  redoStack: ChangeHistoryItem[];
}

export interface AppState {
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
  showDesignModal: boolean;
  design: DesignUploadState;
  selection: SelectionState;
  dragDrop: DragDropState;
  editor: EditorState;
  history: HistoryState;
  pendingBatchResolvers: Record<number, (value: unknown) => void>;
  batchIdMapping: Record<number, number>;
}

// WebSocket message types
export interface WSReloadMessage {
  type: 'reload';
}

export interface WSBatchCompleteMessage {
  type: 'batch_complete';
  batch_number: number;
  message_id: number;
}

export type WSMessage = WSReloadMessage | WSBatchCompleteMessage;
