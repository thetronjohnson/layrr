import { animate, stagger } from 'motion';

// ---- Spring presets ----
const spring = { type: 'spring' as const, bounce: 0.12, duration: 0.5 };
const springSnappy = { type: 'spring' as const, bounce: 0.08, duration: 0.35 };
const springGentle = { type: 'spring' as const, bounce: 0.15, duration: 0.55 };

// ---- Active bar animation tracking ----
let activeBarAnim: ReturnType<typeof animate> | null = null;

function cancelBarAnim(bar: HTMLElement) {
  if (activeBarAnim) {
    activeBarAnim.cancel();
    activeBarAnim = null;
  }
  // Force clear any residual inline styles from motion
  bar.style.width = '';
  bar.style.borderRadius = '';
}

// ---- Bar expand / collapse ----
export function barExpand(bar: HTMLElement, panel: HTMLElement) {
  cancelBarAnim(bar);

  const pos = { left: bar.style.left, top: bar.style.top, right: bar.style.right, bottom: bar.style.bottom };
  const collapsedRect = bar.getBoundingClientRect();

  bar.classList.add('expanded');
  panel.classList.add('open');
  const expandedRect = bar.getBoundingClientRect();

  activeBarAnim = animate(bar, {
    width: [`${collapsedRect.width}px`, `${expandedRect.width}px`],
    borderRadius: ['50px', '14px'],
  }, springGentle);

  activeBarAnim.then(() => {
    activeBarAnim = null;
    bar.style.width = '';
    bar.style.borderRadius = '';
    if (pos.left && pos.top) {
      bar.style.right = 'auto'; bar.style.bottom = 'auto';
      bar.style.left = pos.left; bar.style.top = pos.top;
    }
  });

  // Content fades in slightly delayed
  animate(panel, {
    opacity: [0, 1],
    y: [10, 0],
  }, { ...spring, delay: 0.1 });
}

export function barCollapse(bar: HTMLElement, panel: HTMLElement): Promise<void> {
  cancelBarAnim(bar);

  const expandedRect = bar.getBoundingClientRect();

  return animate(panel, {
    opacity: [1, 0],
    y: [0, 6],
  }, { duration: 0.15 }).then(() => {
    panel.classList.remove('open');
    panel.style.cssText = '';
    bar.classList.remove('expanded');

    const collapsedRect = bar.getBoundingClientRect();
    const pos = { left: bar.style.left, top: bar.style.top, right: bar.style.right, bottom: bar.style.bottom };

    activeBarAnim = animate(bar, {
      width: [`${expandedRect.width}px`, `${collapsedRect.width}px`],
      borderRadius: ['14px', '50px'],
    }, springSnappy);

    return activeBarAnim.then(() => {
      activeBarAnim = null;
      bar.style.cssText = '';
      if (pos.left && pos.top) {
        bar.style.right = 'auto'; bar.style.bottom = 'auto';
        bar.style.left = pos.left; bar.style.top = pos.top;
      }
    }) as unknown as Promise<void>;
  });
}

// ---- Bar entrance ----
export function barIn(el: HTMLElement) {
  return animate(el, { opacity: [0, 1], y: [20, 0], scale: [0.92, 1] }, springGentle);
}

// ---- Panel content swap (when switching between edit ↔ history) ----
export function contentSwap(bar: HTMLElement, outEl: HTMLElement, inEl: HTMLElement) {
  cancelBarAnim(bar);
  outEl.classList.remove('open');
  outEl.style.cssText = '';
  inEl.classList.add('open');
  return animate(inEl, { opacity: [0, 1], y: [6, 0] }, { ...springSnappy, delay: 0.05 });
}

// ---- Toast enter / exit ----
export function toastIn(el: HTMLElement) {
  return animate(el, { opacity: [0, 1], x: [40, 0], scale: [0.95, 1] }, springSnappy);
}

export function toastOut(el: HTMLElement) {
  return animate(el, { opacity: [1, 0], x: [0, 30], scale: [1, 0.95] }, { duration: 0.25 });
}

// ---- Dim overlay fade ----
export function dimIn(el: HTMLElement) {
  return animate(el, { opacity: [0, 1] }, { duration: 0.35 });
}

export function dimOut(el: HTMLElement) {
  return animate(el, { opacity: [1, 0] }, { duration: 0.25 });
}

// ---- Staggered list items ----
export function listIn(selector: string, parent: HTMLElement) {
  const items = parent.querySelectorAll(selector);
  if (items.length === 0) return;
  return animate(
    items as NodeListOf<HTMLElement>,
    { opacity: [0, 1], y: [8, 0] },
    { delay: stagger(0.04), ...springSnappy }
  );
}

// ---- Confirm overlay ----
export function confirmIn(el: HTMLElement) {
  return animate(el, { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.2 });
}

export function confirmOut(el: HTMLElement) {
  return animate(el, { opacity: [1, 0], scale: [1, 0.97] }, { duration: 0.15 });
}
