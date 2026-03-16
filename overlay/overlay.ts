(function () {
  if ((window as any).__LAYRR_LOADED__) return;
  (window as any).__LAYRR_LOADED__ = true;

  const WS_PORT = (window as any).__LAYRR_WS_PORT__ || 4567;
  const L = '__layrr';

  type Mode = 'browse' | 'edit';
  let mode: Mode = 'browse';
  let hoveredEl: HTMLElement | null = null;
  let selectedEl: HTMLElement | null = null;
  let ws: WebSocket | null = null;
  let connected = false;
  let editCount = 0;
  let panelDragOffset = { x: 0, y: 0 };
  let isDragging = false;

  // Accent: neutral slate-blue that works on any bg
  const C = {
    accent: '#a1a1aa',        // zinc-400
    accentHover: '#d4d4d8',   // zinc-300
    accentLight: '#e4e4e7',   // zinc-200
    accentBg: 'rgba(228,228,231,.08)',
    hl: '#a1a1aa',            // zinc-400 for highlight
    hlBg: 'rgba(161,161,170,.06)',
    hlGlow: 'rgba(161,161,170,.25)',
    panel: 'rgba(24,24,27,.92)',       // zinc-900
    panelBorder: 'rgba(228,228,231,.1)',  // zinc-200 @ 10%
    text: '#fafafa',           // zinc-50
    textMuted: '#a1a1aa',      // zinc-400
    textDim: '#71717a',        // zinc-500
    surface: 'rgba(228,228,231,.05)',
    border: 'rgba(228,228,231,.07)',
    success: '#4ade80',
    error: '#fb7185',
    btnBg: 'rgba(250,250,250,.12)',
    btnHover: 'rgba(250,250,250,.18)',
    white: '#fafafa',
  };

  // ---- Lucide ----
  function loadIcons() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/__layrr__/fonts/lucide.css';
    document.head.appendChild(link);

    const s = document.createElement('style');
    s.textContent = `@font-face{font-family:"lucide";src:url("/__layrr__/fonts/lucide.woff2") format("woff2"),url("/__layrr__/fonts/lucide.woff") format("woff");font-weight:normal;font-style:normal;font-display:block}`;
    document.head.appendChild(s);
  }

  // ---- Styles ----
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      @keyframes ${L}-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes ${L}-out{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(40px)}}
      @keyframes ${L}-pulse{0%,100%{opacity:1}50%{opacity:.35}}
      @keyframes ${L}-spin{to{transform:rotate(360deg)}}
      @keyframes ${L}-glow{0%,100%{box-shadow:0 0 0 0 ${C.hlGlow}}50%{box-shadow:0 0 0 5px rgba(59,130,246,0)}}
      @keyframes ${L}-up{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes ${L}-toast-in{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}

      .${L}-root *{box-sizing:border-box;margin:0;padding:0}
      .${L}-root{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;line-height:1.4;font-size:13px}
      .${L}-root [class^="icon-"],.${L}-root [class*=" icon-"]{font-family:'lucide'!important;font-style:normal;-webkit-font-smoothing:antialiased}

      #${L}-dim{position:fixed;inset:0;z-index:999996;pointer-events:none;background:rgba(0,0,0,.06);opacity:0;transition:opacity .3s ease}
      #${L}-dim.active{opacity:1}

      #${L}-hl{
        position:fixed;pointer-events:none;z-index:999997;
        border:1.5px solid ${C.hl};border-radius:2px;background:${C.hlBg};
        transition:all 60ms ease;display:none;
      }
      #${L}-hl.selected{border-color:${C.hl};background:rgba(161,161,170,.08);animation:${L}-glow 2s ease infinite}

      #${L}-label{
        position:fixed;pointer-events:none;z-index:999998;
        background:${C.panel};color:${C.textMuted};
        font-size:10px;font-family:'SF Mono',Menlo,monospace;
        padding:2px 7px;border-radius:4px;white-space:nowrap;display:none;
        box-shadow:0 2px 8px rgba(0,0,0,.3);border:1px solid ${C.border};
      }

      #${L}-panel{
        position:fixed;z-index:999999;
        background:${C.panel};
        backdrop-filter:blur(20px) saturate(1.2);-webkit-backdrop-filter:blur(20px) saturate(1.2);
        border:1px solid ${C.panelBorder};border-radius:10px;width:320px;
        box-shadow:0 16px 48px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.02) inset;
        display:none;animation:${L}-in .2s cubic-bezier(.2,.8,.2,1);
      }

      .${L}-ph{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 0;cursor:grab;user-select:none}
      .${L}-ph:active{cursor:grabbing}
      .${L}-pb{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${C.textMuted}}
      .${L}-pb i{font-size:12px}
      .${L}-px{
        width:22px;height:22px;border-radius:5px;border:none;background:transparent;
        color:${C.textDim};cursor:pointer;display:flex;align-items:center;justify-content:center;
        font-size:13px;transition:all .12s ease;
      }
      .${L}-px:hover{background:${C.surface};color:${C.textMuted};transform:scale(1.1)}
      .${L}-px:active{transform:scale(.95)}

      .${L}-ei{margin:6px 10px;padding:6px 8px;background:${C.surface};border:1px solid ${C.border};border-radius:6px}
      .${L}-et{font-family:'SF Mono',Menlo,monospace;font-size:11px;color:${C.hl}}
      .${L}-ex{font-size:10px;color:${C.textDim};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .${L}-ep{font-size:9px;color:${C.accent};margin-top:2px;font-family:'SF Mono',Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

      .${L}-ia{padding:0 10px 8px}
      .${L}-ir{display:flex;gap:6px;align-items:stretch}
      .${L}-in{
        flex:1;background:${C.surface};border:1px solid ${C.border};
        border-radius:7px;padding:7px 10px;color:${C.text};font-size:12px;
        outline:none;font-family:inherit;resize:none;
        transition:border-color .12s,box-shadow .12s;
        min-height:30px;max-height:72px;
      }
      .${L}-in:focus{border-color:rgba(161,161,170,.4);box-shadow:0 0 0 2px rgba(161,161,170,.08)}
      .${L}-in::placeholder{color:${C.textDim}}

      .${L}-sb{
        background:${C.btnBg};border:none;border-radius:7px;
        padding:0 12px;color:${C.white};font-size:12px;cursor:pointer;
        font-weight:600;white-space:nowrap;transition:all .12s ease;
        display:flex;align-items:center;gap:5px;position:relative;overflow:hidden;
      }
      .${L}-sb:hover{background:${C.btnHover};transform:translateY(-1px)}
      .${L}-sb:active{transform:translateY(0) scale(.97)}
      .${L}-sb:disabled{opacity:.35;cursor:not-allowed;transform:none}
      .${L}-sb.loading{background:${C.accentHover};animation:${L}-pulse 1.2s ease infinite}
      .${L}-sp{width:12px;height:12px;border:1.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:${L}-spin .5s linear infinite;display:none}
      .${L}-sb.loading .${L}-sp{display:block}
      .${L}-sb.loading .${L}-st{display:none}

      .${L}-hn{padding:0 10px 6px;font-size:9px;color:${C.textDim};display:flex;gap:10px}
      .${L}-hn kbd{background:${C.surface};border-radius:3px;padding:1px 4px;font-family:inherit;font-size:9px;border:1px solid ${C.border};color:${C.accent}}

      #${L}-toasts{position:fixed;bottom:56px;right:16px;z-index:999999;display:flex;flex-direction:column-reverse;gap:6px}
      .${L}-toast{
        padding:7px 12px;border-radius:7px;font-size:12px;font-weight:500;
        font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;
        box-shadow:0 4px 16px rgba(0,0,0,.3);animation:${L}-toast-in .25s cubic-bezier(.2,.8,.2,1);
        backdrop-filter:blur(10px);display:flex;align-items:center;gap:6px;max-width:240px;
      }
      .${L}-toast.out{animation:${L}-out .2s ease forwards}
      .${L}-toast.success{background:rgba(6,78,59,.9);color:${C.success};border:1px solid rgba(52,211,153,.1)}
      .${L}-toast.error{background:rgba(127,29,29,.9);color:${C.error};border:1px solid rgba(251,113,133,.1)}
      .${L}-toast.info{background:${C.panel};color:${C.textMuted};border:1px solid ${C.border}}
      .${L}-toast i{font-size:14px;flex-shrink:0}

      #${L}-bar{
        position:fixed;bottom:16px;right:16px;z-index:999999;
        display:flex;align-items:center;
        background:${C.panel};
        backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);
        border:1px solid ${C.panelBorder};border-radius:9px;
        box-shadow:0 4px 20px rgba(0,0,0,.35);
        user-select:none;animation:${L}-up .3s cubic-bezier(.2,.8,.2,1);
        padding:4px;height:42px;transition:box-shadow .12s,border-color .12s;
      }
      #${L}-bar:hover{border-color:rgba(148,163,184,.16)}
      #${L}-bar.dragging{box-shadow:0 8px 32px rgba(0,0,0,.45),0 0 0 1px rgba(161,161,170,.15);cursor:grabbing}

      .${L}-bd{display:flex;align-items:center;justify-content:center;width:20px;height:34px;cursor:grab;color:${C.textDim};font-size:13px;transition:color .12s;flex-shrink:0}
      .${L}-bd:hover{color:${C.textMuted}}
      .${L}-bd:active{cursor:grabbing}

      .${L}-bb{
        height:34px;border:none;border-radius:8px;padding:0 14px;
        font-size:13px;font-weight:600;cursor:pointer;
        transition:all .12s ease;display:flex;align-items:center;gap:4px;
        white-space:nowrap;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;
      }
      .${L}-bbr{background:transparent;color:${C.textDim}}
      .${L}-bbr.active{background:${C.surface};color:${C.text}}
      .${L}-bbr:hover:not(.active){color:${C.textMuted};transform:scale(1.02)}
      .${L}-bbr:active{transform:scale(.97)}
      .${L}-bbe{background:transparent;color:${C.textDim}}
      .${L}-bbe.active{background:${C.btnBg};color:${C.white}}
      .${L}-bbe:hover:not(.active){color:${C.textMuted};transform:scale(1.02)}
      .${L}-bbe:active{transform:scale(.97)}

      .${L}-bs{width:1px;height:18px;background:${C.border};margin:0 2px}
      .${L}-bdt{width:5px;height:5px;border-radius:50%;margin:0 6px 0 2px;transition:background .3s}
      .${L}-bdt.on{background:${C.success};box-shadow:0 0 5px rgba(52,211,153,.35)}
      .${L}-bdt.off{background:${C.error};animation:${L}-pulse 2s infinite}
      .${L}-bg{background:rgba(255,255,255,.1);color:${C.text};font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;margin-left:1px}
      .${L}-bk{font-size:11px;color:${C.textDim};padding:0 5px;display:flex;align-items:center}
      .${L}-bk kbd{background:${C.surface};border-radius:3px;padding:2px 6px;font-family:inherit;font-size:11px;border:1px solid ${C.border};color:${C.accent}}
    `;
    document.head.appendChild(s);
  }

  // ---- Elements ----
  function createElements() {
    const root = document.createElement('div');
    root.className = `${L}-root`;
    document.body.appendChild(root);

    const dim = document.createElement('div');
    dim.id = `${L}-dim`;
    root.appendChild(dim);

    const hl = document.createElement('div');
    hl.id = `${L}-hl`;
    root.appendChild(hl);

    const label = document.createElement('div');
    label.id = `${L}-label`;
    root.appendChild(label);

    const panel = document.createElement('div');
    panel.id = `${L}-panel`;
    panel.innerHTML = `
      <div class="${L}-ph">
        <div class="${L}-pb"><i class="icon-sparkles"></i> layrr</div>
        <button class="${L}-px"><i class="icon-x"></i></button>
      </div>
      <div class="${L}-ei">
        <div class="${L}-et"></div>
        <div class="${L}-ex"></div>
        <div class="${L}-ep"></div>
      </div>
      <div class="${L}-ia">
        <div class="${L}-ir">
          <textarea class="${L}-in" placeholder="Describe the change..." rows="1"></textarea>
          <button class="${L}-sb"><span class="${L}-st">Go</span><div class="${L}-sp"></div></button>
        </div>
      </div>
      <div class="${L}-hn"><span><kbd>Enter</kbd> send</span><span><kbd>Esc</kbd> close</span></div>
    `;
    root.appendChild(panel);

    const toasts = document.createElement('div');
    toasts.id = `${L}-toasts`;
    root.appendChild(toasts);

    const bar = document.createElement('div');
    bar.id = `${L}-bar`;
    bar.innerHTML = `
      <div class="${L}-bd"><i class="icon-grip-vertical"></i></div>
      <div class="${L}-bs"></div>
      <button class="${L}-bb ${L}-bbr active"><i class="icon-mouse-pointer"></i> Browse</button>
      <button class="${L}-bb ${L}-bbe"><i class="icon-pencil"></i> Edit<span class="${L}-bg" style="display:none">0</span></button>
      <div class="${L}-bs"></div>
      <div class="${L}-bk"><kbd>⌘K</kbd></div>
      <div class="${L}-bdt off"></div>
    `;
    root.appendChild(bar);

    return { root, dim, hl, label, panel, toasts, bar };
  }

  // ---- Helpers ----
  function isOwn(el: HTMLElement) { return !!el.closest(`.${L}-root`); }

  function toast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    const c = document.getElementById(`${L}-toasts`)!;
    const el = document.createElement('div');
    el.className = `${L}-toast ${type}`;
    const ic = type === 'success' ? 'icon-circle-check' : type === 'error' ? 'icon-circle-x' : 'icon-info';
    el.innerHTML = `<i class="${ic}"></i><span>${msg}</span>`;
    c.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 200); }, 3000);
  }


  function getTag(el: HTMLElement) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return `<${tag}${id}${cls}>`;
  }

  function getBreadcrumb(el: HTMLElement) {
    const p: string[] = [];
    let c: HTMLElement | null = el;
    while (c && c !== document.body && p.length < 4) {
      p.unshift(c.tagName.toLowerCase() + (c.id ? `#${c.id}` : ''));
      c = c.parentElement;
    }
    return p.join(' › ');
  }

  function extractSourceInfo(el: HTMLElement) {
    const fk = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (fk) { let f = (el as any)[fk]; while (f) { if (f._debugSource) return { file: f._debugSource.fileName, line: f._debugSource.lineNumber, column: f._debugSource.columnNumber }; f = f.return; } }
    const v = (el as any).__vueParentComponent;
    if (v?.type?.__file) return { file: v.type.__file, line: 1 };
    return null;
  }

  function getSelector(el: HTMLElement) {
    if (el.id) return `#${el.id}`;
    const parts: string[] = [];
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.body) {
      let sel = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(`#${cur.id}`); break; }
      if (cur.className && typeof cur.className === 'string') { const c = cur.className.trim().split(/\s+/).slice(0, 2).join('.'); if (c) sel += `.${c}`; }
      const p = cur.parentElement;
      if (p) { const sibs = Array.from(p.children).filter(c => c.tagName === cur!.tagName); if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(cur) + 1})`; }
      parts.unshift(sel); cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function posHL(el: HTMLElement, hl: HTMLElement) {
    const r = el.getBoundingClientRect();
    hl.style.borderRadius = getComputedStyle(el).borderRadius || '2px';
    Object.assign(hl.style, { left: `${r.left - 1}px`, top: `${r.top - 1}px`, width: `${r.width + 2}px`, height: `${r.height + 2}px`, display: 'block' });
  }

  function posLabel(el: HTMLElement, lbl: HTMLElement) {
    const r = el.getBoundingClientRect();
    lbl.textContent = getTag(el);
    let top = r.top - 22; if (top < 4) top = r.bottom + 4;
    Object.assign(lbl.style, { left: `${r.left}px`, top: `${top}px`, display: 'block' });
  }

  function posPanel(el: HTMLElement, panel: HTMLElement) {
    const r = el.getBoundingClientRect();
    let left = r.left, top = r.bottom + 8;
    if (left + 320 > window.innerWidth) left = window.innerWidth - 332;
    if (left < 12) left = 12;
    if (top + 170 > window.innerHeight) top = r.top - 178;
    if (top < 12) top = 12;
    Object.assign(panel.style, { left: `${left}px`, top: `${top}px`, display: 'block' });
  }

  // ---- WebSocket ----
  function connectWs(bar: HTMLElement) {
    const dot = bar.querySelector(`.${L}-bdt`) as HTMLElement;
    ws = new WebSocket(`ws://${location.hostname}:${WS_PORT}/__layrr__/ws`);
    ws.onopen = () => { connected = true; dot.className = `${L}-bdt on`; ws!.send(JSON.stringify({ type: 'overlay-ready' })); };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'edit-result') {
        document.querySelectorAll(`.${L}-sb`).forEach((btn) => {
          (btn as HTMLButtonElement).disabled = false;
          btn.classList.remove('loading');
        });
        if (msg.success) { editCount++; updateBadge(); location.reload(); }
        else toast(msg.message || 'Edit failed', 'error');
      }
    };
    ws.onclose = () => { connected = false; dot.className = `${L}-bdt off`; setTimeout(() => connectWs(bar), 2000); };
  }

  function updateBadge() {
    const b = document.querySelector(`.${L}-bg`) as HTMLElement;
    if (editCount > 0) { b.textContent = String(editCount); b.style.display = 'inline'; }
  }

  function setMode(m: Mode, hl: HTMLElement, label: HTMLElement, panel: HTMLElement, bar: HTMLElement, dim: HTMLElement) {
    mode = m;
    const br = bar.querySelector(`.${L}-bbr`) as HTMLElement;
    const ed = bar.querySelector(`.${L}-bbe`) as HTMLElement;
    if (m === 'browse') {
      br.classList.add('active'); ed.classList.remove('active');
      document.body.style.cursor = ''; dim.classList.remove('active');
      selectedEl = null; hoveredEl = null;
      hl.style.display = 'none'; hl.classList.remove('selected');
      label.style.display = 'none'; panel.style.display = 'none';
    } else {
      br.classList.remove('active'); ed.classList.add('active');
      document.body.style.cursor = 'crosshair'; dim.classList.add('active');
      toast('Click any element', 'info');
    }
  }

  function init() {
    loadIcons(); injectStyles();
    const { dim, hl, label, panel, bar } = createElements();
    connectWs(bar);

    const input = panel.querySelector(`.${L}-in`) as HTMLTextAreaElement;
    const sendBtn = panel.querySelector(`.${L}-sb`) as HTMLButtonElement;
    const closeBtn = panel.querySelector(`.${L}-px`) as HTMLButtonElement;
    const header = panel.querySelector(`.${L}-ph`) as HTMLElement;
    const browseBtn = bar.querySelector(`.${L}-bbr`) as HTMLElement;
    const editBtn = bar.querySelector(`.${L}-bbe`) as HTMLElement;
    const barDrag = bar.querySelector(`.${L}-bd`) as HTMLElement;

    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 72) + 'px'; });
    browseBtn.addEventListener('click', () => setMode('browse', hl, label, panel, bar, dim));
    editBtn.addEventListener('click', () => setMode('edit', hl, label, panel, bar, dim));

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
      if (isDragging) { panel.style.left = `${e.clientX - panelDragOffset.x}px`; panel.style.top = `${e.clientY - panelDragOffset.y}px`; }
      if (mode !== 'edit' || selectedEl || isDragging || barDragging) return;
      const t = e.target as HTMLElement;
      if (isOwn(t)) { hl.style.display = 'none'; label.style.display = 'none'; return; }
      if (t !== hoveredEl) { hoveredEl = t; posHL(t, hl); posLabel(t, label); }
    }, true);
    document.addEventListener('mouseup', () => { if (barDragging) { barDragging = false; bar.classList.remove('dragging'); } isDragging = false; });

    header.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(`.${L}-px`)) return;
      isDragging = true; panelDragOffset = { x: e.clientX - panel.offsetLeft, y: e.clientY - panel.offsetTop };
    });

    closeBtn.addEventListener('click', () => {
      selectedEl = null; hoveredEl = null;
      hl.style.display = 'none'; hl.classList.remove('selected');
      label.style.display = 'none'; panel.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
      if (mode !== 'edit') return;
      const t = e.target as HTMLElement;
      if (isOwn(t)) return;
      e.preventDefault(); e.stopPropagation();
      selectedEl = t; posHL(t, hl); hl.classList.add('selected'); label.style.display = 'none'; posPanel(t, panel);
      (panel.querySelector(`.${L}-et`) as HTMLElement).textContent = getTag(t);
      (panel.querySelector(`.${L}-ex`) as HTMLElement).textContent = t.textContent?.trim().slice(0, 50) || '(empty)';
      (panel.querySelector(`.${L}-ep`) as HTMLElement).textContent = getBreadcrumb(t);
      input.value = ''; input.style.height = 'auto'; setTimeout(() => input.focus(), 50);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'element-selected', selector: getSelector(t), tagName: t.tagName.toLowerCase(), className: t.className || '', textContent: t.textContent?.trim().slice(0, 100) || '', sourceInfo: extractSourceInfo(t), rect: t.getBoundingClientRect().toJSON() }));
      }
    }, true);

    function sendEdit() {
      if (!selectedEl || !ws || ws.readyState !== WebSocket.OPEN) return;
      const instruction = input.value.trim(); if (!instruction) return;
      sendBtn.disabled = true; sendBtn.classList.add('loading');      ws.send(JSON.stringify({ type: 'edit-request', selector: getSelector(selectedEl), tagName: selectedEl.tagName.toLowerCase(), className: selectedEl.className || '', textContent: selectedEl.textContent?.trim().slice(0, 100) || '', instruction, sourceInfo: extractSourceInfo(selectedEl) }));
      toast('Editing...', 'info');
    }

    sendBtn.addEventListener('click', sendEdit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEdit(); } });

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setMode(mode === 'browse' ? 'edit' : 'browse', hl, label, panel, bar, dim); return; }
      if (e.key === 'Escape') {
        if (selectedEl) { selectedEl = null; hoveredEl = null; hl.style.display = 'none'; hl.classList.remove('selected'); label.style.display = 'none'; panel.style.display = 'none'; }
        else if (mode === 'edit') setMode('browse', hl, label, panel, bar, dim);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
