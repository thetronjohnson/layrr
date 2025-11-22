interface ElementInfo {
  tagName: string;
  classes: string[];
  id: string;
  selector: string;
  bounds: DOMRect;
  innerText?: string;
  outerHTML?: string;
  componentSource?: ComponentSource | null;
}

interface ComponentSource {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
  componentName: string;
  method: 'fiber' | 'static';
}

/**
 * Helper: Find React Fiber from DOM element
 */
function getReactFiberFromElement(element: any): any {
  const fiberKey = Object.keys(element).find(key =>
    key.startsWith('__reactFiber$') ||
    key.startsWith('__reactInternalInstance$')
  );
  return fiberKey ? element[fiberKey] : null;
}

/**
 * Helper: Get component display name from Fiber node
 */
function getComponentDisplayName(fiber: any): string {
  const type = fiber.type;
  if (!type) return 'Unknown';
  if (typeof type === 'string') return type;
  if (type.displayName) return type.displayName;
  if (type.name) return type.name;
  return 'Anonymous';
}

/**
 * Find component source from React Fiber tree (works in React 18)
 */
function findComponentSourceFromFiber(element: HTMLElement): ComponentSource | null {
  try {
    const fiber = getReactFiberFromElement(element);
    if (!fiber) {
      console.log('[Layrr] No React Fiber found on element');
      return null;
    }

    let current = fiber;
    let depth = 0;
    const maxDepth = 50;

    while (current && depth < maxDepth) {
      if (current._debugSource) {
        const { fileName, lineNumber, columnNumber } = current._debugSource;
        const componentName = getComponentDisplayName(current);

        console.log('[Layrr] Found component source via Fiber:', {
          fileName,
          lineNumber,
          componentName
        });

        return {
          fileName,
          lineNumber: lineNumber || 0,
          columnNumber: columnNumber || 0,
          componentName,
          method: 'fiber'
        };
      }
      current = current.return;
      depth++;
    }

    console.log('[Layrr] No _debugSource found in Fiber tree (React 19?)');
    return null;
  } catch (error) {
    console.error('[Layrr] Error walking Fiber tree:', error);
    return null;
  }
}

/**
 * Minimal injection for Layrr
 * Only handles:
 * 1. Hover highlighting (when in selection mode)
 * 2. Element selection on click
 * 3. Color picker mode
 * 4. Resize mode with visual handles
 * 5. Communication with sidebar via postMessage
 * 6. WebSocket communication with backend
 */
class MinimalLayrr {
  private isSelectionMode = false;
  private isColorPickerMode = false;
  private hoveredElement: HTMLElement | null = null;
  private highlightOverlay: HTMLDivElement | null = null;
  private ws: WebSocket | null = null;
  private reloadWs: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pendingReload = false;
  private isProcessing = false;

  constructor() {
    this.init();
  }

  private init() {
    console.log('[Layrr Minimal] Initializing...');

    // Create highlight overlay
    this.createHighlightOverlay();

    // Connect to WebSocket
    this.connectWebSocket();

    // Connect to reload WebSocket for hot reload
    this.connectReloadWebSocket();

    // Listen for messages from sidebar
    window.addEventListener('message', this.handleMessage.bind(this));

    // Add event listeners
    document.addEventListener('mousemove', this.handleMouseMove.bind(this), true);
    document.addEventListener('click', this.handleClick.bind(this), true);

    // Notify sidebar that we're ready
    this.postMessage({ type: 'LAYRR_READY' });

    console.log('[Layrr Minimal] Ready');
  }

  private connectWebSocket() {
    try {
      const wsUrl = `ws://${window.location.host}/__layrr/ws/message`;
      console.log('[Layrr Minimal] Connecting to WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Layrr Minimal] ✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.postMessage({ type: 'LAYRR_WS_CONNECTED' });
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('[Layrr Minimal] 📨 Message from backend:', data);
        console.log('[Layrr Minimal] 📨 Message status:', data.status);
        console.log('[Layrr Minimal] 📨 Message id:', data.id);

        // Track processing state
        if (data.status === 'received') {
          this.isProcessing = true;
          console.log('[Layrr Minimal] 🔄 Processing started...');
        } else if (data.status === 'complete' || data.status === 'error') {
          this.isProcessing = false;
          console.log('[Layrr Minimal] ✅ Processing finished');

          // If reload is pending, do it now after completion
          if (this.pendingReload) {
            console.log('[Layrr Minimal] 🔄 Executing pending reload...');
            setTimeout(() => {
              window.location.reload();
            }, 500); // Small delay to ensure message reaches parent
          }
        }

        // Forward to parent window
        const responseMessage = {
          type: 'MESSAGE_RESPONSE',
          payload: data
        };
        console.log('[Layrr Minimal] 📤 Forwarding to parent window:', responseMessage);
        this.postMessage(responseMessage);
      };

      this.ws.onerror = (error) => {
        console.error('[Layrr Minimal] ❌ WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[Layrr Minimal] 🔌 WebSocket disconnected');
        this.postMessage({ type: 'LAYRR_WS_DISCONNECTED' });

        // Attempt to reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = 1000 * Math.pow(2, this.reconnectAttempts);
          console.log(`[Layrr Minimal] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connectWebSocket();
          }, delay);
        }
      };
    } catch (error) {
      console.error('[Layrr Minimal] Failed to create WebSocket:', error);
    }
  }

  private connectReloadWebSocket() {
    try {
      const wsUrl = `ws://${window.location.host}/__layrr/ws/reload`;
      console.log('[Layrr Minimal] Connecting to reload WebSocket:', wsUrl);

      this.reloadWs = new WebSocket(wsUrl);

      this.reloadWs.onopen = () => {
        console.log('[Layrr Minimal] ✅ Reload WebSocket connected');
      };

      this.reloadWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'reload') {
          // If we're currently processing a message, defer the reload
          if (this.isProcessing) {
            console.log('[Layrr Minimal] ⏳ Reload requested but processing in progress, will reload after completion...');
            this.pendingReload = true;
          } else {
            console.log('[Layrr Minimal] 🔄 Reloading page due to file changes...');
            window.location.reload();
          }
        }
      };

      this.reloadWs.onerror = (error) => {
        console.error('[Layrr Minimal] ❌ Reload WebSocket error:', error);
      };

      this.reloadWs.onclose = () => {
        console.log('[Layrr Minimal] 🔌 Reload WebSocket closed');
        // Don't reconnect - if it closes, we probably don't need it anymore
      };
    } catch (error) {
      console.error('[Layrr Minimal] Failed to create reload WebSocket:', error);
    }
  }

  private createHighlightOverlay() {
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = 'layrr-highlight';
    this.highlightOverlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 2147483646;
      border: 2px solid #a78bfa;
      background: rgba(167, 139, 250, 0.1);
      transition: all 0.15s ease-out;
      display: none;
    `;
    document.body.appendChild(this.highlightOverlay);
  }

  private handleMessage(event: MessageEvent) {
    const { type, payload } = event.data;

    switch (type) {
      case 'ENABLE_SELECTION_MODE':
        this.enableSelectionMode();
        break;
      case 'DISABLE_SELECTION_MODE':
        this.disableSelectionMode();
        break;
      case 'ENABLE_COLOR_PICKER_MODE':
        this.enableColorPickerMode();
        break;
      case 'DISABLE_COLOR_PICKER_MODE':
        this.disableColorPickerMode();
        break;
      case 'HIGHLIGHT_ELEMENT':
        this.highlightElementBySelector(payload.selector);
        break;
      case 'SEND_ELEMENT_MESSAGE':
      case 'SEND_VISION_MESSAGE':
      case 'SEND_ATTACHMENT_MESSAGE':
      case 'DIRECT_IMAGE_REPLACE':
        // Forward message to WebSocket backend
        // Need to include the type field for backend routing
        this.sendToWebSocket({
          type: type.toLowerCase().replace(/_/g, '-'),
          payload: payload
        });
        break;
    }
  }

  private sendToWebSocket(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[Layrr Minimal] 📤 Sending to WebSocket:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[Layrr Minimal] ❌ WebSocket not connected, cannot send message');
      // Notify parent of error
      this.postMessage({
        type: 'MESSAGE_RESPONSE',
        payload: {
          id: message.id,
          status: 'error',
          error: 'WebSocket not connected'
        }
      });
    }
  }

  private enableSelectionMode() {
    this.isSelectionMode = true;
    document.body.style.cursor = 'crosshair';
    console.log('[Layrr Minimal] Selection mode enabled');
  }

  private disableSelectionMode() {
    this.isSelectionMode = false;
    document.body.style.cursor = '';
    this.hideHighlight();
    console.log('[Layrr Minimal] Selection mode disabled');
  }

  private enableColorPickerMode() {
    this.isColorPickerMode = true;
    document.body.style.cursor = 'crosshair';
    console.log('[Layrr Minimal] Color picker mode enabled');
  }

  private disableColorPickerMode() {
    this.isColorPickerMode = false;
    document.body.style.cursor = '';
    this.hideHighlight();
    console.log('[Layrr Minimal] Color picker mode disabled');
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isSelectionMode && !this.isColorPickerMode) return;

    const target = e.target as HTMLElement;

    // Ignore our own overlays
    if (target.id === 'layrr-highlight') return;

    // Ignore Layrr container
    if (target.id === 'layrr-container' || target.closest('#layrr-container')) return;

    if (target !== this.hoveredElement) {
      this.hoveredElement = target;
      this.showHighlight(target);
    }
  }

  private handleClick(e: MouseEvent) {
    if (!this.isSelectionMode && !this.isColorPickerMode) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;

    // Ignore our own overlays
    if (target.id === 'layrr-highlight') return;

    // Ignore Layrr container
    if (target.id === 'layrr-container' || target.closest('#layrr-container')) return;

    if (this.isColorPickerMode) {
      this.pickColor(target);
    } else {
      this.selectElement(target);
    }
  }

  private selectElement(element: HTMLElement) {
    const info = this.getElementInfo(element);

    console.log('[Layrr Minimal] Element selected:', info);

    // Send to sidebar
    this.postMessage({
      type: 'ELEMENT_SELECTED',
      payload: info
    });

    // Disable selection mode after selection
    this.disableSelectionMode();
  }

  private pickColor(element: HTMLElement) {
    // Get computed styles
    const computedStyle = window.getComputedStyle(element);
    const backgroundColor = computedStyle.backgroundColor;
    const color = computedStyle.color;

    // Convert RGB to hex
    const bgHex = this.rgbToHex(backgroundColor);
    const textHex = this.rgbToHex(color);

    console.log('[Layrr Minimal] Color picked:', { backgroundColor: bgHex, textColor: textHex });

    // Send to sidebar
    this.postMessage({
      type: 'COLOR_PICKED',
      payload: {
        backgroundColor: bgHex,
        textColor: textHex,
        element: {
          tagName: element.tagName,
          selector: this.generateSelector(element)
        }
      }
    });

    // Disable color picker mode after picking
    this.disableColorPickerMode();
  }

  private rgbToHex(rgb: string): string {
    // Handle rgba, rgb, and hex formats
    if (rgb.startsWith('#')) return rgb;

    // Handle transparent
    if (rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') {
      return 'transparent';
    }

    const match = rgb.match(/\d+/g);
    if (!match) return rgb;

    const [r, g, b] = match.map(Number);
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  private generateSelector(element: HTMLElement): string {
    const classes = Array.from(element.classList);
    const id = element.id;
    const tagName = element.tagName;

    let selector = tagName.toLowerCase();
    if (id) {
      selector = `#${id}`;
    } else if (classes.length > 0) {
      selector += '.' + classes.join('.');
    }
    return selector;
  }

  private getElementInfo(element: HTMLElement): ElementInfo {
    const bounds = element.getBoundingClientRect();
    const classes = Array.from(element.classList);
    const id = element.id;
    const tagName = element.tagName;

    // Generate CSS selector
    let selector = tagName.toLowerCase();
    if (id) {
      selector = `#${id}`;
    } else if (classes.length > 0) {
      selector += '.' + classes.join('.');
    } else {
      // Generate nth-child selector
      const parent = element.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(element) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    // Try to find component source
    const componentSource = findComponentSourceFromFiber(element);

    return {
      tagName,
      classes,
      id,
      selector,
      bounds: bounds.toJSON(),
      innerText: element.innerText,
      outerHTML: element.outerHTML,
      componentSource
    };
  }

  private showHighlight(element: HTMLElement) {
    if (!this.highlightOverlay) return;

    const bounds = element.getBoundingClientRect();

    this.highlightOverlay.style.display = 'block';
    this.highlightOverlay.style.top = bounds.top + window.scrollY + 'px';
    this.highlightOverlay.style.left = bounds.left + window.scrollX + 'px';
    this.highlightOverlay.style.width = bounds.width + 'px';
    this.highlightOverlay.style.height = bounds.height + 'px';
  }

  private hideHighlight() {
    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';
    }
    this.hoveredElement = null;
  }

  private highlightElementBySelector(selector: string) {
    try {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        this.showHighlight(element);
        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (error) {
      console.error('[Layrr Minimal] Invalid selector:', selector, error);
    }
  }

  private postMessage(message: any) {
    // Post to parent window (sidebar iframe)
    window.parent.postMessage(message, '*');
  }
}

// Initialize
if (typeof window !== 'undefined') {
  new MinimalLayrr();
}
