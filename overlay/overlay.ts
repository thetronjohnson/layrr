(function () {
  if ((window as any).__LAYRR_LOADED__) return;
  (window as any).__LAYRR_LOADED__ = true;

  const WS_PORT = (window as any).__LAYRR_WS_PORT__ || 4567;
  const L = '__layrr';

  // ---- State ----
  type Mode = 'browse' | 'edit';
  let mode: Mode = 'browse';
  let hoveredEl: HTMLElement | null = null;
  let selectedEl: HTMLElement | null = null;
  let ws: WebSocket | null = null;
  let connected = false;
  let editCount = 0;
  let panelDragOffset = { x: 0, y: 0 };
  let isDragging = false;

  // ---- Phosphor Icons ----
  function loadPhosphor() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/__layrr__/phosphor/style.css';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: "Phosphor";
        src: url("/__layrr__/phosphor/Phosphor.woff2") format("woff2"),
             url("/__layrr__/phosphor/Phosphor.woff") format("woff");
        font-weight: normal; font-style: normal; font-display: block;
      }
    `;
    document.head.appendChild(style);
  }

  // ---- Styles ----
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      @keyframes ${L}-fadein { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
      @keyframes ${L}-fadeout { from { opacity:1; transform:translateY(0) } to { opacity:0; transform:translateY(-6px) } }
      @keyframes ${L}-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      @keyframes ${L}-spin { to { transform:rotate(360deg) } }
      @keyframes ${L}-glow { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,.4)} 50%{box-shadow:0 0 0 4px rgba(99,102,241,0)} }
      @keyframes ${L}-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

      .${L}-root * { box-sizing:border-box; margin:0; padding:0 }
      .${L}-root { font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; line-height:1.4; font-size:13px }

      /* Highlight */
      #${L}-hl {
        position:fixed; pointer-events:none; z-index:999997;
        border:1.5px solid #818cf8; border-radius:2px;
        background:rgba(99,102,241,.05);
        transition:all 60ms ease-out; display:none;
      }
      #${L}-hl.selected {
        border-color:#6366f1; background:rgba(99,102,241,.08);
        animation:${L}-glow 2s ease infinite;
      }

      /* Hover label */
      #${L}-label {
        position:fixed; pointer-events:none; z-index:999998;
        background:#1e1b4b; color:#a5b4fc;
        font-size:10px; font-family:'SF Mono',Menlo,monospace;
        padding:2px 6px; border-radius:3px;
        white-space:nowrap; display:none;
        box-shadow:0 2px 6px rgba(0,0,0,.4);
      }

      /* Panel */
      #${L}-panel {
        position:fixed; z-index:999999;
        background:rgba(10,10,20,.94);
        backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
        border:1px solid rgba(255,255,255,.06);
        border-radius:10px; width:340px;
        box-shadow:0 16px 48px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.03) inset;
        display:none; animation:${L}-fadein .15s ease;
      }

      .${L}-ph {
        display:flex; align-items:center; justify-content:space-between;
        padding:8px 10px 0; cursor:grab; user-select:none;
      }
      .${L}-ph:active { cursor:grabbing }
      .${L}-pb {
        display:flex; align-items:center; gap:5px;
        font-size:10px; font-weight:700; text-transform:uppercase;
        letter-spacing:.06em; color:#818cf8;
      }
      .${L}-pb i { font-size:12px }
      .${L}-px {
        width:20px; height:20px; border-radius:4px;
        border:none; background:transparent; color:#475569;
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        font-size:14px; transition:all .1s;
      }
      .${L}-px:hover { background:rgba(255,255,255,.06); color:#94a3b8 }

      .${L}-ei {
        margin:6px 10px; padding:6px 8px;
        background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.04);
        border-radius:6px;
      }
      .${L}-et {
        font-family:'SF Mono',Menlo,monospace; font-size:11px; color:#a5b4fc;
      }
      .${L}-ex {
        font-size:10px; color:#6b7280; margin-top:2px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .${L}-ep {
        font-size:9px; color:#4b5563; margin-top:2px;
        font-family:'SF Mono',Menlo,monospace;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }

      .${L}-ia { padding:0 10px 8px }
      .${L}-ir { display:flex; gap:6px; align-items:stretch }
      .${L}-in {
        flex:1; background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.07);
        border-radius:7px; padding:7px 10px;
        color:#e5e7eb; font-size:12px; outline:none;
        font-family:inherit; resize:none;
        transition:border-color .1s;
        min-height:32px; max-height:80px;
      }
      .${L}-in:focus { border-color:#6366f1 }
      .${L}-in::placeholder { color:#4b5563 }

      .${L}-sb {
        background:#6366f1; border:none; border-radius:7px;
        padding:0 12px; color:#fff; font-size:12px;
        cursor:pointer; font-weight:600;
        white-space:nowrap; transition:all .1s;
        display:flex; align-items:center; gap:5px;
      }
      .${L}-sb:hover { background:#4f46e5 }
      .${L}-sb:disabled { opacity:.4; cursor:not-allowed }
      .${L}-sp {
        width:12px; height:12px; border:1.5px solid rgba(255,255,255,.3);
        border-top-color:#fff; border-radius:50%;
        animation:${L}-spin .5s linear infinite; display:none;
      }
      .${L}-sb.loading .${L}-sp { display:block }
      .${L}-sb.loading .${L}-st { display:none }

      .${L}-hn {
        padding:0 10px 6px; font-size:9px; color:#4b5563;
        display:flex; gap:10px;
      }
      .${L}-hn kbd {
        background:rgba(255,255,255,.04); border-radius:2px;
        padding:0 4px; font-family:inherit; font-size:9px;
        border:1px solid rgba(255,255,255,.06); color:#6b7280;
      }

      /* Toasts */
      #${L}-toasts {
        position:fixed; bottom:60px; right:16px; z-index:999999;
        display:flex; flex-direction:column-reverse; gap:6px;
      }
      .${L}-toast {
        padding:7px 12px; border-radius:8px;
        font-size:12px; font-weight:500;
        font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;
        box-shadow:0 4px 20px rgba(0,0,0,.35);
        animation:${L}-fadein .15s ease;
        backdrop-filter:blur(10px);
        display:flex; align-items:center; gap:6px;
        max-width:280px;
      }
      .${L}-toast.out { animation:${L}-fadeout .25s ease forwards }
      .${L}-toast.success {
        background:rgba(6,78,59,.92); color:#6ee7b7;
        border:1px solid rgba(110,231,183,.15);
      }
      .${L}-toast.error {
        background:rgba(127,29,29,.92); color:#fca5a5;
        border:1px solid rgba(252,165,165,.15);
      }
      .${L}-toast.info {
        background:rgba(10,10,30,.92); color:#a5b4fc;
        border:1px solid rgba(165,180,252,.12);
      }
      .${L}-toast i { font-size:14px; flex-shrink:0 }

      /* Bar */
      #${L}-bar {
        position:fixed; bottom:16px; right:16px; z-index:999999;
        display:flex; align-items:center;
        background:rgba(10,10,20,.94);
        backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
        border:1px solid rgba(255,255,255,.06);
        border-radius:10px;
        box-shadow:0 4px 24px rgba(0,0,0,.4);
        user-select:none; animation:${L}-up .25s ease;
        padding:3px; height:36px;
        transition:box-shadow .1s;
      }
      #${L}-bar.dragging {
        box-shadow:0 8px 32px rgba(0,0,0,.5), 0 0 0 1.5px rgba(99,102,241,.3);
        cursor:grabbing;
      }

      .${L}-bd {
        display:flex; align-items:center; justify-content:center;
        width:18px; height:30px;
        cursor:grab; color:#374151; font-size:12px;
        transition:color .1s; flex-shrink:0;
      }
      .${L}-bd:hover { color:#6b7280 }
      .${L}-bd:active { cursor:grabbing }

      .${L}-bb {
        height:30px; border:none; border-radius:7px;
        padding:0 12px; font-size:12px; font-weight:600;
        cursor:pointer; transition:all .12s;
        display:flex; align-items:center; gap:5px;
        white-space:nowrap;
        font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;
      }

      .${L}-bbr { background:transparent; color:#6b7280 }
      .${L}-bbr.active { background:rgba(255,255,255,.07); color:#e5e7eb }
      .${L}-bbr:hover:not(.active) { color:#9ca3af }

      .${L}-bbe { background:transparent; color:#6b7280 }
      .${L}-bbe.active { background:#6366f1; color:#fff }
      .${L}-bbe:hover:not(.active) { color:#818cf8 }

      .${L}-bs {
        width:1px; height:16px; background:rgba(255,255,255,.06); margin:0 2px;
      }

      .${L}-bdt {
        width:6px; height:6px; border-radius:50%;
        margin:0 6px 0 2px; transition:background .3s;
      }
      .${L}-bdt.on { background:#34d399 }
      .${L}-bdt.off { background:#f87171; animation:${L}-pulse 2s infinite }

      .${L}-bg {
        background:rgba(99,102,241,.2); color:#a5b4fc;
        font-size:9px; font-weight:700;
        padding:1px 5px; border-radius:4px; margin-left:1px;
      }

      .${L}-bk {
        font-size:9px; color:#4b5563; padding:0 6px;
        display:flex; align-items:center;
      }
      .${L}-bk kbd {
        background:rgba(255,255,255,.04); border-radius:2px;
        padding:0 4px; font-family:inherit; font-size:9px;
        border:1px solid rgba(255,255,255,.06); color:#6b7280;
      }
    `;
    document.head.appendChild(s);
  }

  // ---- Elements ----
  function createElements() {
    const root = document.createElement('div');
    root.className = `${L}-root`;
    document.body.appendChild(root);

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
        <div class="${L}-pb"><i class="ph ph-sparkle"></i> layrr</div>
        <button class="${L}-px"><i class="ph ph-x"></i></button>
      </div>
      <div class="${L}-ei">
        <div class="${L}-et"></div>
        <div class="${L}-ex"></div>
        <div class="${L}-ep"></div>
      </div>
      <div class="${L}-ia">
        <div class="${L}-ir">
          <textarea class="${L}-in" placeholder="Describe the change..." rows="1"></textarea>
          <button class="${L}-sb">
            <span class="${L}-st">Go</span>
            <div class="${L}-sp"></div>
          </button>
        </div>
      </div>
      <div class="${L}-hn">
        <span><kbd>Enter</kbd> send</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    `;
    root.appendChild(panel);

    const toasts = document.createElement('div');
    toasts.id = `${L}-toasts`;
    root.appendChild(toasts);

    const bar = document.createElement('div');
    bar.id = `${L}-bar`;
    bar.innerHTML = `
      <div class="${L}-bd"><i class="ph ph-dots-six-vertical"></i></div>
      <div class="${L}-bs"></div>
      <button class="${L}-bb ${L}-bbr active">
        <i class="ph ph-cursor"></i> Browse
      </button>
      <button class="${L}-bb ${L}-bbe">
        <i class="ph ph-pencil-simple"></i> Edit
        <span class="${L}-bg" style="display:none">0</span>
      </button>
      <div class="${L}-bs"></div>
      <div class="${L}-bk"><kbd>⌘K</kbd></div>
      <div class="${L}-bdt off"></div>
    `;
    root.appendChild(bar);

    return { root, hl, label, panel, toasts, bar };
  }

  // ---- Helpers ----
  function isOwn(el: HTMLElement): boolean {
    return !!el.closest(`.${L}-root`);
  }

  function toast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    const container = document.getElementById(`${L}-toasts`)!;
    const el = document.createElement('div');
    el.className = `${L}-toast ${type}`;
    const ic = type === 'success' ? 'ph-check-circle' : type === 'error' ? 'ph-x-circle' : 'ph-info';
    el.innerHTML = `<i class="ph ${ic}"></i><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 3000);
  }

  function getTag(el: HTMLElement): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return `<${tag}${id}${cls}>`;
  }

  function getBreadcrumb(el: HTMLElement): string {
    const parts: string[] = [];
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.body && parts.length < 4) {
      parts.unshift(cur.tagName.toLowerCase() + (cur.id ? `#${cur.id}` : ''));
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function extractSourceInfo(el: HTMLElement): { file: string; line: number; column?: number } | null {
    const fk = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (fk) {
      let f = (el as any)[fk];
      while (f) {
        if (f._debugSource) return { file: f._debugSource.fileName, line: f._debugSource.lineNumber, column: f._debugSource.columnNumber };
        f = f.return;
      }
    }
    const v = (el as any).__vueParentComponent;
    if (v?.type?.__file) return { file: v.type.__file, line: 1 };
    return null;
  }

  function getSelector(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    const parts: string[] = [];
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.body) {
      let sel = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(`#${cur.id}`); break; }
      if (cur.className && typeof cur.className === 'string') {
        const c = cur.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (c) sel += `.${c}`;
      }
      const p = cur.parentElement;
      if (p) {
        const sibs = Array.from(p.children).filter(c => c.tagName === cur!.tagName);
        if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
      parts.unshift(sel);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  // ---- Positioning ----
  function posHL(el: HTMLElement, hl: HTMLElement) {
    const r = el.getBoundingClientRect();
    Object.assign(hl.style, {
      left: `${r.left - 1}px`, top: `${r.top - 1}px`,
      width: `${r.width + 2}px`, height: `${r.height + 2}px`,
      display: 'block',
    });
  }

  function posLabel(el: HTMLElement, lbl: HTMLElement) {
    const r = el.getBoundingClientRect();
    lbl.textContent = getTag(el);
    let top = r.top - 20;
    if (top < 4) top = r.bottom + 4;
    Object.assign(lbl.style, { left: `${r.left}px`, top: `${top}px`, display: 'block' });
  }

  function posPanel(el: HTMLElement, panel: HTMLElement) {
    const r = el.getBoundingClientRect();
    let left = r.left, top = r.bottom + 8;
    const pw = 340, ph = 180;
    if (left + pw > window.innerWidth) left = window.innerWidth - pw - 12;
    if (left < 12) left = 12;
    if (top + ph > window.innerHeight) top = r.top - ph - 8;
    if (top < 12) top = 12;
    Object.assign(panel.style, { left: `${left}px`, top: `${top}px`, display: 'block' });
  }

  // ---- WebSocket ----
  function connectWs(bar: HTMLElement) {
    const dot = bar.querySelector(`.${L}-bdt`) as HTMLElement;
    ws = new WebSocket(`ws://${location.hostname}:${WS_PORT}/__layrr__/ws`);

    ws.onopen = () => {
      connected = true;
      dot.className = `${L}-bdt on`;
      ws!.send(JSON.stringify({ type: 'overlay-ready' }));
    };

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'edit-result') {
        const btn = document.querySelector(`.${L}-sb`) as HTMLButtonElement;
        btn.disabled = false;
        btn.classList.remove('loading');
        if (msg.success) {
          editCount++;
          updateBadge();
          toast(msg.message || 'Done! Reloading...', 'success');
          setTimeout(() => location.reload(), 1500);
        } else {
          toast(msg.message || 'Edit failed', 'error');
        }
      }
    };

    ws.onclose = () => {
      connected = false;
      dot.className = `${L}-bdt off`;
      setTimeout(() => connectWs(bar), 2000);
    };
  }

  function updateBadge() {
    const b = document.querySelector(`.${L}-bg`) as HTMLElement;
    if (editCount > 0) { b.textContent = String(editCount); b.style.display = 'inline'; }
  }

  // ---- Mode ----
  function setMode(m: Mode, hl: HTMLElement, label: HTMLElement, panel: HTMLElement, bar: HTMLElement) {
    mode = m;
    const br = bar.querySelector(`.${L}-bbr`) as HTMLElement;
    const ed = bar.querySelector(`.${L}-bbe`) as HTMLElement;
    if (m === 'browse') {
      br.classList.add('active'); ed.classList.remove('active');
      document.body.style.cursor = '';
      selectedEl = null; hoveredEl = null;
      hl.style.display = 'none'; hl.classList.remove('selected');
      label.style.display = 'none'; panel.style.display = 'none';
    } else {
      br.classList.remove('active'); ed.classList.add('active');
      document.body.style.cursor = 'crosshair';
      toast('Click any element', 'info');
    }
  }

  // ---- Init ----
  function init() {
    loadPhosphor();
    injectStyles();
    const { hl, label, panel, bar } = createElements();
    connectWs(bar);

    const input = panel.querySelector(`.${L}-in`) as HTMLTextAreaElement;
    const sendBtn = panel.querySelector(`.${L}-sb`) as HTMLButtonElement;
    const closeBtn = panel.querySelector(`.${L}-px`) as HTMLButtonElement;
    const header = panel.querySelector(`.${L}-ph`) as HTMLElement;
    const browseBtn = bar.querySelector(`.${L}-bbr`) as HTMLElement;
    const editBtn = bar.querySelector(`.${L}-bbe`) as HTMLElement;
    const barDrag = bar.querySelector(`.${L}-bd`) as HTMLElement;

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });

    browseBtn.addEventListener('click', () => setMode('browse', hl, label, panel, bar));
    editBtn.addEventListener('click', () => setMode('edit', hl, label, panel, bar));

    // Bar drag
    let barDragging = false, barOff = { x: 0, y: 0 };
    barDrag.addEventListener('mousedown', (e: MouseEvent) => {
      barDragging = true; bar.classList.add('dragging');
      const r = bar.getBoundingClientRect();
      bar.style.right = 'auto'; bar.style.bottom = 'auto';
      bar.style.left = `${r.left}px`; bar.style.top = `${r.top}px`;
      barOff = { x: e.clientX - r.left, y: e.clientY - r.top };
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!barDragging) return;
      const bw = bar.offsetWidth, bh = bar.offsetHeight;
      bar.style.left = `${Math.max(4, Math.min(window.innerWidth - bw - 4, e.clientX - barOff.x))}px`;
      bar.style.top = `${Math.max(4, Math.min(window.innerHeight - bh - 4, e.clientY - barOff.y))}px`;
    });
    document.addEventListener('mouseup', () => { if (barDragging) { barDragging = false; bar.classList.remove('dragging'); } });

    // Panel drag
    header.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(`.${L}-px`)) return;
      isDragging = true;
      panelDragOffset = { x: e.clientX - panel.offsetLeft, y: e.clientY - panel.offsetTop };
    });
    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return;
      panel.style.left = `${e.clientX - panelDragOffset.x}px`;
      panel.style.top = `${e.clientY - panelDragOffset.y}px`;
    });
    document.addEventListener('mouseup', () => { isDragging = false; });

    closeBtn.addEventListener('click', () => {
      selectedEl = null; hoveredEl = null;
      hl.style.display = 'none'; hl.classList.remove('selected');
      label.style.display = 'none'; panel.style.display = 'none';
    });

    // Hover
    document.addEventListener('mousemove', (e) => {
      if (mode !== 'edit' || selectedEl || isDragging) return;
      const t = e.target as HTMLElement;
      if (isOwn(t)) { hl.style.display = 'none'; label.style.display = 'none'; return; }
      if (t !== hoveredEl) { hoveredEl = t; posHL(t, hl); posLabel(t, label); }
    }, true);

    // Click to select
    document.addEventListener('click', (e) => {
      if (mode !== 'edit') return;
      const t = e.target as HTMLElement;
      if (isOwn(t)) return;
      e.preventDefault(); e.stopPropagation();

      selectedEl = t;
      posHL(t, hl); hl.classList.add('selected');
      label.style.display = 'none';
      posPanel(t, panel);

      (panel.querySelector(`.${L}-et`) as HTMLElement).textContent = getTag(t);
      (panel.querySelector(`.${L}-ex`) as HTMLElement).textContent = t.textContent?.trim().slice(0, 50) || '(empty)';
      (panel.querySelector(`.${L}-ep`) as HTMLElement).textContent = getBreadcrumb(t);

      input.value = ''; input.style.height = 'auto';
      setTimeout(() => input.focus(), 50);

      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'element-selected',
          selector: getSelector(t), tagName: t.tagName.toLowerCase(),
          className: t.className || '',
          textContent: t.textContent?.trim().slice(0, 100) || '',
          sourceInfo: extractSourceInfo(t),
          rect: t.getBoundingClientRect().toJSON(),
        }));
      }
    }, true);

    // Send edit
    function sendEdit() {
      if (!selectedEl || !ws || ws.readyState !== WebSocket.OPEN) return;
      const instruction = input.value.trim();
      if (!instruction) return;
      sendBtn.disabled = true; sendBtn.classList.add('loading');
      ws.send(JSON.stringify({
        type: 'edit-request',
        selector: getSelector(selectedEl), tagName: selectedEl.tagName.toLowerCase(),
        className: selectedEl.className || '',
        textContent: selectedEl.textContent?.trim().slice(0, 100) || '',
        instruction, sourceInfo: extractSourceInfo(selectedEl),
      }));
      toast('Editing...', 'info');
    }

    sendBtn.addEventListener('click', sendEdit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEdit(); } });

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setMode(mode === 'browse' ? 'edit' : 'browse', hl, label, panel, bar); return; }
      if (e.key === 'Escape') {
        if (selectedEl) { selectedEl = null; hoveredEl = null; hl.style.display = 'none'; hl.classList.remove('selected'); label.style.display = 'none'; panel.style.display = 'none'; }
        else if (mode === 'edit') setMode('browse', hl, label, panel, bar);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
