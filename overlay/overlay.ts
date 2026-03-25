(async function () {
  if ((window as any).__LAYRR_LOADED__) return;
  (window as any).__LAYRR_LOADED__ = true;

  const WS_PORT = (window as any).__LAYRR_WS_PORT__ || 4567;
  const L = '__layrr';

  type Mode = 'browse' | 'edit';

  // ---- Persist state across navigations ----
  const SS_KEY = '__layrr_state';
  function loadState() {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }
  function saveState() {
    try {
      const bar = document.getElementById(`${L}-bar`);
      const state: any = { mode, editCount, lastEditTimestamp };
      if (bar) {
        const s = bar.style;
        if (s.left && s.top) {
          state.barPos = { left: s.left, top: s.top };
        }
      }
      sessionStorage.setItem(SS_KEY, JSON.stringify(state));
    } catch {}
  }

  const saved = loadState();
  let mode: Mode = saved.mode || 'browse';
  let hoveredEl: HTMLElement | null = null;
  let selectedEl: HTMLElement | null = null;
  let selectedEls: HTMLElement[] = [];
  let multiHighlights: HTMLElement[] = [];
  let ws: WebSocket | null = null;
  let connected = false;
  let editCount: number = saved.editCount || 0;
  // History is now fetched from git via /__layrr__/history
  let lastEdit: { tagName: string; instruction: string } | null = null;
  let historyPage = 0;

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

  // ---- Fonts ----
  function loadFonts() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/__layrr__/fonts/lucide.css';
    document.head.appendChild(link);

    const s = document.createElement('style');
    s.textContent = `
      @font-face{font-family:"lucide";src:url("/__layrr__/fonts/lucide.woff2") format("woff2"),url("/__layrr__/fonts/lucide.woff") format("woff");font-weight:normal;font-style:normal;font-display:block}
      @font-face{font-family:"Geist Mono";src:url("/__layrr__/fonts/GeistMono-Regular.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
      @font-face{font-family:"Geist Mono";src:url("/__layrr__/fonts/GeistMono-Medium.woff2") format("woff2");font-weight:500;font-style:normal;font-display:swap}
    `;
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
      .${L}-root{font-family:'Geist Mono',monospace;line-height:1.4;font-size:13px}
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
        font-size:10px;font-family:'Geist Mono',monospace;
        padding:2px 7px;border-radius:4px;white-space:nowrap;display:none;
        box-shadow:0 2px 8px rgba(0,0,0,.3);border:1px solid ${C.border};
      }

      /* Edit panel — lives inside #bar */
      .${L}-panel{
        display:none;width:320px;max-height:280px;overflow-y:auto;
        border-top:1px solid ${C.panelBorder};
        border-radius:14px 14px 0 0;
        animation:${L}-in .2s cubic-bezier(.2,.8,.2,1);
      }
      .${L}-panel.open{display:block}

      .${L}-ph{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 0;user-select:none}
      .${L}-pb{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${C.textMuted}}
      .${L}-pb i{font-size:12px}
      .${L}-px{
        width:22px;height:22px;border-radius:6px;border:none;background:transparent;
        color:${C.textDim};cursor:pointer;display:flex;align-items:center;justify-content:center;
        font-size:13px;transition:all .12s ease;
      }
      .${L}-px:hover{background:${C.surface};color:${C.textMuted}}
      .${L}-px:active{transform:scale(.95)}

      .${L}-ei{margin:6px 10px;padding:6px 8px;background:${C.surface};border:1px solid ${C.border};border-radius:8px}
      .${L}-eh{font-size:11px;color:${C.textDim};text-align:center;padding:8px 4px}
      .${L}-eh kbd{background:${C.bg};border:1px solid ${C.border};border-radius:3px;padding:1px 4px;font-size:10px;font-family:'Geist Mono',monospace}
      .${L}-et{font-family:'Geist Mono',monospace;font-size:11px;color:${C.hl}}
      .${L}-ex{font-size:10px;color:${C.textDim};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .${L}-ep{font-size:9px;color:${C.accent};margin-top:2px;font-family:'Geist Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

      .${L}-ia{padding:0 10px 8px}
      .${L}-ir{display:flex;gap:6px;align-items:stretch}
      .${L}-in{
        flex:1;background:${C.surface};border:1px solid ${C.border};
        border-radius:8px;padding:7px 10px;color:${C.text};font-size:12px;
        outline:none;font-family:inherit;resize:none;
        transition:border-color .12s,box-shadow .12s;
        min-height:30px;max-height:72px;
      }
      .${L}-in:focus{border-color:rgba(161,161,170,.4);box-shadow:0 0 0 2px rgba(161,161,170,.08)}
      .${L}-in::placeholder{color:${C.textDim}}

      .${L}-sb{
        background:${C.btnBg};border:none;border-radius:50%;
        width:30px;height:30px;padding:0;color:${C.white};font-size:14px;cursor:pointer;
        transition:all .12s ease;
        display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;flex-shrink:0;
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
        padding:7px 12px;border-radius:8px;font-size:12px;font-weight:500;
        font-family:'Geist Mono',monospace;
        box-shadow:0 4px 16px rgba(0,0,0,.3);animation:${L}-toast-in .25s cubic-bezier(.2,.8,.2,1);
        backdrop-filter:blur(10px);display:flex;align-items:center;gap:6px;max-width:240px;
      }
      .${L}-toast.out{animation:${L}-out .2s ease forwards}
      .${L}-toast.success{background:rgba(6,78,59,.9);color:${C.success};border:1px solid rgba(52,211,153,.1)}
      .${L}-toast.error{background:rgba(127,29,29,.9);color:${C.error};border:1px solid rgba(251,113,133,.1)}
      .${L}-toast.info{background:${C.panel};color:${C.textMuted};border:1px solid ${C.border}}
      .${L}-toast i{font-size:14px;flex-shrink:0}


      .${L}-mhl{
        position:fixed;pointer-events:none;z-index:999997;
        border:1.5px solid ${C.hl};border-radius:2px;background:rgba(161,161,170,.08);
        animation:${L}-glow 2s ease infinite;
      }
      .${L}-sel-count{
        display:inline-flex;align-items:center;justify-content:center;
        background:${C.btnBg};color:${C.accent};
        font-size:10px;font-weight:700;min-width:18px;height:18px;
        border-radius:9px;padding:0 5px;margin-left:6px;
      }
      .${L}-ei-multi{padding:10px 10px 4px;max-height:100px;overflow-y:auto}
      .${L}-ei-item{
        font-family:'Geist Mono',monospace;font-size:10px;color:${C.hl};
        padding:2px 0;display:flex;align-items:center;gap:6px;
      }
      .${L}-ei-rm{
        background:none;border:none;color:${C.textDim};cursor:pointer;
        font-size:11px;padding:0 2px;font-family:'lucide'!important;font-style:normal;
        -webkit-font-smoothing:antialiased;transition:color .12s;
      }
      .${L}-ei-rm:hover{color:${C.error}}

      #${L}-bar{
        position:fixed;bottom:16px;right:16px;z-index:999999;
        display:flex;flex-direction:column;
        background:${C.panel};
        backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);
        border:1px solid ${C.panelBorder};border-radius:14px;
        box-shadow:0 4px 20px rgba(0,0,0,.35);
        user-select:none;animation:${L}-up .3s cubic-bezier(.2,.8,.2,1);
        transition:box-shadow .12s,border-color .12s,border-radius .15s;
      }
      #${L}-bar:not(.expanded){border-radius:50px}
      #${L}-bar.expanded{overflow:hidden}
      #${L}-bar:hover{border-color:rgba(148,163,184,.16)}
      #${L}-bar.dragging{box-shadow:0 8px 32px rgba(0,0,0,.45),0 0 0 1px rgba(161,161,170,.15);cursor:grabbing}
      .${L}-toolbar{display:flex;align-items:center;padding:5px;height:40px}

      .${L}-bd{display:flex;align-items:center;justify-content:center;width:20px;height:30px;cursor:grab;color:${C.textDim};font-size:14px;transition:color .12s;flex-shrink:0}
      .${L}-bd:hover{color:${C.textMuted}}
      .${L}-bd:active{cursor:grabbing}

      .${L}-bb{
        width:30px;height:30px;border:none;border-radius:50%;padding:0;
        font-size:14px;cursor:pointer;
        transition:all .12s ease;display:flex;align-items:center;justify-content:center;
        position:relative;gap:0;
      }
      .${L}-bb::after{
        content:attr(data-tip);position:absolute;bottom:calc(100% + 10px);left:50%;
        transform:translateX(-50%) translateY(4px);
        background:${C.panel};color:${C.textMuted};
        font-size:11px;font-weight:500;letter-spacing:.01em;
        font-family:'Geist Mono',monospace;
        padding:5px 10px;border-radius:8px;white-space:nowrap;
        border:1px solid ${C.panelBorder};
        box-shadow:0 8px 24px rgba(0,0,0,.35);
        backdrop-filter:blur(12px);
        opacity:0;pointer-events:none;
        transition:opacity .15s ease,transform .15s cubic-bezier(.2,.8,.2,1);
      }
      .${L}-bb:hover::after{opacity:1;transform:translateX(-50%) translateY(0)}
      .${L}-bbr{background:transparent;color:${C.textDim}}
      .${L}-bbr.active{background:${C.surface};color:${C.text}}
      .${L}-bbr:hover:not(.active){color:${C.textMuted};transform:scale(1.02)}
      .${L}-bbr:active{transform:scale(.97)}
      .${L}-bbe{background:transparent;color:${C.textDim}}
      .${L}-bbe.active{background:${C.btnBg};color:${C.white}}
      .${L}-bbe:hover:not(.active){color:${C.textMuted};transform:scale(1.02)}
      .${L}-bbe:active{transform:scale(.97)}

      .${L}-bs{width:1px;height:18px;background:${C.border};margin:0 2px}
      .${L}-bhi{background:transparent;color:${C.textDim}}
      .${L}-bhi:hover{color:${C.textMuted};transform:scale(1.02)}
      .${L}-bhi:active{transform:scale(.97)}
      .${L}-bhi.open{background:${C.surface};color:${C.text}}

      /* History panel — inline in bar */
      #${L}-history{
        display:none;width:320px;max-height:280px;overflow-y:auto;
        border-top:1px solid ${C.panelBorder};
        border-radius:14px 14px 0 0;
        animation:${L}-in .2s cubic-bezier(.2,.8,.2,1);
      }
      #${L}-history.open{display:block}
      .${L}-hh{
        display:flex;align-items:center;justify-content:space-between;
        padding:8px 10px 0;font-size:10px;font-weight:700;
        text-transform:uppercase;letter-spacing:.06em;color:${C.textMuted};
      }
      .${L}-hh-close{
        width:22px;height:22px;border-radius:6px;border:none;background:transparent;
        color:${C.textDim};cursor:pointer;display:flex;align-items:center;justify-content:center;
        font-size:13px;transition:all .12s ease;margin-left:auto;
      }
      .${L}-hh-close:hover{background:${C.surface};color:${C.textMuted}}
      .${L}-hh-close:active{transform:scale(.95)}
      .${L}-hh-nav{display:flex;align-items:center;gap:2px}
      .${L}-hh-nav button{background:none;border:none;color:${C.textDim};font-size:13px;cursor:pointer;padding:2px 5px;border-radius:4px;line-height:1;transition:color .12s,background .12s;font-family:'lucide'!important;font-style:normal;-webkit-font-smoothing:antialiased}
      .${L}-hh-nav button:hover:not(:disabled){color:${C.textMuted};background:${C.surface}}
      .${L}-hh-nav button:disabled{opacity:.25;cursor:default}
      .${L}-he-list{margin:6px 10px 10px;background:${C.surface};border:1px solid ${C.border};border-radius:8px;overflow:hidden}
      .${L}-he{
        padding:8px 10px;border-bottom:1px solid ${C.border};
        font-size:12px;color:${C.text};display:flex;align-items:center;gap:8px;
      }
      .${L}-he:last-child{border-bottom:none}
      .${L}-he-body{flex:1;min-width:0}
      .${L}-he-el{font-family:'Geist Mono',monospace;font-size:10px;color:${C.textDim};margin-top:2px}
      .${L}-he-inst{color:${C.textMuted};font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .${L}-he.active .${L}-he-inst{color:${C.success}}
      .${L}-he-tag{
        display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
        padding:1px 5px;border-radius:4px;margin-left:6px;vertical-align:middle;
      }
      .${L}-he-tag.latest{background:${C.surface};color:${C.textDim}}
      .${L}-he.active .${L}-he-tag.latest{background:rgba(74,222,128,.12);color:${C.success}}
      .${L}-he.clickable{cursor:pointer}
      .${L}-he.clickable:hover{background:rgba(161,161,170,.06)}
      .${L}-he-actions{display:flex;gap:3px;flex-shrink:0}
      .${L}-he-btn{
        width:24px;height:24px;border:none;border-radius:6px;
        background:transparent;color:${C.textDim};cursor:pointer;
        display:flex;align-items:center;justify-content:center;font-size:12px;
        transition:all .12s ease;
      }
      .${L}-he-btn:hover{background:${C.surface};color:${C.textMuted}}
      .${L}-he-btn:active{transform:scale(.9)}
      .${L}-he-btn.danger:hover{background:rgba(251,113,133,.1);color:${C.error}}
      .${L}-he-empty{padding:20px 14px;text-align:center;color:${C.textDim};font-size:12px;margin:6px 10px 10px}
      .${L}-confirm-overlay{
        position:absolute;inset:0;background:#18181b;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
        border-radius:14px 14px 0 0;z-index:10;padding:16px;
      }
      .${L}-confirm-msg{font-size:12px;color:${C.textMuted};text-align:center;line-height:1.5}
      .${L}-confirm-actions{display:flex;gap:8px}
      .${L}-confirm-actions button{
        padding:5px 14px;border-radius:6px;border:none;font-size:11px;font-weight:600;
        font-family:'Geist Mono',monospace;cursor:pointer;transition:all .12s ease;
      }
      .${L}-confirm-actions button:active{transform:scale(.95)}
      .${L}-confirm-cancel{background:${C.btnBg};color:${C.textMuted}}
      .${L}-confirm-cancel:hover{background:${C.btnHover}}
      .${L}-confirm-yes{background:rgba(251,113,133,.15);color:${C.error}}
      .${L}-confirm-yes:hover{background:rgba(251,113,133,.25)}
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

    const toasts = document.createElement('div');
    toasts.id = `${L}-toasts`;
    root.appendChild(toasts);

    const bar = document.createElement('div');
    bar.id = `${L}-bar`;
    bar.innerHTML = `
      <div class="${L}-panel">
        <div class="${L}-ph">
          <div class="${L}-pb">Edit</div>
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
            <button class="${L}-sb"><span class="${L}-st"><i class="icon-arrow-up"></i></span><div class="${L}-sp"></div></button>
          </div>
        </div>
        <div class="${L}-hn"><span><kbd>Enter</kbd> send</span><span><kbd>Esc</kbd> close</span></div>
      </div>
      <div id="${L}-history">
        <div class="${L}-hh">History</div>
        <div class="${L}-he-empty">No edits yet</div>
      </div>
      <div class="${L}-toolbar">
        <div class="${L}-bd"><i class="icon-grip-vertical"></i></div>
        <div class="${L}-bs"></div>
        <button class="${L}-bb ${L}-bbr active" data-tip="Browse"><i class="icon-mouse-pointer"></i></button>
        <button class="${L}-bb ${L}-bbe" data-tip="Edit"><i class="icon-pencil"></i></button>
        <button class="${L}-bb ${L}-bhi" data-tip="History"><i class="icon-clock"></i></button>
      </div>
    `;
    root.appendChild(bar);

    const panel = bar.querySelector(`.${L}-panel`) as HTMLElement;

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

  // Use element-source for accurate source mapping across React, Vue, Svelte, Solid, Preact
  let _resolveSource: ((node: object) => Promise<{ filePath: string; lineNumber: number | null; columnNumber: number | null; componentName: string | null } | null>) | null = null;
  try {
    const es = await import('element-source');
    const resolver = es.createSourceResolver({ resolvers: [es.vueResolver, es.svelteResolver, es.solidResolver, es.preactResolver] });
    _resolveSource = resolver.resolveSource;
  } catch {}

  async function extractSourceInfo(el: HTMLElement): Promise<{ file: string; line: number; column?: number } | null> {
    // Primary: element-source (works for React 19+, Vue, Svelte, Solid, Preact)
    if (_resolveSource) {
      try {
        const info = await _resolveSource(el);
        if (info?.filePath && info.lineNumber) {
          return { file: info.filePath, line: info.lineNumber, column: info.columnNumber ?? undefined };
        }
      } catch {}
    }
    // Fallback: manual React fiber / Vue instance extraction
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

  function showPanel(panel: HTMLElement) {
    const bar = document.getElementById(`${L}-bar`);
    // Close history if open
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
    multiHighlights.forEach(h => h.remove());
    multiHighlights = [];
  }

  function updateMultiHighlights() {
    clearMultiHighlights();
    const root = document.querySelector(`.${L}-root`);
    if (!root) return;
    for (const el of selectedEls) {
      const mhl = document.createElement('div');
      mhl.className = `${L}-mhl`;
      const r = el.getBoundingClientRect();
      mhl.style.borderRadius = getComputedStyle(el).borderRadius || '2px';
      Object.assign(mhl.style, { left: `${r.left - 1}px`, top: `${r.top - 1}px`, width: `${r.width + 2}px`, height: `${r.height + 2}px` });
      root.appendChild(mhl);
      multiHighlights.push(mhl);
    }
  }

  function clearSelection(hl: HTMLElement, label: HTMLElement, panel: HTMLElement) {
    selectedEl = null;
    selectedEls = [];
    clearMultiHighlights();
    hl.style.display = 'none'; hl.classList.remove('selected');
    label.style.display = 'none';
    if (mode === 'edit') {
      updatePanelForSelection(panel);
    } else {
      hidePanel(panel);
    }
  }

  function updatePanelForSelection(panel: HTMLElement) {
    const ia = panel.querySelector(`.${L}-ia`) as HTMLElement;
    const hn = panel.querySelector(`.${L}-hn`) as HTMLElement;
    const elInfo = panel.querySelector(`.${L}-ei`) as HTMLElement;

    // No selection — show hint
    if (!selectedEl && selectedEls.length === 0) {
      elInfo.innerHTML = `<div class="${L}-eh">Click to select an element or <kbd>Shift+click</kbd> to select multiple</div>`;
      if (ia) ia.style.display = 'none';
      if (hn) hn.style.display = 'none';
      return;
    }

    // Has selection — show input area
    if (ia) ia.style.display = '';
    if (hn) hn.style.display = '';

    if (selectedEls.length <= 1) {
      // Single select
      const el = selectedEls[0] || selectedEl;
      if (!el) return;
      elInfo.innerHTML = `
        <div class="${L}-et">${getTag(el)}</div>
        <div class="${L}-ex">${el.textContent?.trim().slice(0, 50) || '(empty)'}</div>
        <div class="${L}-ep">${getBreadcrumb(el)}</div>
      `;
    } else {
      // Multi select
      let html = `<div class="${L}-et">Selected<span class="${L}-sel-count">${selectedEls.length}</span></div>`;
      html += `<div class="${L}-ei-multi">`;
      selectedEls.forEach((el, i) => {
        const tag = getTag(el).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `<div class="${L}-ei-item"><button class="${L}-ei-rm" data-idx="${i}"><i class="icon-x"></i></button><span>${tag}</span></div>`;
      });
      html += `</div>`;
      elInfo.innerHTML = html;
      // Wire up remove buttons
      elInfo.querySelectorAll(`.${L}-ei-rm`).forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt((btn as HTMLElement).dataset.idx || '0');
          selectedEls.splice(idx, 1);
          if (selectedEls.length === 0) {
            clearSelection(
              document.getElementById(`${L}-hl`)!,
              document.getElementById(`${L}-label`)!,
              panel
            );
          } else {
            selectedEl = selectedEls[selectedEls.length - 1];
            updateMultiHighlights();
            updatePanelForSelection(panel);
          }
        });
      });
    }
  }

  // ---- WebSocket ----
  let activeSendBtn: HTMLButtonElement | null = null;
  let hlEl: HTMLElement | null = null;
  let labelEl: HTMLElement | null = null;
  let panelEl: HTMLElement | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let spinnerTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastEditTimestamp: number = saved.lastEditTimestamp || 0;

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (spinnerTimeout) { clearTimeout(spinnerTimeout); spinnerTimeout = null; }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        const resp = await fetch('/__layrr__/edit-status');
        const data = await resp.json();
        if (data.success !== null && data.timestamp > lastEditTimestamp) {
          lastEditTimestamp = data.timestamp;
          stopPolling();
          onEditResult(data);
        }
      } catch {}
    }, 2000);
    // Spinner safety net: 60s timeout
    spinnerTimeout = setTimeout(() => {
      stopPolling();
      if (activeSendBtn) {
        activeSendBtn.disabled = false;
        activeSendBtn.classList.remove('loading');
        activeSendBtn = null;
      }
      toast('Edit timed out — no response received', 'error');
    }, 60000);
  }

  function onEditResult(msg: any) {
    stopPolling();
    // Reset button
    if (activeSendBtn) {
      activeSendBtn.disabled = false;
      activeSendBtn.classList.remove('loading');
      activeSendBtn = null;
    }
    if (msg.success) {
      editCount++;
      lastEdit = null;
      selectedEl = null;
      selectedEls = [];
      clearMultiHighlights();
      hoveredEl = null;
      if (hlEl) { hlEl.style.display = 'none'; hlEl.classList.remove('selected'); }
      if (labelEl) { labelEl.style.display = 'none'; }
      if (panelEl) { hidePanel(panelEl); }
      saveState();
      toast('Done!', 'success');
      setTimeout(() => location.reload(), 2500);
    } else {
      toast(msg.message || 'Edit failed', 'error');
    }
  }



  function connectWs(bar: HTMLElement) {
    ws = new WebSocket(`ws://${location.hostname}:${WS_PORT}/__layrr__/ws`);
    ws.onopen = () => { connected = true; ws!.send(JSON.stringify({ type: 'overlay-ready' })); };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'edit-result') onEditResult(msg);
        else if (msg.type === 'version-preview-result') {
          if (msg.success) {
            previewingHash = msg.hash;
            sessionStorage.setItem('__layrr_preview', msg.hash);
            toast(`Previewing: ${msg.message || msg.hash.slice(0, 7)}`, 'info');
            fetchAndRenderHistory();
            setTimeout(() => location.reload(), 1000);
          } else { toast('Preview failed', 'error'); }
        }
        else if (msg.type === 'version-restore-result') {
          if (msg.success) {
            previewingHash = null;
            sessionStorage.removeItem('__layrr_preview');
            toast('Back to latest', 'success');
            fetchAndRenderHistory();
            setTimeout(() => location.reload(), 1000);
          } else { toast('Restore failed', 'error'); }
        }
        else if (msg.type === 'version-revert-result') {
          if (msg.success) {
            previewingHash = null;
            sessionStorage.removeItem('__layrr_preview');
            toast('Permanently reverted', 'success');
            fetchAndRenderHistory();
            setTimeout(() => location.reload(), 1000);
          } else { toast('Revert failed', 'error'); }
        }
      } catch {}
    };
    ws.onclose = () => { connected = false; setTimeout(() => connectWs(bar), 2000); };
  }

  let previewingHash: string | null = sessionStorage.getItem('__layrr_preview') || null;

  async function fetchAndRenderHistory() {
    const container = document.getElementById(`${L}-history`);
    if (!container) return;
    try {
      const resp = await fetch('/__layrr__/history');
      const data: { head: string; commits: Array<{ hash: string; message: string; timeAgo: string }> } = await resp.json();
      if (data.commits.length === 0) {
        container.innerHTML = `<div class="${L}-hh"><span>History</span><button class="${L}-hh-close"><i class="icon-x"></i></button></div><div class="${L}-he-empty">No edits yet</div>`;
        container.querySelector(`.${L}-hh-close`)?.addEventListener('click', () => closeHistory());
        return;
      }
      const PAGE_SIZE = 5;
      const totalPages = Math.ceil(data.commits.length / PAGE_SIZE);
      if (historyPage >= totalPages) historyPage = totalPages - 1;
      const start = historyPage * PAGE_SIZE;
      const page = data.commits.slice(start, start + PAGE_SIZE);

      const nav = totalPages > 1
        ? `<div class="${L}-hh-nav">` +
          `<button class="${L}-hh-prev"${historyPage === 0 ? ' disabled' : ''}><i class="icon-chevron-left"></i></button>` +
          `<button class="${L}-hh-next"${historyPage >= totalPages - 1 ? ' disabled' : ''}><i class="icon-chevron-right"></i></button>` +
          `</div>` : '';

      const latestHash = data.commits[0]?.hash;
      const isPreviewingOlder = previewingHash && previewingHash !== latestHash;

      let html = `<div class="${L}-hh"><span>History (${data.commits.length})</span>${nav}<button class="${L}-hh-close"><i class="icon-x"></i></button></div>`;

      html += `<div class="${L}-he-list">`;
      html += page.map((c, i) => {
        const isLatest = c.hash === latestHash;
        const isActive = previewingHash ? c.hash === previewingHash : c.hash === data.head && i === 0;
        const clickable = !isActive;
        const cls = (isActive ? 'active' : '') + (clickable ? ' clickable' : '');

        let tag = '';
        if (isLatest) tag = `<span class="${L}-he-tag latest">latest</span>`;

        // Only show revert on non-active rows
        const actions = isLatest ? '' :
          `<button class="${L}-he-btn danger" data-action="revert" data-hash="${c.hash}" title="Revert to this version"><i class="icon-rotate-ccw"></i></button>`;

        return `<div class="${L}-he ${cls}" data-hash="${c.hash}">` +
          `<div class="${L}-he-body">` +
            `<div class="${L}-he-inst">${c.message}${tag}</div>` +
            `<div class="${L}-he-el">${c.timeAgo}</div>` +
          `</div>` +
          `<div class="${L}-he-actions">${actions}</div>` +
        `</div>`;
      }).join('') + '</div>';
      container.innerHTML = html;

      // Wire up events
      container.querySelector(`.${L}-hh-prev`)?.addEventListener('click', () => { historyPage--; fetchAndRenderHistory(); });
      container.querySelector(`.${L}-hh-next`)?.addEventListener('click', () => { historyPage++; fetchAndRenderHistory(); });
      container.querySelector(`.${L}-hh-close`)?.addEventListener('click', () => closeHistory());

      // Click row to preview that version (or restore to latest)
      container.querySelectorAll(`.${L}-he.clickable`).forEach(row => {
        row.addEventListener('click', () => {
          const hash = (row as HTMLElement).dataset.hash;
          if (!hash || !ws || ws.readyState !== WebSocket.OPEN) return;
          if (hash === latestHash && isPreviewingOlder) {
            ws.send(JSON.stringify({ type: 'version-restore' }));
          } else {
            ws.send(JSON.stringify({ type: 'version-preview', hash }));
          }
        });
      });

      // Revert buttons
      container.querySelectorAll(`.${L}-he-btn`).forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const hash = (btn as HTMLElement).dataset.hash;
          if (!hash || !ws || ws.readyState !== WebSocket.OPEN) return;
          showRevertConfirm(container, hash);
        });
      });
    } catch {
      container.innerHTML = `<div class="${L}-hh"><span>History</span><button class="${L}-hh-close"><i class="icon-x"></i></button></div><div class="${L}-he-empty">Could not load history</div>`;
      container.querySelector(`.${L}-hh-close`)?.addEventListener('click', () => closeHistory());
    }
  }

  function showRevertConfirm(container: HTMLElement, hash: string) {
    const overlay = document.createElement('div');
    overlay.className = `${L}-confirm-overlay`;
    overlay.innerHTML = `
      <div class="${L}-confirm-msg">Revert to this version?<br>All edits after this point will be lost.</div>
      <div class="${L}-confirm-actions">
        <button class="${L}-confirm-cancel">Cancel</button>
        <button class="${L}-confirm-yes">Revert</button>
      </div>
    `;
    container.style.position = 'relative';
    container.appendChild(overlay);
    overlay.querySelector(`.${L}-confirm-cancel`)?.addEventListener('click', () => overlay.remove());
    overlay.querySelector(`.${L}-confirm-yes`)?.addEventListener('click', () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'version-revert', hash }));
      }
      overlay.remove();
    });
  }

  function closeHistory() {
    const histPanel = document.getElementById(`${L}-history`);
    const bar = document.getElementById(`${L}-bar`);
    const histBtn = bar?.querySelector(`.${L}-bhi`) as HTMLElement;
    const browseBtn = bar?.querySelector(`.${L}-bbr`) as HTMLElement;
    if (histPanel) histPanel.classList.remove('open');
    if (histBtn) histBtn.classList.remove('open');
    if (bar) bar.classList.remove('expanded');
    if (browseBtn) browseBtn.classList.add('active');
  }

  function setMode(m: Mode, hl: HTMLElement, label: HTMLElement, panel: HTMLElement, bar: HTMLElement, dim: HTMLElement, silent = false) {
    if (m === 'edit' && previewingHash) {
      toast('Go back to latest to make edits', 'info');
      return;
    }
    mode = m;
    const br = bar.querySelector(`.${L}-bbr`) as HTMLElement;
    const ed = bar.querySelector(`.${L}-bbe`) as HTMLElement;
    if (m === 'browse') {
      br.classList.add('active'); ed.classList.remove('active');
      document.body.style.cursor = ''; dim.classList.remove('active');
      selectedEl = null; selectedEls = []; hoveredEl = null;
      clearMultiHighlights();
      hl.style.display = 'none'; hl.classList.remove('selected');
      label.style.display = 'none'; hidePanel(panel);
    } else {
      br.classList.remove('active'); ed.classList.add('active');
      document.body.style.cursor = 'crosshair'; dim.classList.add('active');
      selectedEl = null; selectedEls = []; hoveredEl = null;
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
    saveState();
  }

  function init() {
    loadFonts(); injectStyles();
    const { dim, hl, label, panel, bar } = createElements();
    hlEl = hl; labelEl = label; panelEl = panel;
    connectWs(bar);

    // Check for edit results missed during HMR reload
    fetch('/__layrr__/edit-status').then(r => r.json()).then(data => {
      if (data.success !== null && data.timestamp > lastEditTimestamp) {
        lastEditTimestamp = data.timestamp;
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
      // Close edit panel if open
      if (panel.classList.contains('open')) {
        selectedEl = null; selectedEls = []; clearMultiHighlights();
        hl.style.display = 'none'; hl.classList.remove('selected');
        label.style.display = 'none'; hidePanel(panel);
        hoveredEl = null;
      }
      const isOpen = histPanel.classList.toggle('open');
      histBtn.classList.toggle('open', isOpen);
      bar.classList.toggle('expanded', isOpen);
      // Deactivate browse/edit when history is open
      if (isOpen) {
        fetchAndRenderHistory();
        browseBtn.classList.remove('active');
        editBtn.classList.remove('active');
        document.body.style.cursor = ''; dim.classList.remove('active');
        mode = 'browse';
      } else {
        browseBtn.classList.add('active');
      }
    });

    // Undo
    // Restore saved state
    fetchAndRenderHistory();
    if (saved.barPos) {
      bar.style.right = 'auto'; bar.style.bottom = 'auto';
      bar.style.left = saved.barPos.left; bar.style.top = saved.barPos.top;
    }
    if (mode === 'edit') {
      setMode('edit', hl, label, panel, bar, dim, true);
    }

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
      if (mode !== 'edit' || barDragging) return;
      if (selectedEl && !e.shiftKey) return;
      const t = e.target as HTMLElement;
      if (isOwn(t)) { hl.style.display = 'none'; label.style.display = 'none'; return; }
      if (t !== hoveredEl) { hoveredEl = t; posHL(t, hl); posLabel(t, label); }
    }, true);
    document.addEventListener('mouseup', () => { if (barDragging) { barDragging = false; bar.classList.remove('dragging'); saveState(); } });

    closeBtn.addEventListener('click', () => {
      setMode('browse', hl, label, panel, bar, dim);
      hoveredEl = null;
    });

    document.addEventListener('click', (e) => {
      if (mode !== 'edit') return;
      const t = e.target as HTMLElement;
      if (isOwn(t)) return;
      e.preventDefault(); e.stopPropagation();

      if (e.shiftKey && selectedEls.length > 0) {
        // Multi-select: add or remove from selection
        const idx = selectedEls.indexOf(t);
        if (idx >= 0) {
          selectedEls.splice(idx, 1);
          if (selectedEls.length === 0) {
            clearSelection(hl, label, panel);
            return;
          }
          selectedEl = selectedEls[selectedEls.length - 1];
        } else {
          selectedEls.push(t);
          selectedEl = t;
        }
        // Position highlight on latest selected
        posHL(selectedEl, hl); hl.classList.add('selected');
        updateMultiHighlights();
        label.style.display = 'none';
        showPanel(panel);
        updatePanelForSelection(panel);
        setTimeout(() => input.focus(), 50);
      } else {
        // Single select (or first element of a new selection)
        selectedEl = t;
        selectedEls = [t];
        clearMultiHighlights();
        posHL(t, hl); hl.classList.add('selected'); label.style.display = 'none'; showPanel(panel);
        updatePanelForSelection(panel);
        input.value = ''; input.style.height = 'auto'; setTimeout(() => input.focus(), 50);
      }

      if (ws?.readyState === WebSocket.OPEN) {
        extractSourceInfo(t).then(sourceInfo => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'element-selected', selector: getSelector(t), tagName: t.tagName.toLowerCase(), className: t.className || '', textContent: t.textContent?.trim().slice(0, 100) || '', sourceInfo, rect: t.getBoundingClientRect().toJSON() }));
          }
        });
      }
    }, true);

    async function sendEdit() {
      if (!selectedEl || !ws || ws.readyState !== WebSocket.OPEN) return;
      const instruction = input.value.trim(); if (!instruction) return;
      activeSendBtn = sendBtn;
      sendBtn.disabled = true; sendBtn.classList.add('loading');

      const elements = selectedEls.length > 1 ? selectedEls : [selectedEl];
      lastEdit = { tagName: elements.map(e => e.tagName.toLowerCase()).join(', '), instruction };

      if (elements.length === 1) {
        const el = elements[0];
        const sourceInfo = await extractSourceInfo(el);
        ws.send(JSON.stringify({ type: 'edit-request', selector: getSelector(el), tagName: el.tagName.toLowerCase(), className: el.className || '', textContent: el.textContent?.trim().slice(0, 100) || '', instruction, sourceInfo }));
      } else {
        const sourceInfo = await extractSourceInfo(elements[0]);
        const resolvedElements = await Promise.all(elements.map(async el => ({
          selector: getSelector(el),
          tagName: el.tagName.toLowerCase(),
          className: el.className || '',
          textContent: el.textContent?.trim().slice(0, 100) || '',
          sourceInfo: await extractSourceInfo(el),
        })));
        ws.send(JSON.stringify({
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
      if ((e.metaKey || e.altKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setMode(mode === 'browse' ? 'edit' : 'browse', hl, label, panel, bar, dim); return; }
      if (e.key === 'Escape') {
        if (histPanel.classList.contains('open')) {
          closeHistory();
        } else if (selectedEl) { clearSelection(hl, label, panel); hoveredEl = null; }
        else if (mode === 'edit') setMode('browse', hl, label, panel, bar, dim);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
