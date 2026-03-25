import { animate, stagger } from 'motion';

// ---- Spring presets ----
const spring = { type: 'spring' as const, bounce: 0.12, duration: 0.5 };
const springSnappy = { type: 'spring' as const, bounce: 0.08, duration: 0.35 };
const springGentle = { type: 'spring' as const, bounce: 0.1, duration: 0.5 };
const springSmooth = { type: 'spring' as const, stiffness: 300, damping: 30 };

// ---- Active bar animation tracking ----
let activeBarAnim: ReturnType<typeof animate> | null = null;
let activeContentAnim: ReturnType<typeof animate> | null = null;

function cancelBarAnim(bar: HTMLElement) {
  if (activeBarAnim) {
    // Complete the animation instantly instead of cancelling to initial state
    activeBarAnim.finish();
    activeBarAnim = null;
  }
  if (activeContentAnim) {
    activeContentAnim.finish();
    activeContentAnim = null;
  }
  bar.style.width = '';
  bar.style.height = '';
  bar.style.borderRadius = '';
}

// ---- Bar expand ----
export function barExpand(bar: HTMLElement, panel: HTMLElement) {
  cancelBarAnim(bar);

  const pos = { left: bar.style.left, top: bar.style.top, right: bar.style.right, bottom: bar.style.bottom };

  // Measure collapsed
  const collapsedRect = bar.getBoundingClientRect();

  // Show panel to measure expanded
  bar.classList.add('expanded');
  panel.classList.add('open');
  const expandedRect = bar.getBoundingClientRect();

  // Hide content initially — will fade in during expansion
  panel.style.opacity = '0';

  // Animate bar: width + height + border-radius together
  activeBarAnim = animate(bar, {
    width: [`${collapsedRect.width}px`, `${expandedRect.width}px`],
    height: [`${collapsedRect.height}px`, `${expandedRect.height}px`],
    borderRadius: ['50px', '14px'],
  }, springSmooth);

  activeBarAnim.then(() => {
    activeBarAnim = null;
    bar.style.width = '';
    bar.style.height = '';
    bar.style.borderRadius = '';
    if (pos.left && pos.top) {
      bar.style.right = 'auto'; bar.style.bottom = 'auto';
      bar.style.left = pos.left; bar.style.top = pos.top;
    }
  });

  // Content fades in once bar is ~40% expanded
  activeContentAnim = animate(panel, {
    opacity: [0, 1],
    y: [6, 0],
  }, { duration: 0.3, delay: 0.12 });

  activeContentAnim.then(() => {
    activeContentAnim = null;
    panel.style.opacity = '';
    panel.style.transform = '';
  });
}

// ---- Bar collapse ----
export function barCollapse(bar: HTMLElement, panel: HTMLElement): Promise<void> {
  cancelBarAnim(bar);

  const expandedRect = bar.getBoundingClientRect();
  const pos = { left: bar.style.left, top: bar.style.top, right: bar.style.right, bottom: bar.style.bottom };

  // Phase 1: Fade content out quickly
  return animate(panel, {
    opacity: [1, 0],
  }, { duration: 0.12 }).then(() => {
    panel.classList.remove('open');
    panel.style.cssText = '';
    bar.classList.remove('expanded');

    const collapsedRect = bar.getBoundingClientRect();

    // Phase 2: Shrink bar back to pill
    activeBarAnim = animate(bar, {
      width: [`${expandedRect.width}px`, `${collapsedRect.width}px`],
      height: [`${expandedRect.height}px`, `${collapsedRect.height}px`],
      borderRadius: ['14px', '50px'],
    }, springSmooth);

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

// ---- Panel content swap (bar stays expanded, animate height + crossfade) ----
export function contentSwap(bar: HTMLElement, outEl: HTMLElement, inEl: HTMLElement) {
  cancelBarAnim(bar);

  // Measure current bar height (with old panel)
  const startHeight = bar.getBoundingClientRect().height;

  // Show incoming panel (hidden) to measure target height
  inEl.classList.add('open');
  inEl.style.opacity = '0';
  outEl.style.display = 'none'; // temporarily hide old panel for measurement
  const endHeight = bar.getBoundingClientRect().height;
  outEl.style.display = ''; // restore

  // Animate bar height between panel sizes
  if (Math.abs(startHeight - endHeight) > 2) {
    activeBarAnim = animate(bar, {
      height: [`${startHeight}px`, `${endHeight}px`],
    }, springSmooth);
    activeBarAnim.then(() => {
      activeBarAnim = null;
      bar.style.height = '';
    });
  }

  // Crossfade: old out, new in simultaneously
  animate(outEl, { opacity: [1, 0] }, { duration: 0.15 }).then(() => {
    outEl.classList.remove('open');
    outEl.style.cssText = '';
  });

  return animate(inEl, { opacity: [0, 1], y: [3, 0] }, { duration: 0.25, delay: 0.06 }).then(() => {
    inEl.style.opacity = '';
    inEl.style.transform = '';
  });
}

// ---- Inner content transition (within a panel) ----
export function contentFadeIn(el: HTMLElement) {
  return animate(el, { opacity: [0, 1], y: [4, 0] }, { duration: 0.2 });
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
