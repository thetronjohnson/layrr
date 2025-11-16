import {
  SELECTION_CONSTRAINTS,
  UI_DIMENSIONS,
  EDITABLE_TAGS,
  VC_UI_SELECTOR,
} from './constants';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width?: number;
  height?: number;
}

interface Point {
  x: number;
  y: number;
}

interface ElementInfo {
  tagName: string;
  id: string;
  classes: string;
  selector: string;
  innerText: string;
  outerHTML: string;
  parent: ParentInfo | null;
  siblings: SiblingInfo[];
}

interface ParentInfo {
  tagName: string;
  id: string;
  classes: string;
  selector: string;
  outerHTML: string;
}

interface SiblingInfo {
  tagName: string;
  classes: string;
  outerHTML: string;
}

interface DesignTokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, string>;
  other: Record<string, string>;
}

interface LayoutContext {
  isFlex: boolean;
  isGrid: boolean;
  isBlock: boolean;
  flexDirection: string;
  gap: number;
  parent: Element;
}

interface SiblingArrangement {
  siblings: Element[];
  rects: DOMRect[];
  isVertical: boolean;
  isHorizontal: boolean;
  count: number;
}

interface ReorderTarget {
  target: Element;
  insertBefore: boolean;
  index: number;
}

interface CanAcceptChildResult {
  valid: boolean;
  reason: string;
}

interface ElementBoundaries {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  maxWidth: number;
  maxHeight: number;
  parent: Element;
}

interface MinimumSize {
  minWidth: number;
  minHeight: number;
}

interface ViewportPosition {
  left: number;
  top: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all elements within specified bounds
 * @param bounds - {left, top, right, bottom}
 * @returns Elements intersecting with bounds
 */
export function getElementsInBounds(bounds: Bounds): Element[] {
  const elements: Element[] = [];
  const allElements = document.querySelectorAll('body *');

  allElements.forEach((el) => {
    // Skip our own UI elements
    if (el.closest(VC_UI_SELECTOR)) {
      return;
    }

    const rect = el.getBoundingClientRect();

    // Check if element intersects with selection
    if (
      rect.left < bounds.right &&
      rect.right > bounds.left &&
      rect.top < bounds.bottom &&
      rect.bottom > bounds.top
    ) {
      elements.push(el);
    }
  });

  return elements;
}

/**
 * Get CSS selector for an element
 * @param element - DOM element
 * @returns CSS selector
 */
export function getSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const path: string[] = [];
  let currentElement: Element | null = element;

  while (
    currentElement &&
    currentElement.nodeType === Node.ELEMENT_NODE
  ) {
    let selector = currentElement.nodeName.toLowerCase();

    if (currentElement.className) {
      // Handle both string className (HTML) and SVGAnimatedString (SVG)
      const classNameStr =
        typeof currentElement.className === 'string'
          ? currentElement.className
          : (currentElement.className as any).baseVal || '';
      const classes = classNameStr
        .trim()
        .split(/\s+/)
        .filter((c: string) => !c.startsWith('vc-'));

      // Use up to 3 classes for better specificity (avoid matching wrong elements)
      if (classes.length > 0) {
        const numClasses = Math.min(3, classes.length);
        selector += '.' + classes.slice(0, numClasses).join('.');
      }
    }

    // If this is the target element (last in path), add nth-child for extra specificity
    if (path.length === 0 && currentElement.parentElement) {
      const siblings = Array.from(currentElement.parentElement.children);
      const index = siblings.indexOf(currentElement);
      if (index >= 0) {
        selector += `:nth-child(${index + 1})`;
      }
    }

    path.unshift(selector);
    if (path.length > SELECTION_CONSTRAINTS.MAX_ELEMENT_DEPTH) break;
    currentElement = currentElement.parentElement;
  }

  return path.join(' > ');
}

/**
 * Get element information object
 * @param element - DOM element
 * @returns Element info
 */
export function getElementInfo(element: Element): ElementInfo {
  // Handle both string className (HTML) and SVGAnimatedString (SVG)
  let classes = '';
  if (element.className) {
    classes =
      typeof element.className === 'string'
        ? element.className
        : (element.className as any).baseVal || '';
  }

  // Get parent context
  let parentInfo: ParentInfo | null = null;
  if (element.parentElement) {
    let parentClasses = '';
    if (element.parentElement.className) {
      parentClasses =
        typeof element.parentElement.className === 'string'
          ? element.parentElement.className
          : (element.parentElement.className as any).baseVal || '';
    }

    // Get truncated parent HTML (first 800 chars to show structure)
    const parentHTML = element.parentElement.outerHTML || '';
    const truncatedParentHTML =
      parentHTML.length > 800
        ? parentHTML.substring(0, 800) + '...'
        : parentHTML;

    parentInfo = {
      tagName: element.parentElement.tagName,
      id: element.parentElement.id || '',
      classes: parentClasses,
      selector: getSelector(element.parentElement),
      outerHTML: truncatedParentHTML,
    };
  }

  // Get sibling elements (up to 3) for pattern matching
  const siblings: SiblingInfo[] = [];
  if (element.parentElement && element.parentElement.children) {
    const siblingElements = Array.from(element.parentElement.children)
      .filter((s) => s !== element && s.nodeType === 1); // Exclude self and non-elements

    // Get up to 3 siblings for pattern analysis
    const siblingsToAnalyze = siblingElements.slice(0, 3);

    for (const sibling of siblingsToAnalyze) {
      let siblingClasses = '';
      if (sibling.className) {
        siblingClasses =
          typeof sibling.className === 'string'
            ? sibling.className
            : (sibling.className as any).baseVal || '';
      }

      // Get truncated sibling HTML (increased to 1200 chars for complex SVGs)
      const siblingHTML = sibling.outerHTML || '';
      const truncatedSiblingHTML =
        siblingHTML.length > 1200
          ? siblingHTML.substring(0, 1200) + '...'
          : siblingHTML;

      siblings.push({
        tagName: sibling.tagName,
        classes: siblingClasses,
        outerHTML: truncatedSiblingHTML,
      });
    }
  }

  return {
    tagName: element.tagName,
    id: element.id || '',
    classes: classes,
    selector: getSelector(element),
    innerText: (element as HTMLElement).innerText || '',
    outerHTML: element.outerHTML || '',
    parent: parentInfo,
    siblings: siblings,
  };
}

/**
 * Extract CSS custom properties (design tokens) from the page
 * @returns Design tokens with colors, spacing, typography
 */
export function extractDesignTokens(): DesignTokens {
  const tokens: DesignTokens = {
    colors: {},
    spacing: {},
    typography: {},
    other: {},
  };

  try {
    // Get computed styles from root element
    const rootStyles = window.getComputedStyle(document.documentElement);

    // Extract all CSS custom properties
    for (let i = 0; i < rootStyles.length; i++) {
      const propName = rootStyles[i];

      // Only process CSS custom properties (start with --)
      if (propName.startsWith('--')) {
        const propValue = rootStyles.getPropertyValue(propName).trim();

        // Skip empty values
        if (!propValue) continue;

        // Categorize by naming convention
        if (
          propName.includes('color') ||
          propName.includes('bg') ||
          propName.includes('background') ||
          (propName.includes('border') && /^#|rgb|hsl/.test(propValue))
        ) {
          tokens.colors[propName] = propValue;
        } else if (
          propName.includes('space') ||
          propName.includes('spacing') ||
          propName.includes('gap') ||
          propName.includes('padding') ||
          propName.includes('margin')
        ) {
          tokens.spacing[propName] = propValue;
        } else if (
          propName.includes('font') ||
          propName.includes('text') ||
          propName.includes('letter') ||
          propName.includes('line')
        ) {
          tokens.typography[propName] = propValue;
        } else {
          tokens.other[propName] = propValue;
        }
      }
    }

    // Also scan stylesheets for CSS variables that might not be on root
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((styleElement) => {
      try {
        const sheet = (styleElement as HTMLStyleElement | HTMLLinkElement).sheet as CSSStyleSheet;
        if (sheet && sheet.cssRules) {
          for (let rule of sheet.cssRules) {
            const styleRule = rule as CSSStyleRule;
            if (styleRule.style) {
              for (let i = 0; i < styleRule.style.length; i++) {
                const propName = styleRule.style[i];
                if (propName.startsWith('--')) {
                  const propValue = styleRule.style
                    .getPropertyValue(propName)
                    .trim();
                  if (propValue) {
                    // Same categorization as above
                    if (
                      propName.includes('color') ||
                      propName.includes('bg') ||
                      propName.includes('background')
                    ) {
                      tokens.colors[propName] = propValue;
                    } else if (
                      propName.includes('space') ||
                      propName.includes('spacing') ||
                      propName.includes('gap')
                    ) {
                      tokens.spacing[propName] = propValue;
                    } else if (
                      propName.includes('font') ||
                      propName.includes('text')
                    ) {
                      tokens.typography[propName] = propValue;
                    } else {
                      tokens.other[propName] = propValue;
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip stylesheets that can't be accessed (CORS)
      }
    });
  } catch (err) {
    console.error('[Layrr] Failed to extract design tokens:', err);
  }

  return tokens;
}

/**
 * Find the best element under cursor for selection
 * @param target - Initial target element
 * @returns Best selectable element
 */
export function findElementUnderCursor(target: Element): Element | null {
  let element: Element | null = target;
  let depth = 0;

  while (element && depth < SELECTION_CONSTRAINTS.MAX_ELEMENT_DEPTH) {
    // Skip if it's a Layrr UI element
    if (element.closest(VC_UI_SELECTOR)) {
      return null;
    }

    // Check if element is valid and visible
    if (
      element.nodeType === Node.ELEMENT_NODE &&
      (element as HTMLElement).offsetParent !== null
    ) {
      const rect = element.getBoundingClientRect();
      if (
        rect.width > SELECTION_CONSTRAINTS.MIN_ELEMENT_SIZE &&
        rect.height > SELECTION_CONSTRAINTS.MIN_ELEMENT_SIZE
      ) {
        return element;
      }
    }

    element = element.parentElement;
    depth++;
  }

  return null;
}

/**
 * Check if element is text-editable
 * @param element - DOM element
 * @returns Whether element can be text-edited
 */
export function isTextEditable(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  if (!element || !htmlElement.innerText) return false;

  const text = htmlElement.innerText.trim();
  if (text.length === 0) return false;

  const tagName = element.tagName.toLowerCase();
  return (
    EDITABLE_TAGS.includes(tagName as any) ||
    element.hasAttribute('contenteditable')
  );
}

/**
 * Capture screenshot of selected area
 * @param bounds - {left, top, width, height}
 * @returns Base64 encoded screenshot
 */
export async function captureAreaScreenshot(bounds: Bounds): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    canvas.width = bounds.width || 0;
    canvas.height = bounds.height || 0;

    // Use html2canvas if available, otherwise use basic approach
    if ((window as any).html2canvas) {
      const fullCanvas = await (window as any).html2canvas(document.body, {
        x: bounds.left + window.scrollX,
        y: bounds.top + window.scrollY,
        width: bounds.width,
        height: bounds.height,
      });
      return fullCanvas.toDataURL('image/png').split(',')[1];
    } else {
      // Fallback: create a placeholder
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, bounds.width || 0, bounds.height || 0);
      ctx.fillStyle = '#666';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Screenshot area', (bounds.width || 0) / 2, (bounds.height || 0) / 2);
      return canvas.toDataURL('image/png').split(',')[1];
    }
  } catch (err) {
    console.error('[Layrr] Screenshot capture failed:', err);
    return '';
  }
}

/**
 * Calculate distance between two points
 * @param p1 - {x, y}
 * @param p2 - {x, y}
 * @returns Distance in pixels
 */
export function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Position element within viewport bounds
 * @param x - Desired x position
 * @param y - Desired y position
 * @param width - Element width
 * @param height - Element height
 * @param padding - Minimum padding from edges
 * @returns {left, top} adjusted position
 */
export function positionInViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number = UI_DIMENSIONS.UI_PADDING
): ViewportPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = x + padding;
  let top = y + padding;

  // Keep within viewport bounds
  if (left + width > viewportWidth - padding) {
    left = x - width - padding;
  }
  if (top + height > viewportHeight - padding) {
    top = y - height - padding;
  }

  // Ensure minimum distance from edges
  left = Math.max(padding, Math.min(left, viewportWidth - width - padding));
  top = Math.max(padding, Math.min(top, viewportHeight - height - padding));

  return { left, top };
}

/**
 * Get WebSocket URL for given path
 * @param path - WebSocket path
 * @returns Full WebSocket URL
 */
export function getWebSocketURL(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${path}`;
}

/**
 * Format area size for display
 * @param width - Width in pixels
 * @param height - Height in pixels
 * @returns Formatted size string
 */
export function formatAreaSize(width: number, height: number): string {
  return `${Math.round(width)}×${Math.round(height)}px`;
}

/**
 * Get element label for tooltip display
 * @param element - DOM element
 * @returns Element label
 */
export function getElementLabel(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = Array.from(element.classList)
    .filter((c) => !c.startsWith('vc-'))
    .slice(0, 2)
    .join('.');
  const classStr = classes ? `.${classes}` : '';

  return `${tagName}${id}${classStr}`;
}

/**
 * Calculate bounds from two points
 * @param start - {x, y}
 * @param end - {x, y}
 * @returns {left, top, right, bottom, width, height}
 */
export function calculateBounds(start: Point, end: Point): Bounds {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/**
 * Detect layout context of parent container
 * @param element - DOM element
 * @returns Layout information
 */
export function detectLayoutContext(
  element: Element
): LayoutContext | null {
  if (!element || !element.parentElement) return null;

  const parent = element.parentElement;
  const computedStyle = window.getComputedStyle(parent);

  return {
    isFlex: computedStyle.display.includes('flex'),
    isGrid: computedStyle.display === 'grid',
    isBlock: computedStyle.display === 'block',
    flexDirection: computedStyle.flexDirection || 'row',
    gap: parseFloat(computedStyle.gap) || 0,
    parent: parent,
  };
}

/**
 * Get sibling arrangement and detect if vertical or horizontal
 * @param element - DOM element
 * @returns Arrangement information
 */
export function getSiblingArrangement(
  element: Element
): SiblingArrangement | null {
  if (!element || !element.parentElement) return null;

  const parent = element.parentElement;
  const siblings = Array.from(parent.children).filter((child) => {
    // Filter out VC UI elements
    return (
      !child.closest(VC_UI_SELECTOR) &&
      child.nodeType === Node.ELEMENT_NODE &&
      window.getComputedStyle(child).display !== 'none'
    );
  });

  if (siblings.length < 2) return null;

  const rects = siblings.map((s) => s.getBoundingClientRect());
  const tolerance = 10; // 10px tolerance for alignment

  // Check if arranged vertically (stacked)
  let isVertical = true;
  for (let i = 1; i < rects.length; i++) {
    const prev = rects[i - 1];
    const curr = rects[i];
    // Current element should start below or at the bottom of previous
    if (curr.top < prev.bottom - tolerance) {
      isVertical = false;
      break;
    }
  }

  // Check if arranged horizontally (side by side)
  let isHorizontal = true;
  for (let i = 1; i < rects.length; i++) {
    const prev = rects[i - 1];
    const curr = rects[i];
    // Current element should start to the right of previous
    if (curr.left < prev.right - tolerance) {
      isHorizontal = false;
      break;
    }
  }

  return {
    siblings: siblings,
    rects: rects,
    isVertical: isVertical,
    isHorizontal: isHorizontal,
    count: siblings.length,
  };
}

/**
 * Determine if drag should trigger reorder based on context and movement
 * @param element - Element being dragged
 * @param deltaX - Horizontal drag distance
 * @param deltaY - Vertical drag distance
 * @param layoutContext - Layout context from detectLayoutContext
 * @param siblingArrangement - Sibling arrangement from getSiblingArrangement
 * @param shiftKeyHeld - Whether Shift key is held (overrides to free-drag)
 * @returns Whether to trigger reorder
 */
export function shouldTriggerReorder(
  _element: Element,
  deltaX: number,
  deltaY: number,
  layoutContext: LayoutContext | null,
  siblingArrangement: SiblingArrangement | null,
  shiftKeyHeld: boolean = false
): boolean {
  if (!layoutContext || !siblingArrangement) return false;
  if (siblingArrangement.count < 2) return false;

  // If Shift is held, disable reorder mode (allow free-drag)
  if (shiftKeyHeld) return false;

  // SMART DEFAULT: When siblings exist, prefer reorder mode
  // Just need minimal movement to distinguish from click
  const threshold = 10;

  // For flex column or vertical arrangement
  if (
    (layoutContext.isFlex && layoutContext.flexDirection === 'column') ||
    (siblingArrangement.isVertical && !siblingArrangement.isHorizontal)
  ) {
    return Math.abs(deltaY) > threshold;
  }

  // For flex row or horizontal arrangement
  if (
    (layoutContext.isFlex && layoutContext.flexDirection === 'row') ||
    (siblingArrangement.isHorizontal && !siblingArrangement.isVertical)
  ) {
    return Math.abs(deltaX) > threshold;
  }

  // For grid or block flow (typically vertical)
  if (layoutContext.isGrid || layoutContext.isBlock) {
    if (siblingArrangement.isVertical) {
      return Math.abs(deltaY) > threshold;
    }
  }

  return false;
}

/**
 * Find which sibling element is being hovered over during drag
 * @param draggingElement - Element being dragged
 * @param deltaX - Horizontal drag offset
 * @param deltaY - Vertical drag offset
 * @param siblings - Array of sibling elements
 * @returns {target: Element, insertBefore: boolean} or null
 */
export function getReorderTarget(
  draggingElement: Element,
  deltaX: number,
  deltaY: number,
  siblings: Element[]
): ReorderTarget | null {
  if (!siblings || siblings.length === 0) return null;

  const dragRect = draggingElement.getBoundingClientRect();
  const dragCenter: Point = {
    x: dragRect.left + dragRect.width / 2 + deltaX,
    y: dragRect.top + dragRect.height / 2 + deltaY,
  };

  // Find which sibling's bounding box contains the drag center
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === draggingElement) continue;

    const rect = sibling.getBoundingClientRect();
    const siblingCenter: Point = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    // Check if drag center is within sibling bounds
    if (
      dragCenter.x >= rect.left &&
      dragCenter.x <= rect.right &&
      dragCenter.y >= rect.top &&
      dragCenter.y <= rect.bottom
    ) {
      // Determine if we should insert before or after
      const insertBefore =
        dragCenter.y < siblingCenter.y ||
        (Math.abs(dragCenter.y - siblingCenter.y) < 5 &&
          dragCenter.x < siblingCenter.x);

      return {
        target: sibling,
        insertBefore: insertBefore,
        index: i,
      };
    }
  }

  return null;
}

/**
 * HTML semantics rules: parent-child compatibility matrix
 */
const HTML_RULES: Record<string, { validParents: string[] }> = {
  LI: { validParents: ['UL', 'OL', 'MENU'] },
  TR: { validParents: ['TABLE', 'THEAD', 'TBODY', 'TFOOT'] },
  TD: { validParents: ['TR'] },
  TH: { validParents: ['TR'] },
  THEAD: { validParents: ['TABLE'] },
  TBODY: { validParents: ['TABLE'] },
  TFOOT: { validParents: ['TABLE'] },
  CAPTION: { validParents: ['TABLE'] },
  COLGROUP: { validParents: ['TABLE'] },
  COL: { validParents: ['COLGROUP'] },
  OPTION: { validParents: ['SELECT', 'OPTGROUP', 'DATALIST'] },
  OPTGROUP: { validParents: ['SELECT'] },
  LEGEND: { validParents: ['FIELDSET'] },
  FIGCAPTION: { validParents: ['FIGURE'] },
  DT: { validParents: ['DL'] },
  DD: { validParents: ['DL'] },
  SOURCE: { validParents: ['AUDIO', 'VIDEO', 'PICTURE'] },
  TRACK: { validParents: ['AUDIO', 'VIDEO'] },
  SUMMARY: { validParents: ['DETAILS'] },
};

/**
 * Check if a parent element can accept a child element
 * @param parentElement - Potential parent
 * @param childElement - Element to be moved
 * @returns {valid: boolean, reason: string}
 */
export function canAcceptChild(
  parentElement: Element,
  childElement: Element
): CanAcceptChildResult {
  if (!parentElement || !childElement) {
    return { valid: false, reason: 'Missing parent or child element' };
  }

  const childTag = childElement.tagName;
  const parentTag = parentElement.tagName;

  // Check HTML semantics rules
  if (HTML_RULES[childTag]) {
    const validParents = HTML_RULES[childTag].validParents;
    if (!validParents.includes(parentTag)) {
      return {
        valid: false,
        reason: `${childTag} can only be placed in ${validParents.join(', ')}`,
      };
    }
  }

  // Check display type compatibility
  const parentStyle = window.getComputedStyle(parentElement);
  const childStyle = window.getComputedStyle(childElement);

  // Block elements cannot go inside inline elements
  if (
    parentStyle.display === 'inline' &&
    (childStyle.display === 'block' ||
      childStyle.display === 'flex' ||
      childStyle.display === 'grid')
  ) {
    return {
      valid: false,
      reason: 'Block-level elements cannot be placed inside inline elements',
    };
  }

  // Check if parent is a replaced element (cannot have children)
  const replacedElements = [
    'IMG',
    'INPUT',
    'BR',
    'HR',
    'EMBED',
    'OBJECT',
    'VIDEO',
    'AUDIO',
    'CANVAS',
    'IFRAME',
  ];
  if (replacedElements.includes(parentTag)) {
    return {
      valid: false,
      reason: `${parentTag} elements cannot contain other elements`,
    };
  }

  return { valid: true, reason: '' };
}

/**
 * Get element boundaries (min/max coordinates within parent)
 * @param element - DOM element
 * @returns Boundary information
 */
export function getElementBoundaries(
  element: Element
): ElementBoundaries | null {
  if (!element || !element.parentElement) {
    return null;
  }

  const parent = element.parentElement;
  const parentRect = parent.getBoundingClientRect();
  const parentStyle = window.getComputedStyle(parent);

  // Calculate available space (minus padding)
  const paddingLeft = parseFloat(parentStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(parentStyle.paddingRight) || 0;
  const paddingTop = parseFloat(parentStyle.paddingTop) || 0;
  const paddingBottom = parseFloat(parentStyle.paddingBottom) || 0;

  return {
    minX: parentRect.left + paddingLeft + window.scrollX,
    minY: parentRect.top + paddingTop + window.scrollY,
    maxX: parentRect.right - paddingRight + window.scrollX,
    maxY: parentRect.bottom - paddingBottom + window.scrollY,
    maxWidth: parentRect.width - paddingLeft - paddingRight,
    maxHeight: parentRect.height - paddingTop - paddingBottom,
    parent: parent,
  };
}

/**
 * Get minimum size for an element based on its content
 * @param element - DOM element
 * @returns {minWidth, minHeight}
 */
export function getMinimumSize(element: Element): MinimumSize {
  if (!element) {
    return { minWidth: 50, minHeight: 50 };
  }

  const hasText =
    (element as HTMLElement).innerText && (element as HTMLElement).innerText.trim().length > 0;
  const hasImage =
    element.tagName === 'IMG' || element.querySelector('img') !== null;

  if (hasImage) {
    // Minimum 100x100 for images
    return { minWidth: 100, minHeight: 100 };
  } else if (hasText) {
    // Calculate text minimum (1 line height + padding)
    const style = window.getComputedStyle(element);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    return {
      minWidth: 100,
      minHeight: lineHeight + paddingTop + paddingBottom + 10,
    };
  }

  return { minWidth: 50, minHeight: 50 };
}
