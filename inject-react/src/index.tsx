import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';

/**
 * Layrr React Entry Point
 *
 * This file initializes the React app within a Shadow DOM for style isolation.
 * The Shadow DOM ensures that:
 * 1. Host application styles don't affect Layrr UI
 * 2. Layrr styles don't leak into host application
 * 3. We can use Tailwind and custom CSS without conflicts
 */

console.log('[Layrr] Initializing React visual editor...');

/**
 * Initialize the Layrr visual editor
 */
function initializeLayrr() {
  // Check if already initialized
  if (document.getElementById('layrr-root')) {
    console.warn('[Layrr] Already initialized, skipping...');
    return;
  }

  // Create container for Shadow DOM
  const container = document.createElement('div');
  container.id = 'layrr-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999997;
  `;

  // Attach Shadow DOM
  const shadowRoot = container.attachShadow({ mode: 'open' });

  // Create root element inside Shadow DOM
  const root = document.createElement('div');
  root.id = 'layrr-root';
  root.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999997;
  `;

  // Allow pointer events for interactive elements
  root.addEventListener('mousedown', (e) => {
    // Enable pointer events for our UI elements
    const target = e.target as HTMLElement;
    if (target.closest('[data-layrr-interactive]')) {
      root.style.pointerEvents = 'auto';
    }
  });

  root.addEventListener('mouseup', () => {
    // Reset pointer events after interaction
    setTimeout(() => {
      root.style.pointerEvents = 'none';
    }, 0);
  });

  shadowRoot.appendChild(root);

  // Inject styles into Shadow DOM
  const styleElement = document.createElement('style');

  // We'll inject compiled CSS here
  // For now, we add basic resets and allow Tailwind to be processed
  styleElement.textContent = `
    /* Shadow DOM Style Reset */
    * {
      box-sizing: border-box;
    }

    /* Ensure our elements can receive pointer events */
    [data-layrr-interactive] {
      pointer-events: auto !important;
    }

    /* Z-index hierarchy */
    .vc-overlay { z-index: 999998; }
    .vc-modal { z-index: 999999; }
    .vc-panel { z-index: 1000000; }
    .vc-toolbar { z-index: 1000001; }
  `;

  shadowRoot.appendChild(styleElement);

  // Append to body
  document.body.appendChild(container);

  // Initialize React
  const reactRoot = createRoot(root);
  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  console.log('[Layrr] React visual editor initialized ✓');

  // Store reference for potential cleanup
  (window as any).__LAYRR_ROOT__ = reactRoot;
  (window as any).__LAYRR_SHADOW__ = shadowRoot;

  // Expose API for external control (optional)
  (window as any).Layrr = {
    version: '1.0.0',
    destroy: () => {
      reactRoot.unmount();
      container.remove();
      console.log('[Layrr] React visual editor destroyed');
    },
    reload: () => {
      reactRoot.unmount();
      reactRoot.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
      console.log('[Layrr] React visual editor reloaded');
    },
  };
}

/**
 * Initialize when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLayrr);
} else {
  // DOM already loaded
  initializeLayrr();
}

/**
 * Handle hot module replacement in development
 */
if ((import.meta as any).hot) {
  (import.meta as any).hot.accept('./App', () => {
    console.log('[Layrr] Hot reloading...');
    const reactRoot = (window as any).__LAYRR_ROOT__;
    if (reactRoot) {
      reactRoot.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    }
  });
}

export default initializeLayrr;
