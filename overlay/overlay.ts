(async function () {
  if ((window as any).__LAYRR_LOADED__) return;
  (window as any).__LAYRR_LOADED__ = true;

  const WS_PORT = (window as any).__LAYRR_WS_PORT__ || 4567;

  // ---- Imports ----
  const { L } = await import('./constants');
  const { ensureStyles } = await import('./styles');
  const { createElements, isOwn, toast } = await import('./elements');
  const { app, loadState, initState, save } = await import('./state');
  const { initSourceMapping, extractSourceInfo, getTag, getBreadcrumb, getSelector, posHL, posLabel } = await import('./source');
  const { fetchAndRenderHistory, closeHistory } = await import('./history');

  await initSourceMapping();

  const saved = loadState();
  initState(saved);

  // ---- Panel helpers ----
  function showPanel(panel: HTMLElement) {
    const bar = document.getElementById(`${L}-bar`);
    const hp = document.getElementById(`${L}-history`);
    if (hp) { hp.classList.remove('open'); }
    bar?.querySelector(`.${L}-bhi`)?.classList.remove('open');
    panel.classList.add('open');
    if (bar) bar.classList.add('expanded');
  }

  function hidePanel(panel: HTMLElement) {
    const bar = document.getElementById(`${L}-bar`);
    panel.classList.remove('open');
    const histOpen = document.getElementById(`${L}-history`)?.classList.contains('open');
    if (bar && !histOpen) bar.classList.remove('expanded');
  }

  // ---- Multi-select helpers ----
  function clearMultiHighlights() {
    app.multiHighlights.forEach(h => h.remove());
    app.multiHighlights = [];
  }

  function updateMultiHighlights() {
    clearMultiHighlights();
    const root = document.querySelector(`.${L}-root`);
    if (!root) return;
    for (const el of app.selectedEls) {
      const mhl = document.createElement('div');
      mhl.className = `${L}-mhl`;
      const r = el.getBoundingClientRect();
      mhl.style.borderRadius = getComputedStyle(el).borderRadius || '2px';
      Object.assign(mhl.style, { left: `${r.left - 1}px`, top: `${r.top - 1}px`, width: `${r.width + 2}px`, height: `${r.height + 2}px` });
      root.appendChild(mhl);
      app.multiHighlights.push(mhl);
    }
  }

  function clearSelection(hl: HTMLElement, label: HTMLElement, panel: HTMLElement) {
    app.selectedEl = null;
    app.selectedEls = [];
    clearMultiHighlights();
    hl.style.display = 'none'; hl.classList.remove('selected');
    label.style.display = 'none';
    if (app.mode === 'edit') {
      updatePanelForSelection(panel);
    } else {
      hidePanel(panel);
    }
  }

  function updatePanelForSelection(panel: HTMLElement) {
    const ia = panel.querySelector(`.${L}-ia`) as HTMLElement;
    const hn = panel.querySelector(`.${L}-hn`) as HTMLElement;
    const elInfo = panel.querySelector(`.${L}-ei`) as HTMLElement;

    if (!app.selectedEl && app.selectedEls.length === 0) {
      elInfo.innerHTML = `<div class="${L}-eh">Click to select an element or <kbd>Shift+click</kbd> to select multiple</div>`;
      if (ia) ia.style.display = 'none';
      if (hn) hn.style.display = 'none';
      return;
    }

    if (ia) ia.style.display = '';
    if (hn) hn.style.display = '';

    if (app.selectedEls.length <= 1) {
      const el = app.selectedEls[0] || app.selectedEl;
      if (!el) return;
      elInfo.innerHTML = `
        <div class="${L}-et">${getTag(el)}</div>
        <div class="${L}-ex">${el.textContent?.trim().slice(0, 50) || '(empty)'}</div>
        <div class="${L}-ep">${getBreadcrumb(el)}</div>
      `;
    } else {
      let html = `<div class="${L}-et">Selected<span class="${L}-sel-count">${app.selectedEls.length}</span></div>`;
      html += `<div class="${L}-ei-multi">`;
      app.selectedEls.forEach((el, i) => {
        const tag = getTag(el).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `<div class="${L}-ei-item"><button class="${L}-ei-rm" data-idx="${i}"><i class="icon-x"></i></button><span>${tag}</span></div>`;
      });
      html += `</div>`;
      elInfo.innerHTML = html;
      elInfo.querySelectorAll(`.${L}-ei-rm`).forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt((btn as HTMLElement).dataset.idx || '0');
          app.selectedEls.splice(idx, 1);
          if (app.selectedEls.length === 0) {
            clearSelection(document.getElementById(`${L}-hl`)!, document.getElementById(`${L}-label`)!, panel);
          } else {
            app.selectedEl = app.selectedEls[app.selectedEls.length - 1];
            updateMultiHighlights();
            updatePanelForSelection(panel);
          }
        });
      });
    }
  }

  // ---- Polling ----
  function stopPolling() {
    if (app.pollTimer) { clearInterval(app.pollTimer); app.pollTimer = null; }
    if (app.spinnerTimeout) { clearTimeout(app.spinnerTimeout); app.spinnerTimeout = null; }
  }

  function startPolling() {
    stopPolling();
    app.pollTimer = setInterval(async () => {
      try {
        const resp = await fetch('/__layrr__/edit-status');
        const data = await resp.json();
        if (data.success !== null && data.timestamp > app.lastEditTimestamp) {
          app.lastEditTimestamp = data.timestamp;
          stopPolling();
          onEditResult(data);
        }
      } catch {}
    }, 2000);
    app.spinnerTimeout = setTimeout(() => {
      stopPolling();
      if (app.activeSendBtn) {
        app.activeSendBtn.disabled = false;
        app.activeSendBtn.classList.remove('loading');
        app.activeSendBtn = null;
      }
      toast('Edit timed out — no response received', 'error');
    }, 60000);
  }

  function onEditResult(msg: any) {
    stopPolling();
    if (app.activeSendBtn) {
      app.activeSendBtn.disabled = false;
      app.activeSendBtn.classList.remove('loading');
      app.activeSendBtn = null;
    }
    if (msg.success) {
      app.editCount++;
      app.lastEdit = null;
      app.selectedEl = null;
      app.selectedEls = [];
      clearMultiHighlights();
      app.hoveredEl = null;
      if (app.hlEl) { app.hlEl.style.display = 'none'; app.hlEl.classList.remove('selected'); }
      if (app.labelEl) { app.labelEl.style.display = 'none'; }
      if (app.panelEl) { hidePanel(app.panelEl); }
      save();
      toast('Done!', 'success');
      setTimeout(() => location.reload(), 2500);
    } else {
      toast(msg.message || 'Edit failed', 'error');
    }
  }

  // ---- WebSocket ----
  function connectWs(bar: HTMLElement) {
    app.ws = new WebSocket(`ws://${location.hostname}:${WS_PORT}/__layrr__/ws`);
    app.ws.onopen = () => { app.connected = true; app.ws!.send(JSON.stringify({ type: 'overlay-ready' })); };
    app.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'edit-result') onEditResult(msg);
        else if (msg.type === 'version-preview-result') {
          if (msg.success) {
            app.previewingHash = msg.hash;
            sessionStorage.setItem('__layrr_preview', msg.hash);
            toast(`Previewing: ${msg.message || msg.hash.slice(0, 7)}`, 'info');
            fetchAndRenderHistory();
            save();
            setTimeout(() => location.reload(), 1000);
          } else { toast('Preview failed', 'error'); }
        }
        else if (msg.type === 'version-restore-result') {
          if (msg.success) {
            app.previewingHash = null;
            sessionStorage.removeItem('__layrr_preview');
            toast('Back to latest', 'success');
            fetchAndRenderHistory();
            save();
            setTimeout(() => location.reload(), 1000);
          } else { toast('Restore failed', 'error'); }
        }
        else if (msg.type === 'version-revert-result') {
          if (msg.success) {
            app.previewingHash = null;
            sessionStorage.removeItem('__layrr_preview');
            toast('Permanently reverted', 'success');
            fetchAndRenderHistory();
            save();
            setTimeout(() => location.reload(), 1000);
          } else { toast('Revert failed', 'error'); }
        }
      } catch {}
    };
    app.ws.onclose = () => { app.connected = false; setTimeout(() => connectWs(bar), 2000); };
  }

  // ---- Mode ----
  function setMode(m: 'browse' | 'edit', hl: HTMLElement, label: HTMLElement, panel: HTMLElement, bar: HTMLElement, dim: HTMLElement, silent = false) {
    if (m === 'edit' && app.previewingHash) {
      toast('Go back to latest to make edits', 'info');
      return;
    }
    app.mode = m;
    const br = bar.querySelector(`.${L}-bbr`) as HTMLElement;
    const ed = bar.querySelector(`.${L}-bbe`) as HTMLElement;
    if (m === 'browse') {
      br.classList.add('active'); ed.classList.remove('active');
      document.body.style.cursor = ''; dim.classList.remove('active');
      app.selectedEl = null; app.selectedEls = []; app.hoveredEl = null;
      clearMultiHighlights();
      hl.style.display = 'none'; hl.classList.remove('selected');
      label.style.display = 'none'; hidePanel(panel);
    } else {
      br.classList.remove('active'); ed.classList.add('active');
      document.body.style.cursor = 'crosshair'; dim.classList.add('active');
      app.selectedEl = null; app.selectedEls = []; app.hoveredEl = null;
      clearMultiHighlights();
      hl.style.display = 'none'; hl.classList.remove('selected');
      label.style.display = 'none';
      updatePanelForSelection(panel);
      showPanel(panel);
    }
    const hp = document.getElementById(`${L}-history`);
    if (hp) { hp.classList.remove('open'); }
    bar.querySelector(`.${L}-bhi`)?.classList.remove('open');
    if (!panel.classList.contains('open')) bar.classList.remove('expanded');
    save();
  }

  // ---- Init ----
  function init() {
    ensureStyles();
    const { dim, hl, label, panel, bar } = createElements();
    app.hlEl = hl; app.labelEl = label; app.panelEl = panel;
    connectWs(bar);

    // Check for missed edit results
    fetch('/__layrr__/edit-status').then(r => r.json()).then(data => {
      if (data.success !== null && data.timestamp > app.lastEditTimestamp) {
        app.lastEditTimestamp = data.timestamp;
        onEditResult(data);
      }
    }).catch(() => {});

    const input = panel.querySelector(`.${L}-in`) as HTMLTextAreaElement;
    const sendBtn = panel.querySelector(`.${L}-sb`) as HTMLButtonElement;
    const closeBtn = panel.querySelector(`.${L}-px`) as HTMLButtonElement;
    const browseBtn = bar.querySelector(`.${L}-bbr`) as HTMLElement;
    const editBtn = bar.querySelector(`.${L}-bbe`) as HTMLElement;
    const histBtn = bar.querySelector(`.${L}-bhi`) as HTMLElement;
    const histPanel = document.getElementById(`${L}-history`) as HTMLElement;
    const barDrag = bar.querySelector(`.${L}-bd`) as HTMLElement;

    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 72) + 'px'; });
    browseBtn.addEventListener('click', () => setMode('browse', hl, label, panel, bar, dim));
    editBtn.addEventListener('click', () => setMode('edit', hl, label, panel, bar, dim));

    // History toggle
    histBtn.addEventListener('click', () => {
      if (panel.classList.contains('open')) {
        app.selectedEl = null; app.selectedEls = []; clearMultiHighlights();
        hl.style.display = 'none'; hl.classList.remove('selected');
        label.style.display = 'none'; hidePanel(panel);
        app.hoveredEl = null;
      }
      const isOpen = histPanel.classList.toggle('open');
      histBtn.classList.toggle('open', isOpen);
      bar.classList.toggle('expanded', isOpen);
      if (isOpen) {
        fetchAndRenderHistory();
        browseBtn.classList.remove('active');
        editBtn.classList.remove('active');
        document.body.style.cursor = ''; dim.classList.remove('active');
        app.mode = 'browse';
      } else {
        browseBtn.classList.add('active');
      }
    });

    // Restore saved state
    fetchAndRenderHistory();
    if (saved.barPos) {
      bar.style.right = 'auto'; bar.style.bottom = 'auto';
      bar.style.left = saved.barPos.left; bar.style.top = saved.barPos.top;
    }
    if (app.mode === 'edit') {
      setMode('edit', hl, label, panel, bar, dim, true);
    }
    if (saved.historyOpen) {
      histPanel.classList.add('open');
      histBtn.classList.add('open');
      bar.classList.add('expanded');
      fetchAndRenderHistory();
    }

    // Drag
    let barDragging = false, barOff = { x: 0, y: 0 };
    barDrag.addEventListener('mousedown', (e: MouseEvent) => {
      barDragging = true; bar.classList.add('dragging');
      const r = bar.getBoundingClientRect();
      bar.style.right = 'auto'; bar.style.bottom = 'auto';
      bar.style.left = `${r.left}px`; bar.style.top = `${r.top}px`;
      barOff = { x: e.clientX - r.left, y: e.clientY - r.top }; e.preventDefault();
    });
    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (barDragging) { bar.style.left = `${Math.max(4, Math.min(window.innerWidth - bar.offsetWidth - 4, e.clientX - barOff.x))}px`; bar.style.top = `${Math.max(4, Math.min(window.innerHeight - bar.offsetHeight - 4, e.clientY - barOff.y))}px`; }
      if (app.mode !== 'edit' || barDragging) return;
      if (app.selectedEl && !e.shiftKey) return;
      const t = e.target as HTMLElement;
      if (isOwn(t)) { hl.style.display = 'none'; label.style.display = 'none'; return; }
      if (t !== app.hoveredEl) { app.hoveredEl = t; posHL(t, hl); posLabel(t, label); }
    }, true);
    document.addEventListener('mouseup', () => { if (barDragging) { barDragging = false; bar.classList.remove('dragging'); save(); } });

    closeBtn.addEventListener('click', () => {
      setMode('browse', hl, label, panel, bar, dim);
      app.hoveredEl = null;
    });

    // Click to select
    document.addEventListener('click', (e) => {
      if (app.mode !== 'edit') return;
      const t = e.target as HTMLElement;
      if (isOwn(t)) return;
      e.preventDefault(); e.stopPropagation();

      if (e.shiftKey && app.selectedEls.length > 0) {
        const idx = app.selectedEls.indexOf(t);
        if (idx >= 0) {
          app.selectedEls.splice(idx, 1);
          if (app.selectedEls.length === 0) { clearSelection(hl, label, panel); return; }
          app.selectedEl = app.selectedEls[app.selectedEls.length - 1];
        } else {
          app.selectedEls.push(t);
          app.selectedEl = t;
        }
        posHL(app.selectedEl, hl); hl.classList.add('selected');
        updateMultiHighlights();
        label.style.display = 'none';
        showPanel(panel);
        updatePanelForSelection(panel);
        setTimeout(() => input.focus(), 50);
      } else {
        app.selectedEl = t;
        app.selectedEls = [t];
        clearMultiHighlights();
        posHL(t, hl); hl.classList.add('selected'); label.style.display = 'none'; showPanel(panel);
        updatePanelForSelection(panel);
        input.value = ''; input.style.height = 'auto'; setTimeout(() => input.focus(), 50);
      }

      if (app.ws?.readyState === WebSocket.OPEN) {
        extractSourceInfo(t).then(sourceInfo => {
          if (app.ws?.readyState === WebSocket.OPEN) {
            app.ws.send(JSON.stringify({ type: 'element-selected', selector: getSelector(t), tagName: t.tagName.toLowerCase(), className: t.className || '', textContent: t.textContent?.trim().slice(0, 100) || '', sourceInfo, rect: t.getBoundingClientRect().toJSON() }));
          }
        });
      }
    }, true);

    // Send edit
    async function sendEdit() {
      if (!app.selectedEl || !app.ws || app.ws.readyState !== WebSocket.OPEN) return;
      const instruction = input.value.trim(); if (!instruction) return;
      app.activeSendBtn = sendBtn;
      sendBtn.disabled = true; sendBtn.classList.add('loading');

      const elements = app.selectedEls.length > 1 ? app.selectedEls : [app.selectedEl];
      app.lastEdit = { tagName: elements.map(e => e.tagName.toLowerCase()).join(', '), instruction };

      if (elements.length === 1) {
        const el = elements[0];
        const sourceInfo = await extractSourceInfo(el);
        app.ws.send(JSON.stringify({ type: 'edit-request', selector: getSelector(el), tagName: el.tagName.toLowerCase(), className: el.className || '', textContent: el.textContent?.trim().slice(0, 100) || '', instruction, sourceInfo }));
      } else {
        const sourceInfo = await extractSourceInfo(elements[0]);
        const resolvedElements = await Promise.all(elements.map(async el => ({
          selector: getSelector(el),
          tagName: el.tagName.toLowerCase(),
          className: el.className || '',
          textContent: el.textContent?.trim().slice(0, 100) || '',
          sourceInfo: await extractSourceInfo(el),
        })));
        app.ws.send(JSON.stringify({
          type: 'edit-request',
          selector: getSelector(elements[0]),
          tagName: elements[0].tagName.toLowerCase(),
          className: elements[0].className || '',
          textContent: elements[0].textContent?.trim().slice(0, 100) || '',
          instruction,
          sourceInfo,
          elements: resolvedElements,
        }));
      }
      toast('Editing...', 'info');
      startPolling();
    }

    sendBtn.addEventListener('click', sendEdit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEdit(); } });

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setMode(app.mode === 'browse' ? 'edit' : 'browse', hl, label, panel, bar, dim); return; }
      if (e.key === 'Escape') {
        if (histPanel.classList.contains('open')) {
          closeHistory();
        } else if (app.selectedEl) { clearSelection(hl, label, panel); app.hoveredEl = null; }
        else if (app.mode === 'edit') setMode('browse', hl, label, panel, bar, dim);
      }
    });
  }

  // ---- Persistence across navigations ----
  function reinjectIfNeeded() {
    if (!document.querySelector(`.${L}-root`) && document.body) {
      init();
    }
  }

  function start() {
    init();

    let reinjectTimer: ReturnType<typeof setTimeout> | null = null;
    new MutationObserver(() => {
      if (!document.querySelector(`.${L}-root`) && document.body) {
        if (reinjectTimer) clearTimeout(reinjectTimer);
        reinjectTimer = setTimeout(() => { reinjectTimer = null; reinjectIfNeeded(); }, 50);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });

    // Framework-specific navigation events
    document.addEventListener('astro:after-swap', reinjectIfNeeded);
    document.addEventListener('sveltekit:navigation-end', reinjectIfNeeded);
    window.addEventListener('popstate', () => setTimeout(reinjectIfNeeded, 100));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
