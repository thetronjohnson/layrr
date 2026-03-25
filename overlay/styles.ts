import { L, C } from './constants';

export function loadFonts() {
  const container = document.createElement('div');
  container.id = `${L}-fonts`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/__layrr__/fonts/lucide.css';
  container.appendChild(link);

  const s = document.createElement('style');
  s.textContent = `
    @font-face{font-family:"lucide";src:url("/__layrr__/fonts/lucide.woff2") format("woff2"),url("/__layrr__/fonts/lucide.woff") format("woff");font-weight:normal;font-style:normal;font-display:block}
    @font-face{font-family:"Geist Mono";src:url("/__layrr__/fonts/GeistMono-Regular.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
    @font-face{font-family:"Geist Mono";src:url("/__layrr__/fonts/GeistMono-Medium.woff2") format("woff2");font-weight:500;font-style:normal;font-display:swap}
  `;
  container.appendChild(s);
  document.head.appendChild(container);
}

export function injectStyles() {
  const s = document.createElement('style');
  s.id = `${L}-styles`;
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

    /* Edit panel */
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

    /* Toasts */
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

    /* Multi-select highlights */
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

    /* Bar + Toolbar */
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

    /* History panel */
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

export function ensureStyles() {
  if (!document.getElementById(`${L}-styles`)) injectStyles();
  if (!document.getElementById(`${L}-fonts`)) loadFonts();
}
