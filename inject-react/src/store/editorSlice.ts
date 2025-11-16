import type { StateCreator } from 'zustand';
import type { LayyrrStore } from './index';

export interface EditorSlice {
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
  clickTimeout: ReturnType<typeof setTimeout> | null;

  // Actions
  showInlineInputFor: (element: HTMLElement, style: string, badge: string) => void;
  hideInlineInput: () => void;
  setInlineInputText: (text: string) => void;
  submitInlineInput: () => void;
  showTextEditorFor: (element: HTMLElement, style: string, label: string, value: string) => void;
  hideTextEditor: () => void;
  setTextEditorValue: (value: string) => void;
  updateTextEditorPreview: (preview: string) => void;
  submitTextEditor: () => void;
  setClickTimeout: (timeout: ReturnType<typeof setTimeout> | null) => void;
}

export const createEditorSlice: StateCreator<
  LayyrrStore,
  [],
  [],
  EditorSlice
> = (set, get) => ({
  currentEditingElement: null,
  showInlineInput: false,
  showTextEditor: false,
  inlineInputStyle: '',
  inlineInputBadge: '',
  inlineInputText: '',
  textEditorStyle: '',
  textEditorLabel: 'Edit text content',
  textEditorValue: '',
  textEditorPreview: '',
  clickTimeout: null,

  showInlineInputFor: (element, style, badge) => {
    set({
      currentEditingElement: element,
      showInlineInput: true,
      inlineInputStyle: style,
      inlineInputBadge: badge,
      inlineInputText: '',
    });
  },

  hideInlineInput: () => {
    set({
      showInlineInput: false,
      inlineInputStyle: '',
      inlineInputBadge: '',
      inlineInputText: '',
      currentEditingElement: null,
    });
  },

  setInlineInputText: (text) => {
    set({ inlineInputText: text });
  },

  submitInlineInput: () => {
    const { inlineInputText, currentEditingElement } = get();

    if (!inlineInputText.trim() || !currentEditingElement) {
      get().hideInlineInput();
      return;
    }

    // TODO: Send to backend via WebSocket
    console.log('[Editor] Submit inline input:', inlineInputText, currentEditingElement);

    get().hideInlineInput();
  },

  showTextEditorFor: (element, style, label, value) => {
    set({
      currentEditingElement: element,
      showTextEditor: true,
      textEditorStyle: style,
      textEditorLabel: label,
      textEditorValue: value,
      textEditorPreview: value,
    });
  },

  hideTextEditor: () => {
    set({
      showTextEditor: false,
      textEditorStyle: '',
      textEditorLabel: 'Edit text content',
      textEditorValue: '',
      textEditorPreview: '',
      currentEditingElement: null,
    });
  },

  setTextEditorValue: (value) => {
    set({
      textEditorValue: value,
      textEditorPreview: value,
    });
  },

  updateTextEditorPreview: (preview) => {
    set({ textEditorPreview: preview });
  },

  submitTextEditor: () => {
    const { textEditorValue, currentEditingElement } = get();

    if (!textEditorValue.trim() || !currentEditingElement) {
      get().hideTextEditor();
      return;
    }

    // TODO: Send to backend via WebSocket
    console.log('[Editor] Submit text editor:', textEditorValue, currentEditingElement);

    get().hideTextEditor();
  },

  setClickTimeout: (timeout) => {
    // Clear existing timeout
    const { clickTimeout } = get();
    if (clickTimeout) {
      clearTimeout(clickTimeout);
    }

    set({ clickTimeout: timeout });
  },
});
