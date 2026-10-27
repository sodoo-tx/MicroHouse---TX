/* ======================= MOTION ======================= */
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeBack = t => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function tween(ms, fn, done, ease = easeOut) {
  if (RM) { fn(1); if (done) done(); return; }
  const t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / ms); fn(ease(k)); if (k < 1) requestAnimationFrame(step); else if (done) done(); };
  requestAnimationFrame(step);
}
function animateView(to, ms = 520) {
  const from = Object.assign({}, G.view || to), svg = document.querySelector('#plan');
  tween(ms, k => { G.view = {x:from.x + (to.x - from.x) * k, y:from.y + (to.y - from.y) * k, w:from.w + (to.w - from.w) * k, h:from.h + (to.h - from.h) * k};
    svg.setAttribute('viewBox', `${G.view.x} ${G.view.y} ${G.view.w} ${G.view.h}`); });
}
function animateNum(el, to) {
  if (!el) return; const from = el._v == null ? to : el._v; el._v = to;
  if (Math.abs(to - from) < 1) { el.textContent = money(to); return; }
  tween(600, k => el.textContent = money(from + (to - from) * k));
}
function planMotion(prev) {
  const svg = document.querySelector('#plan'), used = new Set();
  S.items.forEach((it, idx) => {
    const el = svg.querySelector(`[data-it="${it.id}"]`); if (!el) return;
    let best = null;
    prev.forEach((p, j) => { if (used.has(j) || p.type !== it.type) return; const d = Math.hypot(p.x - it.x, p.y - it.y); if (!best || d < best.d) best = {d, j, p}; });
    if (best) {
      used.add(best.j); const a = best.p; if (best.d < 5 && Math.abs(a.rot - it.rot) < 1) return;
      let dr = ((it.rot - a.rot) % 360 + 540) % 360 - 180;
      el.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${a.rot})`);
      setTimeout(() => tween(560, k => el.setAttribute('transform', `translate(${(a.x + (it.x - a.x) * k).toFixed(1)} ${(a.y + (it.y - a.y) * k).toFixed(1)}) rotate(${(a.rot + dr * k).toFixed(2)})`)), Math.min(idx * 22, 300));
    } else { el.classList.add('enter'); el.style.setProperty('--d', Math.min(idx * 30, 420) + 'ms'); }
  });
  svg.querySelectorAll('.op').forEach((el, i) => { el.classList.add('enter'); el.style.setProperty('--d', (120 + i * 40) + 'ms'); });
}

/* ======================= GLOBAL UI STATE ======================= */
const G = {cut:true, motion:false, lastPos:[], geo:null, val:null, view:null, sel:null, dims:true, clr:false, tab:'layouts', hist:[], fut:[], thumbs:null, variants:null, roof:false, frame:false};

/* ======================= PLAN DRAWING ======================= */
const f1 = v => Math.round(v * 10) / 10;
const pts = P => P.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');
function symbol(it) {
  const w = it.w, d = it.d, x0 = -w/2, y0 = -d/2, t = it.type; let s = '';
  const R = (x, y, ww, hh, cls = 'sym', rx = 0) => `<rect class="${cls}" x="${f1(x)}" y="${f1(y)}" width="${f1(ww)}" height="${f1(hh)}" rx="${rx}"/>`;
  const C = (x, y, r, cls = 'sym') => `<circle class="${cls}" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/>`;
  const Ln = (a, b, c, e) => `<line class="sym" x1="${f1(a)}" y1="${f1(b)}" x2="${f1(c)}" y2="${f1(e)}"/>`;
  if (t === 'daybed') {
    s += R(x0 + 60, y0 + 60, w - 120, d - 200, 'sym', 40) + Ln(x0, y0 + 160, x0 + w, y0 + 160);
    s += `<rect class="sym" x="${f1(x0 + 60)}" y="${f1(y0 + d)}" width="${f1(w - 120)}" height="900" style="stroke-dasharray:10 7"/>`;
  } else if (t === 'loftbed') {
    s += `<rect class="sym" x="${f1(x0 + 50)}" y="${f1(y0 + 50)}" width="${f1(w - 600)}" height="${f1(d - 100)}" style="stroke-dasharray:12 7"/>` + R(x0 + 120, y0 + 60, w - 760, 550, 'sym', 10);
    for (let k = 0; k < 5; k++) s += Ln(x0 + w - 520, y0 + d - (k + 1) * d / 6, x0 + w - 40, y0 + d - (k + 1) * d / 6);
  } else if (t === 'wallstore') {
    for (let k = 1; k < 6; k++) s += Ln(x0 + k * w / 6, y0 + 20, x0 + k * w / 6, y0 + d);
    s += R(x0 + w * .4, y0 + 40, w * .2, d - 80, 'sym', 0);
  } else if (t === 'cart') {
    s += R(x0 + 30, y0 + 30, w - 60, d - 60, 'sym', 30) + C(x0 + 70, y0 + d - 50, 25, 'symf') + C(x0 + w - 70, y0 + d - 50, 25, 'symf');
  } else if (t === 'platformbed') {
    // storage boxes, mattress on top, steps at the open side
    for (let i = 1; i < 3; i++) s += Ln(x0 + i * w/3, y0, x0 + i * w/3, y0 + d - 650);
    s += Ln(x0, y0 + d - 650, x0 + w, y0 + d - 650);
    s += `<rect class="sym" x="${f1(x0 + 120)}" y="${f1(y0 + 80)}" width="${f1(w - 240)}" height="${f1(d - 850)}" style="stroke-dasharray:12 8"/>`;
    for (let i = 0; i < 3; i++) s += Ln(x0 + w/2 - 450, y0 + d - 650 + i * 216 + 108, x0 + w/2 + 450, y0 + d - 650 + i * 216 + 108);
  } else if (t === 'accshower') {
    s += Ln(x0 + 60, y0 + d - 60, x0 + w - 60, y0 + d - 60) + R(x0 + 40, y0 + 40, 420, 380, 'sym', 20) + C(0, 0, 45, 'symf');
    s += `<circle class="sym" cx="0" cy="0" r="${f1(Math.min(w, d) / 2 - 30)}" style="stroke-dasharray:8 8"/>`;
  } else if (t === 'acctoilet') {
    s += R(-140, y0, 280, 170) + `<ellipse class="sym" cx="0" cy="${f1(y0 + 170 + (d - 190) / 2)}" rx="160" ry="${f1((d - 190) / 2)}"/>`;
    s += Ln(x0 + 20, y0 + 80, x0 + 20, y0 + d - 40) + Ln(x0 + w - 20, y0 + 80, x0 + w - 20, y0 + d - 40);
  } else if (t === 'accbasin') {
    s += `<ellipse class="sym" cx="0" cy="${f1(y0 + d/2)}" rx="${f1(w/2 - 70)}" ry="${f1(d/2 - 70)}"/>` + `<line class="sym" x1="${f1(x0)}" y1="${f1(y0 + d + 60)}" x2="${f1(x0 + w)}" y2="${f1(y0 + d + 60)}" style="stroke-dasharray:6 6"/>`;
  } else if (t === 'tatamibed') {
    s += Ln(x0, y0 + d/2, x0 + w, y0 + d/2) + Ln(0, y0, 0, y0 + d/2) + Ln(0, y0 + d/2, 0, y0 + d - 220);
    s += R(x0 + 80, y0 + 70, w/2 - 120, 300, 'sym', 50) + R(40, y0 + 70, w/2 - 120, 300, 'sym', 50);
    s += Ln(x0, y0 + d - 220, x0 + w, y0 + d - 220) + Ln(x0 + w/3, y0 + d - 220, x0 + w/3, y0 + d) + Ln(x0 + 2*w/3, y0 + d - 220, x0 + 2*w/3, y0 + d);
  } else if (t === 'oshiire') {
    s += Ln(x0, y0 + d - 40, x0 + w, y0 + d - 40) + Ln(0, y0 + d - 60, 0, y0 + d) + `<line class="sym" x1="${f1(x0 + 60)}" y1="${f1(y0 + d/2)}" x2="${f1(x0 + w - 60)}" y2="${f1(y0 + d/2)}" style="stroke-dasharray:8 6"/>`;
  } else if (t === 'jang') {
    for (let i = 1; i < 3; i++) s += Ln(x0 + i * w/3, y0 + 20, x0 + i * w/3, y0 + d);
    for (let i = 0; i < 3; i++) s += C(x0 + (i + .5) * w/3, y0 + d - 70, 22, 'symf');
  } else if (t === 'shoeslim') {
    s += Ln(x0 + w/2, y0 + 20, x0 + w/2, y0 + d) + C(x0 + w/4, y0 + d - 50, 18, 'symf') + C(x0 + 3*w/4, y0 + d - 50, 18, 'symf');
  } else if (t === 'getabako' || t === 'pantry' || t === 'cleaning') {
    for (let i = 1; i < 4; i++) s += Ln(x0 + 30, y0 + i * d/4, x0 + w - 30, y0 + i * d/4);
    if (t === 'cleaning') s += Ln(x0 + 60, y0 + d - 60, x0 + w - 60, y0 + 60);
  } else if (t === 'nook') {
    s += Ln(x0, y0 + 60, x0 + w, y0 + 60) + `<rect class="sym" x="${f1(x0 + 100)}" y="${f1(y0 + d)}" width="${f1(w - 200)}" height="700" style="stroke-dasharray:10 7"/>`;
  } else if (t === 'rail') {
    s += Ln(x0 + 30, 0, x0 + w - 30, 0); for (let i = 0; i < 6; i++) s += Ln(x0 + 120 + i * (w - 240) / 5, -d/2 + 60, x0 + 120 + i * (w - 240) / 5, d/2 - 60);
  } else if (t === 'cleanrail') {
    s += Ln(x0 + 60, 0, x0 + w - 60, 0) + C(x0 + 120, 0, 25, 'symf') + C(x0 + w - 120, 0, 25, 'symf');
  } else if (t === 'benchstore') {
    s += Ln(x0, y0 + 60, x0 + w, y0 + 60) + C(0, y0 + d - 60, 25, 'symf');
  } else if (t === 'divider') {
    for (let i = 1; i < 4; i++) s += Ln(x0 + i * w/4, y0, x0 + i * w/4, y0 + d);
  } else if (t === 'nightstand') {
    s += Ln(x0 + 40, y0 + d/2, x0 + w - 40, y0 + d/2) + C(0, y0 + d - 60, 18, 'symf');
  } else if (t === 'bins') {
    for (let i = 0; i < 3; i++) s += R(x0 + 20 + i * (w - 40)/3, y0 + 30, (w - 40)/3 - 20, d - 60, 'sym', 20);
  } else if (t === 'kotatsu' || t === 'soban') {
    const tw = t === 'kotatsu' ? 800 : 700;
    s += R(-tw/2, -tw/2, tw, tw, 'sym', t === 'kotatsu' ? 30 : 80);
    if (t === 'kotatsu') s += R(-tw/2 - 60, -tw/2 - 60, tw + 120, tw + 120, 'sym', 60);
    const cu = 420, ch = 230; s += R(-cu/2, -tw/2 - 90 - ch, cu, ch, 'sym', 50) + R(-cu/2, tw/2 + 90, cu, ch, 'sym', 50);
  } else if (t === 'ofuro') {
    s += R(x0 + 60, y0 + 60, w - 140, d - 120, 'sym', 60) + R(x0 + w - 110, y0 + 120, 70, d - 240, 'sym', 10) + C(x0 + w/2, 0, 30);
  } else if (t === 'wallbed') {
    s += Ln(x0 + 40, y0 + d - 40, x0 + w - 40, y0 + d - 40) + Ln(x0, y0 + 60, x0 + w, y0 + 60);
  } else if (t.startsWith('bed')) {
    const n = w >= 1300 ? 2 : 1, pw = (w - 160 - (n - 1) * 80) / n;
    for (let i = 0; i < n; i++) s += R(x0 + 80 + i * (pw + 80), y0 + 70, pw, 330, 'sym', 60);
    s += Ln(x0, y0 + 560, x0 + w, y0 + 560) + Ln(x0, y0 + 600, x0 + w, y0 + 600);
  } else if (t === 'sofa' || t === 'sofabed') {
    s += R(x0, y0, w, 220) + R(x0, y0, 180, d) + R(x0 + w - 180, y0, 180, d);
    s += Ln(x0 + w/2, y0 + 220, x0 + w/2, y0 + d);
  } else if (t === 'dining') {
    s += R(x0, y0 + 300, w, d - 600, 'sym', 30) + R(x0 + w/2 - 200, y0 + 20, 400, 260, 'sym', 60) + R(x0 + w/2 - 200, y0 + d - 280, 400, 260, 'sym', 60);
  } else if (t === 'foldtable') {
    s += R(x0, y0, w, d, 'sym', 20) + Ln(x0, y0 + 60, x0 + w, y0 + 60);
  } else if (t === 'desk') {
    s += R(x0, y0, w, 560) + C(0, y0 + 820, 210);
  } else if (t === 'wardrobe' || t === 'shelf') {
    s += Ln(x0, y0 + d - 30, x0 + w, y0 + d - 30);
    if (t === 'wardrobe') s += Ln(0, y0 + d - 30, 0, y0 + d) + Ln(x0 + 60, y0 + d/2, x0 + w - 60, y0 + d/2);
    else for (let i = 1; i < 4; i++) s += Ln(x0 + i * w/4, y0, x0 + i * w/4, y0 + d);
  } else if (t === 'kitchen') {
    const o = it.opt || {}; const sx = x0 + clamp(o.sink ?? .7, 0, 1) * w, cx = x0 + clamp(o.cook ?? .25, 0, 1) * w;
    s += Ln(x0, y0 + d - 40, x0 + w, y0 + d - 40);
    s += R(clamp(sx - 220, x0 + 20, x0 + w - 460), y0 + 90, 440, 380, 'sym', 50) + C(clamp(sx, x0 + 240, x0 + w - 240), y0 + 280, 45);
    const hx = clamp(cx, x0 + 300, x0 + w - 300);
    s += R(hx - 280, y0 + 60, 560, 480, 'sym', 20) + C(hx - 130, y0 + 300, 95) + C(hx + 130, y0 + 300, 95);
    if (o.knee) s += `<rect class="sym" x="${f1(clamp(sx - 400, x0 + 10, x0 + w - 810))}" y="${f1(y0 + 10)}" width="800" height="${f1(d - 20)}" style="stroke-dasharray:4 6"/>`;
    if (o.pullout) s += `<rect class="sym" x="${f1(x0 + w/2 - 350)}" y="${f1(y0 + d)}" width="700" height="600" style="stroke-dasharray:10 7"/>`;
    if (o.washer) { const wx = clamp(x0 + w * (sx > 0 ? .5 : .5) - 300, x0 + 10, x0 + w - 610); s += C(wx + 300, y0 + 300, 190) + `<text class="it-label" x="${f1(wx + 300)}" y="${f1(y0 + 340)}" text-anchor="middle">W</text>`; }
    if (o.fridge) { const fx = (sx > 0 ? x0 + 20 : x0 + w - 620); s += R(clamp(fx, x0 + 10, x0 + w - 610), y0 + 30, 590, 520, 'sym', 0) + `<text class="it-label" x="${f1(clamp(fx, x0 + 10, x0 + w - 610) + 295)}" y="${f1(y0 + 330)}" text-anchor="middle">F</text>`; }
  } else if (t === 'fridge') {
    s += R(x0 + 40, y0 + 40, w - 80, d - 80) + `<text class="it-label" x="0" y="40" text-anchor="middle">F</text>`;
  } else if (t === 'shower') {
    s += Ln(x0, y0, x0 + w, y0 + d) + Ln(x0 + w, y0, x0, y0 + d) + C(0, 0, 50, 'symf');
  } else if (t === 'bath') {
    s += R(x0 + 70, y0 + 70, w - 140, d - 140, 'sym', 160) + C(x0 + w - 200, 0, 35);
  } else if (t === 'toilet' || t === 'wc') {
    s += R(x0 + 25, y0, w - 50, 170) + `<ellipse class="sym" cx="0" cy="${f1(y0 + 170 + (d - 190) / 2)}" rx="${f1(w/2 - 40)}" ry="${f1((d - 190) / 2)}"/>`;
  } else if (t === 'basin') {
    s += `<ellipse class="sym" cx="0" cy="${f1(y0 + d/2 + 20)}" rx="${f1(w/2 - 70)}" ry="${f1(d/2 - 80)}"/>` + C(0, y0 + 60, 20, 'symf');
  } else if (t === 'washer') {
    s += C(0, 20, Math.min(w, d) / 2 - 90);
  } else if (t === 'energy') {
    s += Ln(x0 + 100, y0 + 150, x0 + w - 100, y0 + 150) + Ln(x0 + 100, y0 + 300, x0 + w - 100, y0 + 300) + Ln(x0 + 100, y0 + 450, x0 + w - 100, y0 + 450);
  } else if (t === 'stove') {
    s += C(0, 0, 150) + C(0, 0, 60, 'symf');
  }
  return s;
}
function itemMarkup(it, o) {
  const c = CAT[it.type], bad = o.val && o.val.items[it.id] && o.val.items[it.id].length;
  const sel = o.sel && o.sel.kind === 'item' && o.sel.id === it.id;
  let cls = 'it' + (sel ? ' sel' : '') + (bad ? ' bad' : '') + (it.lock ? ' locked' : '');
  let g = `<g class="${cls}"${o.mini ? '' : ` data-it="${it.id}"`} transform="translate(${f1(it.x)} ${f1(it.y)}) rotate(${f1(it.rot)})"><g class="itin"><title>${esc(c.label)}${bad ? ': ' + esc(o.val.items[it.id].join(', ')) : ''}</title>`;
  if ((o.clr || sel) && c.clear && it.type !== 'wallbed') g += `<rect class="clr" x="${f1(-it.w/2)}" y="${f1(it.d/2)}" width="${f1(it.w)}" height="${c.clear}"/>`;
  if (it.type === 'wallbed') { const bw = it.w - 100, bd = 2000;
    g += `<rect class="sym" x="${f1(-bw/2)}" y="${f1(it.d/2)}" width="${f1(bw)}" height="${bd}" style="stroke-dasharray:14 10"/>`;
    g += `<rect class="sym" x="${f1(-bw/2 + 80)}" y="${f1(it.d/2 + 70)}" width="${f1(bw/2 - 120)}" height="300" style="stroke-dasharray:10 8"/><rect class="sym" x="${f1(40)}" y="${f1(it.d/2 + 70)}" width="${f1(bw/2 - 120)}" height="300" style="stroke-dasharray:10 8"/>`; }
  if (it.type === 'partition') {
    partitionParts(it).forEach(([a, b]) => { g += `<rect class="body c-build" x="${f1(a)}" y="${f1(-it.d/2)}" width="${f1(b - a)}" height="${f1(it.d)}"/>`; });
    if (it.opt && it.opt.door) { const dw = clamp(it.opt.dw || 700, 500, it.w - 100), cc = clamp((it.opt.dpos ?? .5) * it.w - it.w/2, -it.w/2 + dw/2, it.w/2 - dw/2);
      g += `<rect class="body" style="fill:var(--floor)" x="${f1(cc - dw/2)}" y="${f1(-it.d/2 - 20)}" width="${f1(dw)}" height="${f1(it.d + 40)}" opacity=".0"/>`;
      g += `<line class="sym" x1="${f1(cc - dw/2)}" y1="${f1(-it.d/2 - 25)}" x2="${f1(cc + dw/2 - 50)}" y2="${f1(-it.d/2 - 25)}" style="stroke-width:2.4px"/>`;
      g += `<line class="sym" x1="${f1(cc + dw/2 - 50)}" y1="${f1(-it.d/2 - 25)}" x2="${f1(cc + dw/2 + dw - 120)}" y2="${f1(-it.d/2 - 25)}" style="stroke-dasharray:6 5"/>`; }
    g += `<rect x="${f1(-it.w/2)}" y="${f1(-it.d/2 - 60)}" width="${f1(it.w)}" height="${f1(it.d + 120)}" fill="transparent"/>`;
  } else if (it.type === 'overhead') {
    g += `<rect class="body c-store" x="${f1(-it.w/2)}" y="${f1(-it.d/2)}" width="${f1(it.w)}" height="${f1(it.d)}" style="fill-opacity:.18; stroke-dasharray:14 8; stroke-opacity:.7"/>`;
  } else if (it.type === 'liftbed') {
    g += `<rect class="body" x="${f1(-it.w/2)}" y="${f1(-it.d/2)}" width="${f1(it.w)}" height="${f1(it.d)}" style="fill:none; stroke-dasharray:16 9"/>`;
    g += `<rect class="sym" x="${f1(-it.w/2 + 70)}" y="${f1(-it.d/2 + 70)}" width="${f1(it.w - 140)}" height="380" style="stroke-dasharray:8 8"/>`;
  } else if (it.type === 'net') {
    g += `<rect class="body" x="${f1(-it.w/2)}" y="${f1(-it.d/2)}" width="${f1(it.w)}" height="${f1(it.d)}" style="fill:none; stroke-dasharray:6 6"/>`;
    for (let k = -3; k <= 3; k++) g += `<line class="sym" x1="${f1(k * it.w / 8)}" y1="${f1(-it.d/2)}" x2="${f1(k * it.w / 8 + it.d / 3)}" y2="${f1(it.d/2)}" style="stroke-dasharray:4 6"/>`;
  } else if (it.type === 'dryrack') {
    g += `<rect class="body" x="${f1(-it.w/2)}" y="${f1(-it.d/2)}" width="${f1(it.w)}" height="${f1(it.d)}" style="fill:none; stroke-dasharray:10 7"/>`;
    for (let i = -1; i <= 1; i++) g += `<line class="sym" x1="${f1(-it.w/2 + 40)}" y1="${f1(i * it.d / 4)}" x2="${f1(it.w/2 - 40)}" y2="${f1(i * it.d / 4)}" style="stroke-dasharray:6 6"/>`;
  } else if (it.type === 'skylight') {
    g += `<rect class="body" x="${f1(-it.w/2)}" y="${f1(-it.d/2)}" width="${f1(it.w)}" height="${f1(it.d)}" style="fill:var(--glass); fill-opacity:.25; stroke-dasharray:8 5"/>`;
    g += `<line class="sym" x1="${f1(-it.w/2)}" y1="${f1(-it.d/2)}" x2="${f1(it.w/2)}" y2="${f1(it.d/2)}" style="stroke-dasharray:6 5"/>`;
  } else {
    g += `<rect class="body ${c.cls}" x="${f1(-it.w/2)}" y="${f1(-it.d/2)}" width="${f1(it.w)}" height="${f1(it.d)}" rx="${it.type === 'stove' ? 40 : 18}"/>`;
    g += symbol(it);
  }
  return g + '</g></g>';
}
function openingMarkup(geo, op, o) {
  const f = opFrame(geo, op); if (!f) return '';
  const e = f.e, n = e.n, sp = OPN[op.type];
  const bad = o.val && o.val.ops[op.id] && o.val.ops[op.id].length, sel = o.sel && o.sel.kind === 'op' && o.sel.id === op.id;
  const band = [f.a, f.b, add(f.b, mul(n, T)), add(f.a, mul(n, T))];
  let g = `<g class="op${sel ? ' sel' : ''}${bad ? ' bad' : ''}"${o.mini ? '' : ` data-op="${op.id}"`}>`;
  g += `<polygon class="op-gap" points="${pts(band)}"/>`;
  if (sp.kind === 'win') {
    [.38, .62].forEach(k => g += `<line class="op-glass" x1="${f1(f.a[0] + n[0]*T*k)}" y1="${f1(f.a[1] + n[1]*T*k)}" x2="${f1(f.b[0] + n[0]*T*k)}" y2="${f1(f.b[1] + n[1]*T*k)}"/>`);
    g += `<line class="op-door" x1="${f1(f.a[0])}" y1="${f1(f.a[1])}" x2="${f1(f.a[0] + n[0]*T)}" y2="${f1(f.a[1] + n[1]*T)}"/><line class="op-door" x1="${f1(f.b[0])}" y1="${f1(f.b[1])}" x2="${f1(f.b[0] + n[0]*T)}" y2="${f1(f.b[1] + n[1]*T)}"/>`;
  } else if (sp.kind === 'slide') {
    const m = mul(add(f.a, f.b), .5), u = e.u;
    const p1a = add(f.a, mul(n, T*.35)), p1b = add(add(m, mul(u, 80)), mul(n, T*.35)), p2a = add(add(m, mul(u, -80)), mul(n, T*.65)), p2b = add(f.b, mul(n, T*.65));
    g += `<line class="op-glass" x1="${f1(p1a[0])}" y1="${f1(p1a[1])}" x2="${f1(p1b[0])}" y2="${f1(p1b[1])}"/><line class="op-glass" x1="${f1(p2a[0])}" y1="${f1(p2a[1])}" x2="${f1(p2b[0])}" y2="${f1(p2b[1])}"/>`;
  } else {
    const out = op.swing !== 'in';
    const H = op.hinge === 'R' ? f.b : f.a, O = op.hinge === 'R' ? f.a : f.b;
    const dir = out ? mul(n, -1) : n, base = out ? 0 : T;
    const pv = add(H, mul(n, base)), tip = add(pv, mul(dir, op.w)), oth = add(O, mul(n, base));
    const sweep = (crs(sub(tip, pv), sub(oth, pv)) > 0) ? 1 : 0;
    g += `<line class="op-door" x1="${f1(pv[0])}" y1="${f1(pv[1])}" x2="${f1(tip[0])}" y2="${f1(tip[1])}"/>`;
    g += `<path class="op-swing" d="M${f1(tip[0])} ${f1(tip[1])} A${f1(op.w)} ${f1(op.w)} 0 0 ${sweep} ${f1(oth[0])} ${f1(oth[1])}"/>`;
  }
  const hit = [add(f.a, mul(n, -160)), add(f.b, mul(n, -160)), add(f.b, mul(n, T + 160)), add(f.a, mul(n, T + 160))];
  g += `<polygon class="op-hit" points="${pts(hit)}"/>`;
  return g + '</g>';
}
function ideaMarkup(st, geo) {
  const I = (st.spec && st.spec.ideas) || {}; let h = '';
  const ops = (st.openings || []).map(op => ({op, f:opFrame(geo, op)})).filter(x => x.f);
  const out = x => mul(x.f.e.n, -1);
  const glass = ops.filter(x => OPN[x.op.type].kind !== 'door').sort((a, b) => b.op.w - a.op.w);
  if (I.bay && glass[0]) { const x = glass[0], u = x.f.e.u, n = out(x), a = add(x.f.a, mul(u, 0)), b = x.f.b;
    const P = [a, b, add(b, mul(n, 500)), add(a, mul(n, 500))]; h += `<polygon class="idea-bay" points="${pts(P)}"/>`; }
  if (I.porch) { const d = ops.find(x => OPN[x.op.type].kind === 'door'); if (d) { const n = out(d), u = d.f.e.u, m = mul(add(d.f.a, d.f.b), .5);
    const A = add(add(m, mul(u, -900)), mul(n, 1200)), B = add(add(m, mul(u, 900)), mul(n, 1200)); h += `<line class="idea-screen" x1="${f1(A[0])}" y1="${f1(A[1])}" x2="${f1(B[0])}" y2="${f1(B[1])}"/>`;
    const D = [add(add(m, mul(u, -1000)), mul(n, 0)), add(add(m, mul(u, 1000)), mul(n, 0)), add(add(m, mul(u, 1000)), mul(n, 1300)), add(add(m, mul(u, -1000)), mul(n, 1300))]; h += `<polygon class="idea-deck" points="${pts(D)}"/>`; } }
  if (I.trellis && glass[0]) { const x = glass[0], n = out(x), A = add(x.f.e.a, mul(n, 700)), B = add(x.f.e.b, mul(n, 700)); h += `<line class="idea-trellis" x1="${f1(A[0])}" y1="${f1(A[1])}" x2="${f1(B[0])}" y2="${f1(B[1])}"/>`; }
  if (I.pergola && glass[0]) { const x = glass[0], n = out(x), u = x.f.e.u, m = mul(add(x.f.a, x.f.b), .5);
    const P = [add(add(m, mul(u, -1500)), mul(n, 100)), add(add(m, mul(u, 1500)), mul(n, 100)), add(add(m, mul(u, 1500)), mul(n, 2500)), add(add(m, mul(u, -1500)), mul(n, 2500))]; h += `<polygon class="idea-deck" points="${pts(P)}"/>`; }
  if (I.wings) { const longE = geo.ext.filter(e => e.len > 3500).sort((p, q) => q.len - p.len).slice(0, 2);
    longE.forEach(e => { const n = mul(e.n, -1), m = mul(add(e.a, e.b), .5), r = Math.min(1900, e.len / 2 - 300); let d = `M${f1(m[0] - e.u[0] * r)} ${f1(m[1] - e.u[1] * r)} `;
      for (let k = 0; k <= 16; k++) { const a2 = Math.PI * k / 16, p = add(add(m, mul(e.u, -Math.cos(a2) * r)), mul(n, Math.sin(a2) * r * .75)); d += `L${f1(p[0])} ${f1(p[1])} `; }
      h += `<path class="idea-wing" d="${d}Z"/>`; }); }
  if (I.trundle) { const pb = (st.items || []).find(i => i.type === 'platformbed'); if (pb) { const f = frontDir(pb.rot), c = add([pb.x, pb.y], mul(f, pb.d / 2 + 500)); h += `<rect class="idea-trundle" x="${f1(c[0] - 700)}" y="${f1(c[1] - 450)}" width="1400" height="900" transform="rotate(${pb.rot} ${f1(c[0])} ${f1(c[1])})"/>`; } }
  if (I.shutters) glass.forEach(x => { const n = out(x), A = add(x.f.a, mul(n, 80)), B = add(x.f.b, mul(n, 80)), C2 = add(B, mul(n, 800)), D = add(A, mul(n, 800)); h += `<polygon class="idea-shutter" points="${pts([A, B, C2, D])}"/>`; });
  return h;
}
function planMarkup(st, geo, o = {}) {
  const val = o.val;
  let h = '';
  if (!o.mini) h += `<defs><pattern id="gridpat" width="500" height="500" patternUnits="userSpaceOnUse"><path d="M500 0H0V500" fill="none" stroke="var(--grid)" stroke-width="8"/></pattern></defs><rect class="g-grid" data-bg="1" x="-30000" y="-30000" width="60000" height="60000"/>`;
  // walls (module outlines) then floors
  geo.mods.forEach((m, i) => h += `<polygon class="wallfill" data-m="${i}" points="${pts(m.poly)}"/>`);
  const wetMods = new Set(st.items.filter(i => CAT[i.type] && CAT[i.type].zone === 'wet').map(i => modAt(geo, i.x, i.y)));
  geo.zones.forEach((z, i) => h += `<polygon class="${wetMods.has(z.key) && z.key !== 'C' ? 'floorwet' : 'floorfill'}" data-m="${i}" points="${pts(z.poly)}"/>`);
  // seams between wing pieces
  geo.mods.forEach(m => m.edges.filter(e => e.jk === 'piece').forEach(e => h += `<line class="joint" x1="${f1(e.a[0])}" y1="${f1(e.a[1])}" x2="${f1(e.b[0])}" y2="${f1(e.b[1])}" stroke-width="${o.mini ? 30 : 14}"/>`));
  // module joints
  geo.mods.forEach(m => m.edges.filter(e => e.type === 'joint').forEach(e => h += `<line class="joint" x1="${f1(e.a[0])}" y1="${f1(e.a[1])}" x2="${f1(e.b[0])}" y2="${f1(e.b[1])}" stroke-width="${o.mini ? 30 : 14}"/>`));
  // pillars
  if (!o.mini) pillarsOf(geo).forEach(p => h += `<rect class="pillar" x="${f1(p.p[0] - 50)}" y="${f1(p.p[1] - 50)}" width="100" height="100"/>`);
  // openings
  (st.openings || []).forEach(op => h += openingMarkup(geo, op, o));
  // items
  (st.items || []).filter(i => CAT[i.type]).forEach(it => h += itemMarkup(it, o));
  // dimensions
  if (o.dims) geo.ext.forEach(e => {
    const n = e.n, m = mid(e), p = add(m, mul(n, -430));
    let ang = Math.atan2(e.u[1], e.u[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang <= -90) ang += 180;
    const a = add(e.a, mul(n, -230)), b = add(e.b, mul(n, -230));
    h += `<line class="dimline" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"/>`;
    [e.a, e.b].forEach(q => { const q1 = add(q, mul(n, -150)), q2 = add(q, mul(n, -310)); h += `<line class="dimline" x1="${f1(q1[0])}" y1="${f1(q1[1])}" x2="${f1(q2[0])}" y2="${f1(q2[1])}"/>`; });
    h += `<text class="dim" x="${f1(p[0])}" y="${f1(p[1])}" text-anchor="middle" dominant-baseline="central" transform="rotate(${f1(ang)} ${f1(p[0])} ${f1(p[1])})">${(e.len/1000).toFixed(2)}</text>`;
  });
  if (!o.mini) {
    // module names
    if (G.tab === 'shape') geo.mods.forEach(m => { const c = centroid(m.poly); if (m.key === 'C') return; h += `<text class="it-label" x="${f1(c[0])}" y="${f1(c[1] + 260)}" text-anchor="middle" style="opacity:.55">${(polyArea(m.poly) / 1e6).toFixed(2)} m²</text>`; });
  }
  if (!o.mini) { const c = centroid(geo.mods[0].poly); h += `<text class="area-label" x="${f1(c[0])}" y="${f1(c[1])}" text-anchor="middle" dominant-baseline="central">${geo.area.toFixed(1)} m²</text>`; }
  if (!o.mini) h += ideaMarkup(st, geo);
  return h;
}
function viewBoxFor(geo, pad) { const b = geo.bbox; return [b[0] - pad, b[1] - pad, b[2] - b[0] + 2*pad, b[3] - b[1] + 2*pad]; }
function fitView() {
  const svg = $('#plan'), r = svg.getBoundingClientRect(), vb = viewBoxFor(G.geo, r.width < 600 ? 750 : 950);
  const ar = (r.width || 600) / (r.height || 500);
  let [x, y, w, h] = vb;
  if (w / h < ar) { const nw = h * ar; x -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y -= (nh - h) / 2; h = nh; }
  G.view = {x, y, w, h};
}
function renderPlan() {
  const svg = $('#plan');
  if (!G.view) fitView();
  const v = G.view; svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  svg.innerHTML = planMarkup(S, G.geo, {val:G.val, sel:G.sel, dims:G.dims, clr:G.clr});
  if (G.motion && !RM) planMotion(G.lastPos);
  G.motion = false;
  G.lastPos = S.items.map(i => ({type:i.type, x:i.x, y:i.y, rot:i.rot}));
}
function miniSVG(st) {
  const geo = buildGeo(st.shape), vb = viewBoxFor(geo, 450);
  const s = Math.max(vb[2], vb[3]); const vx = vb[0] - (s - vb[2]) / 2, vy = vb[1] - (s - vb[3]) / 2;
  return `<svg viewBox="${vx} ${vy} ${s} ${s}" aria-hidden="true">${planMarkup(st, geo, {mini:true})}</svg>`;
}

/* ======================= PLAN INTERACTION ======================= */
function svgPt(evt) {
  const svg = $('#plan'), p = svg.createSVGPoint(); p.x = evt.clientX; p.y = evt.clientY;
  const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y];
}
const drag = {mode:null, id:null, start:null, orig:null, moved:false, pointers:new Map(), pinch:null};
function initPlanEvents() {
  const svg = $('#plan');
  svg.addEventListener('pointerdown', e => {
    drag.pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (drag.pointers.size === 2) { const [a, b] = [...drag.pointers.values()]; drag.pinch = {d:Math.hypot(a[0]-b[0], a[1]-b[1]), view:{...G.view}}; drag.mode = 'pinch'; return; }
    const itEl = e.target.closest('[data-it]'), opEl = e.target.closest('[data-op]');
    const p = svgPt(e);
    svg.setPointerCapture(e.pointerId);
    if (itEl) {
      const it = S.items.find(i => i.id === itEl.dataset.it);
      select({kind:'item', id:it.id}, false);
      drag.mode = 'item'; drag.id = it.id; drag.start = p; drag.orig = [it.x, it.y]; drag.moved = false; drag.el = itEl;
    } else if (opEl) {
      select({kind:'op', id:opEl.dataset.op}, false);
      drag.mode = 'op'; drag.id = opEl.dataset.op; drag.start = p; drag.moved = false;
    } else {
      drag.mode = 'pan'; drag.start = [e.clientX, e.clientY]; drag.orig = {...G.view}; drag.moved = false; svg.classList.add('panning');
    }
  });
  svg.addEventListener('pointermove', e => {
    if (drag.pointers.has(e.pointerId)) drag.pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (drag.mode === 'pinch' && drag.pointers.size === 2) {
      const [a, b] = [...drag.pointers.values()], d = Math.hypot(a[0]-b[0], a[1]-b[1]), k = drag.pinch.d / Math.max(d, 1);
      const v0 = drag.pinch.view, cx = v0.x + v0.w/2, cy = v0.y + v0.h/2;
      G.view = {x:cx - v0.w*k/2, y:cy - v0.h*k/2, w:v0.w*k, h:v0.h*k}; $('#plan').setAttribute('viewBox', `${G.view.x} ${G.view.y} ${G.view.w} ${G.view.h}`); return;
    }
    if (!drag.mode) return;
    if (drag.mode === 'pan') {
      const r = svg.getBoundingClientRect(), k = G.view.w / r.width;
      const dx = (e.clientX - drag.start[0]) * k, dy = (e.clientY - drag.start[1]) * k;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      G.view.x = drag.orig.x - dx; G.view.y = drag.orig.y - dy; svg.setAttribute('viewBox', `${G.view.x} ${G.view.y} ${G.view.w} ${G.view.h}`);
    } else if (drag.mode === 'item') {
      const it = S.items.find(i => i.id === drag.id); if (!it || it.lock) return;
      const p = svgPt(e); let nx = drag.orig[0] + p[0] - drag.start[0], ny = drag.orig[1] + p[1] - drag.start[1];
      if (!e.altKey) { nx = Math.round(nx / 50) * 50; ny = Math.round(ny / 50) * 50; }
      if (!drag.moved && Math.hypot(p[0] - drag.start[0], p[1] - drag.start[1]) < 20) return;
      if (!drag.moved) { snapshot(); drag.moved = true; }
      it.x = nx; it.y = ny; drag.el.setAttribute('transform', `translate(${f1(nx)} ${f1(ny)}) rotate(${f1(it.rot)})`);
    } else if (drag.mode === 'op') {
      const o = S.openings.find(x => x.id === drag.id); if (!o) return;
      const p = svgPt(e);
      if (!drag.moved && Math.hypot(p[0] - drag.start[0], p[1] - drag.start[1]) < 30) return;
      if (!drag.moved) { snapshot(); drag.moved = true; }
      let best = null;
      G.geo.ext.forEach(ed => {
        const lo = o.w/2 + 180, hi = ed.len - o.w/2 - 180; if (hi < lo) return;
        const t = clamp(dot(sub(p, ed.a), ed.u), lo, hi), q = add(ed.a, mul(ed.u, t)), dd = Math.hypot(p[0]-q[0], p[1]-q[1]);
        if (!best || dd < best.d) best = {d:dd, e:ed, t};
      });
      if (best) { o.edge = best.e.key; o.s = Math.round(best.t / 50) * 50; renderPlan(); }
    }
  });
  const end = e => {
    drag.pointers.delete(e.pointerId);
    if (drag.mode === 'pinch') { if (drag.pointers.size < 2) drag.mode = null; return; }
    if (drag.mode === 'pan' && !drag.moved) select(null);
    if ((drag.mode === 'item' || drag.mode === 'op') && drag.moved) commit();
    else if (drag.mode === 'item' || drag.mode === 'op') { renderPlan(); renderInspector(); }
    drag.mode = null; svg.classList.remove('panning');
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const p = svgPt(e), k = Math.exp(e.deltaY * 0.0015), v = G.view;
    const nw = clamp(v.w * k, 2500, 60000), kk = nw / v.w;
    G.view = {x:p[0] - (p[0] - v.x) * kk, y:p[1] - (p[1] - v.y) * kk, w:v.w * kk, h:v.h * kk};
    svg.setAttribute('viewBox', `${G.view.x} ${G.view.y} ${G.view.w} ${G.view.h}`);
  }, {passive:false});
  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,select,textarea,dialog')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (!mod && (e.key === '+' || e.key === '=')) { zoomPlan(.8); return; }
    if (!mod && (e.key === '-' || e.key === '_')) { zoomPlan(1.25); return; }
    if (!G.sel) return;
    if (G.sel.kind === 'item') {
      const it = S.items.find(i => i.id === G.sel.id); if (!it) return;
      if (e.key === 'r' || e.key === 'R') { snapshot(); it.rot = ((it.rot + (e.shiftKey ? 15 : 90)) % 360 + 360) % 360; commit(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); }
      else if (e.key.startsWith('Arrow') && !it.lock) { e.preventDefault(); snapshot(); const st = e.shiftKey ? 10 : 50;
        if (e.key === 'ArrowLeft') it.x -= st; if (e.key === 'ArrowRight') it.x += st; if (e.key === 'ArrowUp') it.y -= st; if (e.key === 'ArrowDown') it.y += st; commit(); }
      else if (e.key === 'Escape') select(null);
    } else if (G.sel.kind === 'op') {
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); }
      else if (e.key === 'Escape') select(null);
    }
  });
}
function zoomPlan(k) {
  if (!G.view) return; const v = G.view, cx = v.x + v.w / 2, cy = v.y + v.h / 2, nw = clamp(v.w * k, 2500, 60000), kk = nw / v.w;
  animateView({x:cx - v.w * kk / 2, y:cy - v.h * kk / 2, w:v.w * kk, h:v.h * kk}, 260);
}
function select(sel, rerender = true) { G.sel = sel; if (rerender) renderPlan(); renderInspector(); }
function removeSel() {
  if (!G.sel) return; snapshot();
  if (G.sel.kind === 'item') S.items = S.items.filter(i => i.id !== G.sel.id); else S.openings = S.openings.filter(o => o.id !== G.sel.id);
  G.sel = null; commit(); toast('Removed');
}
function duplicateSel() {
  if (!G.sel || G.sel.kind !== 'item') return;
  const it = S.items.find(i => i.id === G.sel.id); if (!it) return; snapshot();
  const c = JSON.parse(JSON.stringify(it)); c.id = uid(); c.lock = false;
  const spot = findSpot(c.type, c); if (spot) Object.assign(c, spot); else { c.x += 300; c.y += 300; }
  S.items.push(c); G.sel = {kind:'item', id:c.id}; commit();
}
function pushToWall(it) {
  let best = null;
  const eds = []; G.geo.zones.forEach(z => z.edges.forEach(e => eds.push(e))); partitionFaces(S.items.filter(i => i.id !== it.id)).forEach(e => eds.push(e));
  eds.forEach(e => { if (!e.wall) return;
    const t = clamp(dot(sub([it.x, it.y], e.a), e.u), it.w/2, e.len - it.w/2), q = add(e.a, mul(e.u, t)), dd = Math.hypot(it.x - q[0], it.y - q[1]);
    if (!best || dd < best.d) best = {d:dd, e, q}; });
  if (!best) return;
  const p = add(best.q, mul(best.e.n, it.d/2 + 4));
  it.x = Math.round(p[0]); it.y = Math.round(p[1]); it.rot = Math.round(Math.atan2(-best.e.n[0], best.e.n[1]) * 180 / Math.PI * 100) / 100;
}
/* find a free spot for a newly added item */
function findSpot(type, proto, geoIn) {
  const geo = geoIn || G.geo || buildGeo(S.shape), it = proto ? JSON.parse(JSON.stringify(proto)) : newItem(type);
  const bodies = S.items.filter(i => !CAT[i.type].overlay && i.id !== it.id).map(i => ({polys:solidPolys(i), clr:clearPoly(i), type:i.type}));
  const blocks = S.openings.map(o => opZones(geo, o)).filter(Boolean);
  const zones = geo.zones, inside = p => zones.some(z => inPoly(p, z.poly));
  const ok = () => {
    const b = bodyPoly(it); if (!insideZones(b, zones)) return false;
    if (CAT[type].high) {
      if (S.items.some(i => i.id !== it.id && CAT[i.type] && CAT[i.type].high && overlap(b, bodyPoly(i)))) return false;
      if (S.openings.some(o => { const z = opZones(geo, o); return z && FLOOR_H + o.sill + o.h > 1850 && overlap(b, z.poly, 5); })) return false;
      return true;
    }
    if (CAT[type].overlay) return true;
    const c = clearPoly(it);
    for (const o of bodies) { if (o.polys.some(q => overlap(b, q))) return false; if (o.clr && overlap(b, o.clr, 30)) return false; if (c && o.type !== 'partition' && o.polys.some(q => overlap(c, q, 30))) return false; }
    for (const z of blocks) { if (z.tall && CAT[type].h <= z.sill + 30) continue; if (overlap(b, z.poly, 10)) return false; }
    if (c && !c.slice(2).every(inside)) return false;
    return true;
  };
  const ctr = G.view ? [G.view.x + G.view.w/2, G.view.y + G.view.h/2] : centroid(geo.mods[0].poly);
  let best = null;
  const consider = (wallPenalty) => { if (ok()) { const d = Math.hypot(it.x - ctr[0], it.y - ctr[1]) + wallPenalty; if (!best || d < best.d) best = {d, x:it.x, y:it.y, rot:it.rot}; } };
  if (CAT[type].wall) {
    const edges = []; zones.forEach(z => z.edges.forEach(e => { if (e.wall) edges.push(e); })); partitionFaces(S.items).forEach(e => edges.push(e));
    edges.forEach(e => { if (e.len < it.w + 20) return;
      for (let s = it.w/2 + 10; s <= e.len - it.w/2 - 10; s += 100) { const p = add(add(e.a, mul(e.u, s)), mul(e.n, it.d/2 + 4));
        it.x = p[0]; it.y = p[1]; it.rot = Math.atan2(-e.n[0], e.n[1]) * 180 / Math.PI; consider(0); } });
  }
  if (!best || !CAT[type].wall) { const xs = zones.flatMap(z => z.poly.map(p => p[0])), ys = zones.flatMap(z => z.poly.map(p => p[1]));
    for (let x = Math.min(...xs); x < Math.max(...xs); x += 100) for (let y = Math.min(...ys); y < Math.max(...ys); y += 100) for (const rot of [0, 90]) { it.x = x; it.y = y; it.rot = rot; consider(CAT[type].wall ? 3000 : 0); } }
  return best ? {x:Math.round(best.x), y:Math.round(best.y), rot:Math.round(best.rot * 100) / 100} : null;
}
function addItem(type) {
  snapshot();
  const it = newItem(type);
  if (type === 'kitchen') it.w = S.program.kitchen;
  const spot = findSpot(type, it);
  if (spot) Object.assign(it, spot); else { const c = centroid(G.geo.mods[0].poly); it.x = c[0]; it.y = c[1]; toast('No free spot found, placed in the middle. Drag it where you want.'); }
  S.items.push(it); G.sel = {kind:'item', id:it.id}; commit();
  if (spot) toast(CAT[type].label + ' added');
}
function addOpening(type) {
  snapshot();
  const sp = OPN[type]; let best = null;
  G.geo.ext.forEach(e => {
    const taken = S.openings.filter(o => o.edge === e.key).map(o => [o.s - o.w/2 - 150, o.s + o.w/2 + 150]);
    for (let s = sp.w/2 + 200; s <= e.len - sp.w/2 - 200; s += 50) {
      if (taken.some(([a, b]) => s + sp.w/2 > a && s - sp.w/2 < b)) continue;
      const free = e.len - taken.reduce((x, [a, b]) => x + (b - a), 0);
      const sc = -free + Math.abs(s - e.len/2) * .3; if (!best || sc < best.sc) best = {sc, e, s};
    }
  });
  if (!best) { G.fut = []; G.hist.pop(); toast('No wall has room for a ' + sp.label.toLowerCase()); return; }
  const o = newOpening(type, best.e.key, best.s); S.openings.push(o); G.sel = {kind:'op', id:o.id}; commit(); toast(sp.label + ' added. Drag it along any wall.');
}
