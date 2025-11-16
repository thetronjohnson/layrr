// Constants for Layrr Visual Editor

export const TIMING = {
  HOVER_CHECK_THROTTLE: 16, // ~60fps
  PROCESSING_TIMEOUT: 300000, // 5 minutes max
  CLICK_DOUBLE_CLICK_DELAY: 250, // ms to distinguish single from double click
  RELOAD_DELAY: 1500, // ms before auto-reload after completion
  WS_RECONNECT_DELAY: 2000, // ms before reconnecting WebSocket
  ERROR_RELOAD_DELAY: 2000, // ms before reloading on error
} as const;

export const UI_DIMENSIONS = {
  INPUT_WIDTH: 320,
  INPUT_HEIGHT: 140,
  EDITOR_WIDTH: 400,
  EDITOR_HEIGHT: 200,
  UI_PADDING: 20,
} as const;

export const SELECTION_CONSTRAINTS = {
  MIN_DRAG_DISTANCE: 10, // px minimum drag to show selection
  MIN_SELECTION_SIZE: 10, // px minimum selection width/height
  CLICK_MAX_DISTANCE: 5, // px maximum movement to be considered a click
  CLICK_MAX_DURATION: 200, // ms maximum duration to be considered a click
  MIN_ELEMENT_SIZE: 5, // px minimum element size to be selectable
  MAX_ELEMENT_DEPTH: 3, // Maximum depth when finding parent elements
} as const;

export const STORAGE_KEYS = {
  EDIT_MODE: 'vc-edit-mode',
} as const;

export const WS_ENDPOINTS = {
  RELOAD_PATH: '/__layrr/ws/reload',
  MESSAGE_PATH: '/__layrr/ws/message',
} as const;

export const CURSOR = {
  URL: '/__layrr/cursor.svg',
  HOTSPOT: '8 6',
} as const;

export const EDITABLE_TAGS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'span', 'a', 'button', 'label', 'li', 'td', 'th', 'div'
] as const;

export const VC_UI_SELECTOR = [
  '.vc-selection-rect',
  '.vc-selection-info',
  '.vc-inline-input',
  '.vc-status-indicator',
  '.vc-text-editor',
  '.vc-mode-toolbar',
  '.vc-design-modal',
  '.vc-control-bar',
  '.vc-drag-handles',
  '.vc-visual-toolbar',
  '.vc-hover-drag-handle',
  '.vc-reorder-placeholder',
  '.vc-action-menu',
  '.vc-history-panel',
].join(', ');
