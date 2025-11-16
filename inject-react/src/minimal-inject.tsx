interface ElementInfo {
  tagName: string;
  classes: string[];
  id: string;
  selector: string;
  bounds: DOMRect;
}

/**
 * Minimal injection for Layrr
 * Only handles:
 * 1. Hover highlighting (when in selection mode)
 * 2. Element selection on click
 * 3. Communication with sidebar via postMessage
 */
class MinimalLayrr {
  private isSelectionMode = false;
  private hoveredElement: HTMLElement | null = null;
  private highlightOverlay: HTMLDivElement | null = null;

  constructor() {
    this.init();
  }

  private init() {
    console.log('[Layrr Minimal] Initializing...');

    // Create highlight overlay
    this.createHighlightOverlay();

    // Listen for messages from sidebar
    window.addEventListener('message', this.handleMessage.bind(this));

    // Add event listeners
    document.addEventListener('mousemove', this.handleMouseMove.bind(this), true);
    document.addEventListener('click', this.handleClick.bind(this), true);

    // Notify sidebar that we're ready
    this.postMessage({ type: 'LAYRR_READY' });

    console.log('[Layrr Minimal] Ready');
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
      case 'HIGHLIGHT_ELEMENT':
        this.highlightElementBySelector(payload.selector);
        break;
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

  private handleMouseMove(e: MouseEvent) {
    if (!this.isSelectionMode) return;

    const target = e.target as HTMLElement;

    // Ignore our own overlay
    if (target.id === 'layrr-highlight') return;

    // Ignore Layrr container
    if (target.id === 'layrr-container' || target.closest('#layrr-container')) return;

    if (target !== this.hoveredElement) {
      this.hoveredElement = target;
      this.showHighlight(target);
    }
  }

  private handleClick(e: MouseEvent) {
    if (!this.isSelectionMode) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;

    // Ignore our own overlay
    if (target.id === 'layrr-highlight') return;

    // Ignore Layrr container
    if (target.id === 'layrr-container' || target.closest('#layrr-container')) return;

    this.selectElement(target);
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

    return {
      tagName,
      classes,
      id,
      selector,
      bounds: bounds.toJSON()
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
