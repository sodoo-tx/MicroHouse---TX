const $$ = s => [...document.querySelectorAll(s)];
/* ======================= HISTORY & COMMIT ======================= */
function snapshot() { G.hist.push(JSON.stringify(S)); if (G.hist.length > 80) G.hist.shift(); G.fut = []; updUndo(); }
function undo() { if (!G.hist.length) return; G.fut.push(JSON.stringify(S)); S = JSON.parse(G.hist.pop()); G.sel = null; G.motion = true; commit(true); }
function redo() { if (!G.fut.length) return; G.hist.push(JSON.stringify(S)); S = JSON.parse(G.fut.pop()); G.sel = null; G.motion = true; commit(true); }
function updUndo() { $('#undoBtn').disabled = !G.hist.length; $('#redoBtn').disabled = !G.fut.length; }
let t3d = null, tSave = null;
function commit(panelToo) {
  if (G.motion) G.motion3D = true;
  G.geo = buildGeo(S.shape);
  G.val = validate(G.geo);
  if (G.sel && ((G.sel.kind === 'item' && !S.items.some(i => i.id === G.sel.id)) || (G.sel.kind === 'op' && !S.openings.some(o => o.id === G.sel.id)))) G.sel = null;
  renderPlan(); renderInspector(); renderHeader(); renderCosts(); updateBadge(); renderCompass();
  if (panelToo || ['openings', 'furnish'].includes(G.tab)) renderPanel();
  clearTimeout(t3d); t3d = setTimeout(build3D, 90);
  clearTimeout(tSave); tSave = setTimeout(() => { try { localStorage.setItem('mhb-current', JSON.stringify(S)); } catch (e) {} }, 400);
  updUndo();
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));

/* ======================= HEADER ======================= */
function renderHeader() {
  const a = G.geo.area, lim = S.site.limit || 0, over = lim && a > lim + 1e-4;
  $('#areaVal').textContent = a.toFixed(1);
  $('#areaOf').textContent = lim ? ` of ${lim} m² used` : ' m², no limit';
  $('#meterFill').style.width = Math.min(100, a / (lim || 40) * 100) + '%';
  $('#meter').classList.toggle('over', !!over);
  $('#areaNote').textContent = !lim ? '' : over ? `, ${(a - lim).toFixed(1)} m² too much` : `, ${(lim - a).toFixed(1)} m² spare`;
}

/* ======================= INSPECTOR ======================= */
function numField(label, val, attr, min, max, step = 50) {
  return `<div class="field"><label>${label}</label><input type="number" ${attr} value="${Math.round(val * 100) / 100}" min="${min}" max="${max}" step="${step}"></div>`;
}
function renderInspector() {
  const box = $('#inspector');
  if (!G.sel) { box.hidden = true; return; }
  let h = '';
  if (G.sel.kind === 'item') {
    const it = S.items.find(i => i.id === G.sel.id); if (!it) { box.hidden = true; return; }
    const c = CAT[it.type], iss = (G.val.items[it.id] || []);
    h += `<h4>${c.label}</h4><div class="sub">${money(itemCost(it))}${it.lock ? ', locked in place' : ''}</div>`;
    h += numField('Width, mm', it.w, 'data-ip="w"', 300, 6000);
    if (it.type !== 'partition') h += numField('Depth, mm', it.d, 'data-ip="d"', 100, 3000);
    h += numField('Turn, degrees', it.rot, 'data-ip="rot"', -360, 360, 15);
    if (it.type === 'kitchen') {
      h += `<div class="range"><div class="lbl">Sink position <span>${Math.round(it.opt.sink * 100)}%</span></div><input type="range" min="0" max="1" step=".05" value="${it.opt.sink}" data-io="sink" style="grid-column:1/-1"></div>`;
      h += `<div class="range"><div class="lbl">Hob position <span>${Math.round(it.opt.cook * 100)}%</span></div><input type="range" min="0" max="1" step=".05" value="${it.opt.cook}" data-io="cook" style="grid-column:1/-1"></div>`;
      h += `<label class="check"><input type="checkbox" data-io="fridge" ${it.opt.fridge ? 'checked' : ''}> Fridge under the counter</label>`;
      h += `<label class="check"><input type="checkbox" data-io="pullout" ${it.opt.pullout ? 'checked' : ''}> Pull-out table and two folding stools</label>`;
      h += `<label class="check"><input type="checkbox" data-io="washer" ${it.opt.washer ? 'checked' : ''}> Washer-dryer under the counter</label>`;
    }
    if (it.type === 'partition') {
      h += `<label class="check"><input type="checkbox" data-io="door" ${it.opt.door ? 'checked' : ''}> Sliding door in this wall</label>`;
      if (it.opt.door) {
        h += numField('Door width, mm', it.opt.dw, 'data-io="dw"', 500, 1200);
        h += `<div class="range"><div class="lbl">Door position <span>${Math.round(it.opt.dpos * 100)}%</span></div><input type="range" min="0" max="1" step=".05" value="${it.opt.dpos}" data-io="dpos" style="grid-column:1/-1"></div>`;
      }
    }
    h += `<label class="check"><input type="checkbox" data-ip="lock" ${it.lock ? 'checked' : ''}> Lock, keep when auto-arranging</label>`;
    h += `<div class="status ${iss.length ? 'bad' : 'good'}">${iss.length ? iss.map(esc).join('<br>') : 'Fits, nothing blocked'}</div>`;
    h += `<div class="row"><button class="btn small" data-ia="rotL">Turn left</button><button class="btn small" data-ia="rotR">Turn right</button>${c.wall ? '<button class="btn small" data-ia="wall">Back to wall</button>' : ''}<button class="btn small" data-ia="dup">Duplicate</button><button class="btn small" data-ia="del">Remove</button><button class="btn small" data-ia="menu">More…</button></div>`;
  } else {
    const o = S.openings.find(x => x.id === G.sel.id); if (!o) { box.hidden = true; return; }
    const sp = OPN[o.type], iss = (G.val.ops[o.id] || []), e = edgeByKey(G.geo, o.edge);
    h += `<h4>${sp.label}</h4><div class="sub">${money(opCost(o))}${e ? `, on a ${(e.len/1000).toFixed(2)} m wall` : ''}</div>`;
    h += `<div class="field"><label>Type</label><select data-op="type">${Object.keys(OPN).map(k => `<option value="${k}" ${k === o.type ? 'selected' : ''}>${OPN[k].label}</option>`).join('')}</select></div>`;
    h += numField('Width, mm', o.w, 'data-op="w"', 400, 4000);
    h += numField('Height, mm', o.h, 'data-op="h"', 300, 2400);
    if (sp.kind === 'win') h += numField('Sill height, mm', o.sill, 'data-op="sill"', 0, 2000);
    if (sp.kind === 'door') {
      h += `<div class="field"><label>Hinge side</label><div class="seg"><button data-op-set="hinge:L" aria-pressed="${o.hinge !== 'R'}">Left</button><button data-op-set="hinge:R" aria-pressed="${o.hinge === 'R'}">Right</button></div></div>`;
      h += `<div class="field"><label>Opens</label><div class="seg"><button data-op-set="swing:out" aria-pressed="${o.swing !== 'in'}">Out</button><button data-op-set="swing:in" aria-pressed="${o.swing === 'in'}">In</button></div></div>`;
      h += `<p class="note">Opening outward keeps the door swing out of your floor space.</p>`;
    }
    h += `<div class="status ${iss.length ? 'bad' : 'good'}">${iss.length ? iss.map(esc).join('<br>') : 'Placed well'}</div>`;
    h += `<div class="row"><button class="btn small" data-ia="del">Remove</button><button class="btn small" data-ia="menu">More…</button></div>`;
  }
  box.innerHTML = `<span class="grab" aria-hidden="true"></span><button class="insp-close" data-ia="close" aria-label="Close">×</button>` + h; box.hidden = false;
}
function initInspector() {
  const box = $('#inspector');
  box.addEventListener('change', e => {
    const t = e.target;
    if (G.sel.kind === 'item') {
      const it = S.items.find(i => i.id === G.sel.id); if (!it) return; snapshot();
      if (t.dataset.ip === 'lock') it.lock = t.checked;
      else if (t.dataset.ip) it[t.dataset.ip] = Number(t.value) || 0;
      else if (t.dataset.io) it.opt[t.dataset.io] = t.type === 'checkbox' ? t.checked : Number(t.value);
      commit();
    } else {
      const o = S.openings.find(x => x.id === G.sel.id); if (!o) return; snapshot();
      if (t.dataset.op === 'type') { const sp = OPN[t.value]; o.type = t.value; o.w = sp.w; o.h = sp.h; o.sill = sp.sill; }
      else if (t.dataset.op) o[t.dataset.op] = Number(t.value) || 0;
      commit();
    }
  });
  box.addEventListener('input', e => { const t = e.target; if (t.type === 'range' && G.sel && G.sel.kind === 'item') {
    const it = S.items.find(i => i.id === G.sel.id); if (!it) return; it.opt[t.dataset.io] = Number(t.value); renderPlan(); const s = t.parentElement.querySelector('.lbl span'); if (s) s.textContent = Math.round(t.value * 100) + '%'; } });
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.opSet) { const [k, v] = b.dataset.opSet.split(':'); const o = S.openings.find(x => x.id === G.sel.id); snapshot(); o[k] = v; commit(); return; }
    const a = b.dataset.ia; if (!a) return;
    if (a === 'close') return select(null);
    if (a === 'menu') return openSmart();
    if (a === 'del') return removeSel();
    if (a === 'dup') return duplicateSel();
    const it = S.items.find(i => i.id === G.sel.id); if (!it) return; snapshot();
    if (a === 'rotL') it.rot = ((it.rot - 90) % 360 + 360) % 360;
    if (a === 'rotR') it.rot = ((it.rot + 90) % 360 + 360) % 360;
    if (a === 'wall') pushToWall(it);
    commit();
  });
}

/* ======================= LEFT PANEL ======================= */
const TABS = [
  ['layouts', 'Layouts', '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'],
  ['shape', 'Shape', '<path d="M4 20V8l5-4h11v9l-5 4v3z"/>'],
  ['openings', 'Doors and windows', '<rect x="5" y="3" width="14" height="18"/><path d="M12 3v18M5 12h14"/>'],
  ['furnish', 'Furnish', '<path d="M4 12V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M3 12h18v5H3zM5 17v3M19 17v3"/>'],
  ['systems', 'Energy and water', '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'],
  ['finishes', 'Finishes', '<path d="M4 4h16v6H4zM12 10v4M9 14h6v7H9z"/>'],
  ['ideas', 'Ideas', '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'],
  ['cluster', 'Cluster', '<rect x="3" y="3" width="8" height="10"/><rect x="13" y="7" width="8" height="10"/><rect x="6" y="15" width="8" height="6"/>'],
  ['prices', 'Prices', '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'],
];
function renderRail() {
  $('#rail').innerHTML = TABS.map(([k, l, ic]) => `<button role="tab" data-tab="${k}" aria-selected="${G.tab === k}"><svg viewBox="0 0 24 24">${ic}</svg>${l}</button>`).join('');
}
const get = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
function set(o, p, v) { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; }
const rng = (label, path, min, max, step, unit = '', fmt) => {
  const v = get(S, path); return `<div class="range"><div class="lbl">${label} <span>${fmt ? fmt(v) : v + unit}</span></div><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-bind="${path}" data-num="1"><input type="number" min="${min}" max="${max}" step="${step}" value="${v}" data-bind="${path}" data-num="1" aria-label="${label}"></div>`;
};
const seg = (path, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-set="${path}" data-val="${v}" aria-pressed="${String(get(S, path)) === String(v)}">${l}</button>`).join('')}</div>`;
const chk = (label, path) => `<label class="check"><input type="checkbox" data-bind="${path}" ${get(S, path) ? 'checked' : ''}> ${label}</label>`;
const sel = (label, path, opts) => `<div class="field wide"><label>${label}</label><select data-bind="${path}">${opts.map(([v, l]) => `<option value="${v}" ${String(get(S, path)) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;

function renderPanel() {
  const p = $('#panel'); let h = '';
  const fresh = G.lastTab !== G.tab; G.lastTab = G.tab;
  const t = G.tab;
  if (t === 'ideas') {
    h += `<h2>Ideas</h2><p class="lead">Ideas from our reference images, sorted for a 25 m² off-grid home. Our picks first, then more to try. Each one updates the plan, the 3D view and the price.</p>`;
    const card = it => { const on = it.kind === 'info' ? null : ideaOn(it.k);
      return `<div class="idea${on ? ' on' : ''}"><div class="idea-t">${esc(it.t)}${it.kind === 'item' || it.kind === 'feature' ? `<span class="idea-p">${ideaPrice(it.k)}</span>` : ''}</div><p>${esc(it.d)}</p>${it.kind === 'info' ? '' : `<button class="btn small${on ? '' : ' primary'}" data-idea="${it.k}">${it.kind === 'link' ? 'Open Cluster' : on ? 'Remove' : 'Add'}</button>`}</div>`; };
    h += `<h3>Our picks</h3>` + IDEAS.filter(x => x.main).map(card).join('');
    [['Furniture', 'More ideas: furniture and storage'], ['Outside', 'More ideas: outside and climate'], ['Energy', 'More ideas: energy and water'], ['Build', 'More ideas: Kingspan building products'], ['Concepts', 'Concepts and links']].forEach(([g, title]) => { const L = IDEAS.filter(x => !x.main && x.g === g); if (L.length) h += `<h3>${title}</h3>` + L.map(card).join(''); });
  }
  if (t === 'cluster') {
    const n = G.clusterN || 6;
    h += `<h2>Cluster</h2><p class="lead">Interlock several homes into a neighbourhood. Each home is complete on its own; rotated and mirrored copies fit into each other’s steps and share walls.</p>`;
    h += `<div class="field stack"><label>Homes</label><div class="seg">${[2, 3, 4, 6, 8].map(k => `<button data-cl="${k}" aria-pressed="${k === n}">${k}</button>`).join('')}</div></div>`;
    const cl = clusterLayout(S, n), cs = clusterStats(S, cl);
    G.cluster = cl;
    const ns = G.storeys || 1;
    h += `<div class="field stack"><label>Storeys</label><div class="seg">${[1, 2, 3, 4].map(k => `<button data-st="${k}" aria-pressed="${k === ns}">${k}</button>`).join('')}</div></div>`;
    if (ns > 1) { const keep = S.spec.frame; S.spec.frame = 'stack'; const up = costs(cl.geo).total - cs.unit; S.spec.frame = keep;
      cs.stackUp = up; cs.n2 = cs.n * ns; cs.stairs = (ns - 1) * Math.ceil(cs.n / 3) * 3500; cs.total2 = (cs.unit + up) * cs.n2 - cs.save + cs.stairs; }
    h += `<div class="cl-view" id="clView">${clusterSVG(S, cl)}</div>`;
    h += `<p><button class="btn" data-act="clbig">View large</button></p>`;
    h += `<table class="ptable"><tr><td>Homes</td><td>${cs.n}${cs.n < n ? ` (only ${cs.n} fit snugly)` : ''}</td></tr><tr><td>Total floor area</td><td>${cs.area.toFixed(1)} m²</td></tr><tr><td>Site needed, at least</td><td>${cs.site.toFixed(0)} m²</td></tr><tr><td>Walls touching a neighbour</td><td>${cs.shared.toFixed(1)} m</td></tr><tr><td>Price per home</td><td>${money(cs.unit)}</td></tr><tr><td>Shared crane and crew</td><td>−${money(cs.save)}</td></tr><tr><td><b>All ${cs.n} homes</b></td><td><b>${money(cs.total)}</b></td></tr></table>`;
    if (ns > 1) h += `<table class="ptable"><tr><td>Storeys</td><td>${ns}</td></tr><tr><td>Homes in total</td><td>${cs.n2}</td></tr><tr><td>Floor area</td><td>${(cs.area * ns).toFixed(0)} m²</td></tr><tr><td>Stackable frame, per home</td><td>+${money(cs.stackUp)}</td></tr><tr><td>Outside stairs and walkways</td><td>${money(cs.stairs)}</td></tr><tr><td><b>All ${cs.n2} homes</b></td><td><b>${money(cs.total2)}</b></td></tr></table><p class="note">Upper homes need the stackable 4-storey frame, outside stairs and walkways, and a structural engineer’s check for the foundations.</p>`;
    h += `<p class="note">Uses your current design. Each home keeps its own walls, so homes can be sold, moved or added later. Touching walls cut wind and heat loss.</p>`;
  }
  if (t === 'layouts') {
    h += `<h2>Start from a layout</h2><p class="lead">Every layout is complete and fully editable. Pick one, then change anything.</p>`;
    if (!G.thumbs) { const c = loadThumbCache(); if (c) G.thumbs = c; else { G.thumbs = []; setTimeout(buildThumbsStep, 60); } }
    let idx = 0;
    PRESET_GROUPS.forEach(gr => {
      h += `<h3>${esc(gr.title)}</h3><p class="note" style="margin:-4px 0 8px">${esc(gr.note)}</p><div class="layouts">`;
      gr.items.forEach(p => { const i = idx++; h += `<button class="lay" data-preset="${i}" id="lay-${i}">${layCard(i)}</button>`; });
      h += `</div>`;
    });
    h += `<h3>Better arrangements for your shape</h3><p class="note">Tries every placement of the bathroom, bed, kitchen and door on your current outline. Each result is a complete plan, ranked by bed privacy, clear walkways, short pipes, daylight, sun, open floor and cost.</p>`;
    if (G.varRun) h += `<div class="box"><span id="varProg">Checking ${G.varRun.i} of ${G.varRun.n} arrangements…</span><div class="prog"><i id="varBar" style="width:${G.varRun.i / Math.max(1, G.varRun.n) * 100}%"></i></div></div>`;
    else h += `<button class="btn primary" data-act="variants">${G.variants ? 'Search again' : 'Find better arrangements'}</button>`;
    if (G.variantsCurrent && G.variants) h += `<p class="note" style="margin-top:8px">Your plan before the search scored ${dispScore(G.variantsCurrent.sc)}.</p>`;
    if (G.variants && G.variants.length) {
      const base = G.variantsCurrent ? G.variantsCurrent.cost : 0;
      h += `<div class="vlist">${G.variants.map((v, i) => { const dc = v.ev.cost - base;
        return `<button class="vcard" data-variant="${i}"><div class="vthumb">${v.svg}</div><div><div class="vtop">${v.tag ? `<span class="vtag">${v.tag}</span>` : ''}<span class="vscore">Score ${dispScore(v.ev.sc)}</span></div>
        <div class="nm">${esc(v.name)}</div><div class="sub">${money(v.ev.cost)}${base ? ` (${dc >= 0 ? '+' : '−'}${money(Math.abs(dc))})` : ''}, ${v.ev.freeFloor.toFixed(1)} m² open floor</div>
        <ul class="why">${v.ev.why.slice(0, 4).map(w => `<li>${esc(w)}</li>`).join('')}${v.ev.warn.slice(0, 2).map(w => `<li class="wn">${esc(w)}</li>`).join('')}</ul></div></button>`; }).join('')}</div>`;
    }
  }
  if (t === 'shape') {
    const tr = trucksFor(G.geo), lim = S.site.limit || 0;
    h += `<h2>Shape and modules</h2><p class="lead">A central module with up to two wings. A wing can be one piece or split into two smaller modules, straight or on a diagonal, like your 3.3 m² and 4.05 m² pieces. Sizes are to the outside of the walls.</p>`;
    h += `<div class="box"><b>${G.geo.area.toFixed(1)} m²</b> in ${G.geo.mods.length} module${G.geo.mods.length > 1 ? 's' : ''}, ${tr.n} truck${tr.n > 1 ? 's' : ''}${tr.wide ? ', central module needs a wide-load permit' : ''}.${lim && G.geo.area > lim ? `<br><span style="color:var(--warn)">Over the ${lim} m² limit.</span> <button class="btn small" data-act="fit25">Shrink to fit</button>` : ''}</div>`;
    h += sel('Area limit', 'site.limit', [[25, '25 m², microhome size'], [30, '30 m²'], [40, '40 m²'], [0, 'No limit']]);
    h += `<p style="display:flex; gap:6px; flex-wrap:wrap"><button class="btn small" data-act="mirrorX">Flip left and right</button><button class="btn small" data-act="mirrorY">Flip top and bottom</button></p>`;
    h += `<h3>Central module</h3>`;
    h += rng('Width', 'shape.Wc', 2000, 3000, 50, ' mm');
    h += `<p class="note">Up to 2,550 mm travels on a normal truck without a permit.</p>`;
    h += rng('Length', 'shape.L', 3600, 6600, 100, ' mm');
    ['left', 'right'].forEach(sd => {
      const w = S.shape[sd], L = S.shape.L;
      h += `<div class="wing ${w.on ? '' : 'off'}"><h3 style="margin-top:0">${sd === 'left' ? 'Left' : 'Right'} wing</h3>${chk('Include this wing', `shape.${sd}.on`)}`;
      h += `<p class="note">Quick shapes</p><div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:6px">${WING_Q.map((q, i) => `<button class="btn small" data-wingq="${sd}:${i}">${q.l}</button>`).join('')}</div>`;
      if (w.on) {
        h += rng('Width', `shape.${sd}.w`, 900, 3000, 50, ' mm');
        h += `<p class="note">Positions are measured from the top of the central module. The inner side touches the central module, the outer side is the outside wall. Different values make slanted ends.</p>`;
        h += rng('Inner side starts', `shape.${sd}.inTop`, -2000, L - 600, 100, ' mm');
        h += rng('Inner side ends', `shape.${sd}.inBot`, 600, L + 2000, 100, ' mm');
        h += rng('Outer side starts', `shape.${sd}.outTop`, -2000, L - 600, 100, ' mm');
        h += rng('Outer side ends', `shape.${sd}.outBot`, 600, L + 2000, 100, ' mm');
        h += `<div class="field stack"><label>Split into two modules</label>${seg(`shape.${sd}.split.type`, [['none', 'No'], ['straight', 'Straight'], ['diag', 'Diagonal']])}</div>`;
        if (w.split.type === 'straight') h += rng('Split at', `shape.${sd}.split.a`, 600, L, 100, ' mm');
        if (w.split.type === 'diag') { h += rng('Split, inner side at', `shape.${sd}.split.a`, 0, L, 100, ' mm'); h += rng('Split, outer side at', `shape.${sd}.split.b`, 0, L, 100, ' mm'); }
      }
      h += `</div>`;
    });
    h += `<button class="btn primary" data-act="auto-all">Re-plan inside for this shape</button>`;
    h += `<h3>Getting in</h3>`;
    h += sel('Entry', 'site.entry', [['steps', 'Steps'], ['ramp', 'Ramp, step-free'], ['lift', 'Platform lift, step-free']]);
    h += rng('Floor height above ground', 'site.rise', 300, 900, 50, ' mm');
    if (S.site.entry === 'ramp') h += `<p class="note">A 1:12 ramp needs about ${(rampLen() / 1000).toFixed(1)} m including landings. Lower screw piles shorten it.</p>`;
    h += `<h3>Sun and orientation</h3><p class="note">Point the big glass toward the sun for free winter heat and better solar panels.</p>`;
    h += rng('Turn from north', 'site.north', 0, 355, 5, '°', v => `${v}°, plan top faces ${DIRS[Math.round(((v % 360) + 360) % 360 / 45) % 8]}`);
    h += `<div class="field stack"><label>Quick set: plan top faces</label><div class="seg">${[[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']].map(([v, l]) => `<button data-set="site.north" data-val="${v}" aria-pressed="${+S.site.north === v}">${l}</button>`).join('')}</div></div>`;
    h += `<p class="note">You can also drag the compass on the plan, or tap it to turn 45°.</p>`;
    h += `<div class="field stack"><label>Site is in the</label>${seg('site.hemi', [['N', 'North half'], ['S', 'South half']])}</div>`;
    h += `<h3>Modules for transport</h3><ul class="olist">${G.geo.mods.map(m => { const xs = m.poly.map(p => p[0]), ys = m.poly.map(p => p[1]); const a = Math.max(...xs) - Math.min(...xs), b = Math.max(...ys) - Math.min(...ys);
      return `<li><span class="grow">${esc(m.name)}</span><span>${(Math.max(a, b)/1000).toFixed(2)} × ${(Math.min(a, b)/1000).toFixed(2)} m, ${(polyArea(m.poly)/1e6).toFixed(2)} m²</span></li>`; }).join('')}</ul>`;
  }
  if (t === 'openings') {
    const br = bracing(G.geo);
    h += `<h2>Doors and windows</h2><p class="lead">Add one, then drag it along any outside wall. Keep at least two solid walls each way, they hold the steel bracing.</p>`;
    h += `<div class="box">Solid walls: <b>${br.x}</b> across, <b>${br.y}</b> along ${br.x >= 2 && br.y >= 2 ? '<span style="color:var(--ok)">enough</span>' : '<span style="color:var(--warn)">too few, remove a window</span>'}</div>`;
    h += `<div class="catalog">${Object.keys(OPN).map(k => `<button class="cat-item" data-addop="${k}">${opIcon(k)}<div><div class="nm">${OPN[k].label}</div><div class="pr">${OPN[k].w} × ${OPN[k].h}</div></div></button>`).join('')}</div>`;
    h += `<h3>In this design</h3>`;
    h += S.openings.length ? `<ul class="olist">${S.openings.map(o => `<li><span class="grow">${OPN[o.type].label}, ${o.w} mm</span><span class="note">${money(opCost(o))}</span><button class="btn small" data-selop="${o.id}">Select</button></li>`).join('')}</ul>` : `<p class="note">No doors or windows yet. Add an entry door first.</p>`;
    h += `<p style="margin-top:12px"><button class="btn" data-act="auto-ops">Re-plan doors and windows</button></p>`;
    h += `<h3>Roof windows</h3><p class="note">Fit between roof joists, no steel cut. Good over the bed or the bathroom.</p><button class="btn" data-add="skylight">Add roof window</button>`;
  }
  if (t === 'furnish') {
    const pr = S.program;
    h += `<h2>Furnish</h2><p class="lead">Tell it what you need and it arranges everything. Lock pieces you like, then arrange again.</p>`;
    h += `<div class="box">${chk('Wheelchair accessible: wide doors, 80 cm paths, roll-in shower, grab bars, knee-space basin and kitchen', 'program.access')}${chk('Second door: links another module, or adds a back exit', 'program.secondExit')}</div>`;
    if (pr.access && S.site.entry === 'steps') h += `<p class="note" style="color:var(--warn)">Add a ramp or lift under Shape, Getting in, for step-free entry.</p>`;
    h += `<div class="field stack"><label>Living style</label>${seg('program.style', [['standard', 'Standard'], ['japanese', 'Japanese'], ['korean', 'Korean']])}</div>`;
    h += `<p class="note">${({standard:'Bed, wardrobe, sofa and dining table.', japanese:'Tatami platform bed with drawers, oshiire futon closet, kotatsu table with floor chairs, ofuro soaking tub.', korean:'Bed, jang chest, folding low table (bapsang). Try ondol floor heating in Energy and water.'})[pr.style || 'standard']}</p>`;
    { const r2 = readyForTwo(), ok = r2.filter(x => x.ok).length, st = storageLitres();
      h += `<h3>Ready for two people <span class="note">${ok} of ${r2.length}</span></h3>`;
      h += gauge('Storage for two', st, STORE_TARGET, `${st.toLocaleString('en-US')} of ${STORE_TARGET.toLocaleString('en-US')} L`);
      h += `<ul class="olist ready">${r2.map(x => `<li><span class="rk ${x.ok ? 'ok' : 'no'}">${x.ok ? '✓' : '•'}</span><span class="grow">${esc(x.k)}</span>${!x.ok && x.add ? `<button class="btn small" ${x.add === 'storefill' ? 'data-act="storefill"' : `data-add="${x.add}"`}>${x.add === 'storefill' ? 'Fill walls' : 'Add'}</button>` : ''}</li>`).join('')}</ul>`;
      if (r2.some(x => !x.ok)) h += `<p><button class="btn primary" data-act="complete2">Add everything missing</button></p>`; }
    h += `<h3>What to include</h3><div class="box">`;
    h += sel('Bed', 'program.bed', [['bed160', 'Double 160'], ['bed140', 'Bed 140'], ['bed90', 'Single 90'], ['wallbed', 'Wall bed, folds up'], ['none', 'Sofa bed only']]);
    h += sel('Bathing', 'program.bathing', [['shower', 'Shower'], ['bath', 'Bathtub']]);
    h += sel('Toilet', 'program.toilet', [['toilet', 'Dry, no water'], ['wc', 'Flush']]);
    h += sel('Kitchen length', 'program.kitchen', [[1200, '1.2 m compact'], [1800, '1.8 m'], [2400, '2.4 m'], [3000, '3.0 m']]);
    h += sel('Seating', 'program.sofa', [['sofa', 'Sofa'], ['sofabed', 'Sofa bed'], ['none', 'None']]);
    h += chk('Dining or low table', 'program.dining') + chk('Desk for work', 'program.desk') + chk('Wardrobe or closet', 'program.wardrobe') + chk('Shoe cabinet', 'program.getabako') + chk('Pull-out pantry', 'program.pantry') + chk('Recycling bins', 'program.bins') + chk('Cleaning cupboard', 'program.cleaning') + chk('Nightstands', 'program.nightstand') + chk('Divider shelving', 'program.divider') + chk('Extra shelving', 'program.shelf') + chk('Tall fridge-freezer', 'program.fridgeTall') + chk('Washer-dryer', 'program.washer') + chk('Ceiling laundry rack', 'program.dryrack') + chk('Wood stove', 'program.stove');
    h += chk('Fill spare walls with storage', 'program.maxStorage');
    h += `</div>`;
    h += `<h3>Where things go</h3>`;
    h += `<div class="field stack"><label>Bathroom in</label>${seg('hints.bathWing', [['left', 'Left wing'], ['right', 'Right wing'], ['end', 'Across the end']])}</div>`;
    h += `<div class="field stack"><label>Bed at</label>${seg('hints.bedEnd', [['top', 'Top end'], ['bottom', 'Bottom end']])}</div>`;
    h += `<div class="field stack"><label>Kitchen in</label>${seg('hints.kitchenIn', [['wing', 'Other wing'], ['bathwing', 'Bath wing, other part'], ['central', 'Main room']])}</div>`;
    h += `<div class="field stack"><label>Entry door</label>${seg('hints.doorAt', [['auto', 'Best spot'], ['end', 'End wall'], ['side', 'Side wall']])}</div>`;
    h += `<p class="note">“Bath wing, other part” needs a wing split into two modules: the bathroom takes one part, the kitchen the other.</p>`;
    h += `<p style="display:flex; gap:6px; flex-wrap:wrap"><button class="btn primary" data-act="auto-furn">Arrange furniture</button><button class="btn" data-act="auto-all">Re-plan everything</button></p>`;
    const groups = {}; Object.keys(CAT).filter(k => CAT[k].grp !== 'Build' || k === 'partition').forEach(k => (groups[CAT[k].grp] = groups[CAT[k].grp] || []).push(k));
    Object.keys(groups).forEach(g => {
      h += `<h3>${({Sleep:'Sleeping', Living:'Living', Storage:'Storage', Kitchen:'Kitchen', Bath:'Bathroom', Tech:'Technical', Build:'Inside walls'})[g] || g}</h3><div class="catalog">${groups[g].map(k => `<button class="cat-item" data-add="${k}">${itemIcon(k)}<div><div class="nm">${CAT[k].label}</div><div class="pr">${money(itemCost(newItem(k, k === 'kitchen' ? {w:S.program.kitchen} : {})))}</div></div></button>`).join('')}</div>`;
    });
  }
  if (t === 'systems') {
    const og = offgrid();
    h += `<h2>Energy and water</h2><p class="lead">Size the off-grid systems. The checks below compare what you use with what the roof and batteries give.</p>`;
    h += rng('Solar panels', 'sys.pv', 0, 6.3, .45, '', v => `${v} kWp, ${Math.round(v / .45)} panels`);
    h += rng('Battery', 'sys.batt', 0, 25, 2.5, ' kWh');
    h += rng('People', 'sys.people', 1, 4, 1, '');
    h += rng('Sun, average hours a day', 'sys.sun', 1.5, 7, .5, ' h');
    h += gauge(og.wind ? 'Solar and wind against daily use' : 'Solar against daily use', og.pv, og.kwh, `${og.pv.toFixed(1)} of ${og.kwh.toFixed(1)} kWh a day${og.wind ? `, ${og.wind.toFixed(1)} from wind` : ''}`);
    h += gauge('Days on battery alone', og.days, 2, `${og.days.toFixed(1)} days, aim for 2`);
    if (og.winter) h += `<p class="note">Winter heating adds about ${og.winter.toFixed(1)} kWh a day${(S.spec.ideas || {}).quadcore ? ', already 30% less with QuadCore panels' : ''}. Plan a backup, such as a wood stove, for long cloudy spells.</p>`;
    h += `<h3>Water</h3>`;
    h += chk('Water tank under the bed', 'sys.tank');
    if (S.sys.tank) h += rng('Tank size', 'sys.tankL', 300, 1200, 50, ' L');
    h += rng('Buried rain cistern', 'sys.cisternL', 0, 8000, 500, ' L');
    h += rng('Rain a year', 'sys.rain', 100, 2000, 50, ' mm');
    h += gauge('Rain from the roof against use', og.rainDay, og.water, `${Math.round(og.rainDay)} of ${Math.round(og.water)} L a day`);
    h += gauge('Days of stored water', og.wdays, 21, `${og.wdays.toFixed(0)} days, aim for 3 weeks`);
    h += chk('Greywater reed planter', 'sys.grey');
    h += `<h3>Heating and air</h3>`;
    h += sel('Heating', 'sys.heating', [['heatpump', 'Air-to-air heat pump'], ['ondol', 'Ondol electric floor heating'], ['none', 'None, or wood stove only']]);
    if (S.sys.heating === 'ondol') h += `<p class="note">Ondol floor heating is very comfortable but uses about 5.5 kWh a day in winter, more solar and battery than a heat pump.</p>`;
    h += sel('Hot water', 'sys.heater', [['el', 'Electric 50 L'], ['inst', 'Instant, smaller'], ['solar', 'Solar thermal']]);
    h += rng('Fresh-air units with heat recovery', 'sys.mvhr', 0, 4, 1, '');
  }
  if (t === 'finishes') {
    h += `<h2>Finishes</h2><p class="lead">Pick a level, or set each part. The cheapest set still keeps the house warm and dry.</p>`;
    h += `<p style="display:flex; gap:6px; flex-wrap:wrap"><button class="btn" data-spec="eco">Lowest cost</button><button class="btn" data-spec="std">Balanced</button><button class="btn" data-spec="lux">Comfort</button></p>`;
    h += sel('Roof shape', 'shape.roof', [['flat', 'Flat, tapered insulation'], ['gable', 'Gable, steel trusses (as in our render)']]);
    h += sel('Wall thickness', 'shape.wallT', [['200', '200 mm'], ['250', '250 mm, warmer (as in the two-module design)']]);
    h += sel('Steel frame', 'spec.frame', [['light', 'Single storey, lighter steel'], ['stack', 'Stackable to 4 storeys']]);
    h += sel('Glazing', 'spec.glazing', [['double', 'Double, lower cost'], ['triple', 'Triple, warmer']]);
    h += sel('Outside cladding', 'spec.cladding', [['steel', 'Steel sheet, lowest cost'], ['fibre', 'Fibre-cement'], ['timber', 'Timber boards']]);
    h += sel('Wall insulation', 'spec.insul', [['std', '100 + 50 mm rockwool'], ['eco', '100 mm rockwool only']]);
    h += sel('Floor', 'spec.finish', [['ply', 'Oiled plywood'], ['vinyl', 'Vinyl'], ['lino', 'Linoleum']]);
    if (S.spec.insul === 'eco') h += `<p class="note">Without the outer 50 mm layer, the steel studs leak heat and walls lose about twice as much. For an off-grid home this costs more in batteries and panels than it saves.</p>`;
  }
  if (t === 'prices') {
    h += `<h2>Prices</h2><p class="lead">Defaults are factory-direct prices, buying straight from manufacturers in China and assembling with a small crew. Put in your own quotes, or pick a price level. Everything is entered in US dollars and shown in your currency.</p>`;
    h += `<div class="field stack"><label>Price level</label><div class="seg"><button data-plevel="1">Factory-direct</button><button data-plevel="1.5">Local mid-range</button><button data-plevel="2.3">Europe or US retail</button></div></div>`;
    h += sel('Show prices in', 'site.cur', Object.keys(CUR).map(k => [k, k]));
    h += `<div class="field wide"><label>Rate, 1 USD =</label><input type="number" step="0.01" value="${S.site.rate || CUR[S.site.cur].r}" data-bind="site.rate" data-num="1"></div>`;
    h += rng('Distance from factory to site', 'site.km', 0, 2000, 10, ' km');
    h += `<h3>Building</h3><table class="ptable">${Object.keys(PRICE_DEF).map(k => `<tr><td>${PRICE_DEF[k].l}</td><td><input type="number" step="any" value="${S.prices[k]}" data-bind="prices.${k}" data-num="1" aria-label="${esc(PRICE_DEF[k].l)}"></td></tr>`).join('')}</table>`;
    h += `<h3>Furniture and fittings</h3><table class="ptable">${Object.keys(CAT).filter(k => !['kitchen', 'partition', 'skylight'].includes(k)).map(k => `<tr><td>${CAT[k].label}</td><td><input type="number" step="any" value="${S.iprices[k]}" data-bind="iprices.${k}" data-num="1" aria-label="${esc(CAT[k].label)}"></td></tr>`).join('')}</table>`;
    h += `<p><button class="btn" data-act="reset-prices">Reset all prices</button></p>`;
  }
  p.innerHTML = h;
  if (fresh && !RM) { p.classList.remove('anim'); void p.offsetWidth; p.classList.add('anim'); }
}
function gauge(label, v, target, txt) { const pc = Math.min(100, v / Math.max(target, .01) * 100); return `<div class="gauge ${v < target ? 'low' : ''}"><div class="lbl"><span>${label}</span><span>${txt}</span></div><div class="t"><i style="width:${pc}%"></i></div></div>`; }
function itemIcon(k) {
  const c = CAT[k]; const s = 30 / Math.max(c.w, c.d) * .9; const it = newItem(k);
  return `<svg viewBox="${-15 / s} ${-15 / s} ${30 / s} ${30 / s}" aria-hidden="true">${itemMarkup(it, {mini:true})}</svg>`;
}
function opIcon(k) { const kd = OPN[k].kind;
  return `<svg viewBox="0 0 30 30" aria-hidden="true"><rect x="2" y="12" width="26" height="6" fill="var(--wall)"/><rect x="${kd === 'slide' ? 4 : 9}" y="12" width="${kd === 'slide' ? 22 : 12}" height="6" fill="var(--floor)"/>${kd === 'door' ? '<path d="M9 12V2a10 10 0 0 1 12 10" fill="none" stroke="var(--ink)" stroke-width="1.2"/>' : '<line x1="5" y1="14" x2="25" y2="14" stroke="var(--glass)" stroke-width="1.5"/><line x1="5" y1="16" x2="25" y2="16" stroke="var(--glass)" stroke-width="1.5"/>'}</svg>`; }

function onBind(el) {
  const path = el.dataset.bind; let v;
  if (el.type === 'checkbox') v = el.checked; else if (el.dataset.num) v = Number(el.value); else v = el.value;
  if (el.tagName === 'SELECT' && /^\d+$/.test(v)) v = Number(v);
  if (path === 'site.rate' && !(v > 0)) v = null;
  snapshot(); set(S, path, v);
  if (path === 'program.secondExit') {
    const dT = S.program.access ? 'door_wide' : 'door';
    if (v) {
      const d = S.hints.extraDoor, geo = G.geo; let e = d && geo.ext.filter(x => (x.mod === d.mod || x.mod.startsWith(d.mod)) && dot(mul(x.n, -1), d.out) > .9).sort((a, b) => b.len - a.len)[0];
      if (e) { const ax = Math.abs(d.out[0]) > .5 ? 1 : 0, w = OPN[dT].w; const o = newOpening(dT, e.key, clamp((e.u[ax] >= 0 ? d.at : 1 - d.at) * e.len, w / 2 + 150, e.len - w / 2 - 150), {link:true}); S.openings.push(o);
        const g2 = buildGeo(S.shape), v2 = validate(g2);
        if (Object.values(v2.items).some(x => x.length)) { autoArrange('furn'); toast('Second door added where another module can join. Furniture re-arranged around it.'); }
        else toast('Second door added where another module can join'); }
      else { commit(true); addOpening(dT); const o = S.openings[S.openings.length - 1]; if (o) o.link = true; return; }
    } else {
      const doors = S.openings.filter(o => OPN[o.type].kind === 'door');
      const rm = doors.filter(o => o.link); if (!rm.length && doors.length > 1) rm.push(doors[doors.length - 1]);
      S.openings = S.openings.filter(o => !rm.includes(o)); if (rm.length) toast('Second door removed');
    }
  }
  if (path === 'site.cur') S.site.rate = null;
  if (path.startsWith('shape.')) normShape();
  commit(true);
}
const WING_Q = [
  {l:'None'},
  {l:'Full 8.1 m²', f:L => ({on:true, inTop:0, inBot:L, outTop:0, outBot:L, split:{type:'none', a:L/2, b:L/2}})},
  {l:'Full, slanted top', f:L => ({on:true, inTop:0, inBot:L, outTop:1000, outBot:L, split:{type:'none', a:L/2, b:L/2}})},
  {l:'Full, slanted bottom', f:L => ({on:true, inTop:0, inBot:L, outTop:0, outBot:L - 1000, split:{type:'none', a:L/2, b:L/2}})},
  {l:'Short slanted top 4.05', f:L => ({on:true, inTop:0, inBot:3200, outTop:0, outBot:2200, split:{type:'none', a:1600, b:1600}})},
  {l:'Short slanted bottom 4.05', f:L => ({on:true, inTop:L - 3200, inBot:L, outTop:L - 2200, outBot:L, split:{type:'none', a:L - 1600, b:L - 1600}})},
  {l:'3.3 + 4.05', f:L => ({on:true, inTop:0, inBot:L, outTop:0, outBot:L - 1000, split:{type:'straight', a:2200, b:2200}})},
  {l:'Two 3.3', f:L => ({on:true, inTop:0, inBot:4400, outTop:0, outBot:4400, split:{type:'straight', a:2200, b:2200}})},
  {l:'Two 4.05', f:L => ({on:true, inTop:0, inBot:L, outTop:0, outBot:L, split:{type:'straight', a:L/2, b:L/2}})},
  {l:'Diagonal split', f:L => ({on:true, inTop:0, inBot:L, outTop:0, outBot:L, split:{type:'diag', a:2200, b:3200}})},
];
function normShape() {
  const sh = S.shape; sh.L = clamp(sh.L, 3600, 6600); sh.Wc = clamp(sh.Wc, 2000, 3000); sh.wallT = +sh.wallT || 200;
  ['left', 'right'].forEach(k => { const w = sh[k]; w.w = clamp(w.w, 900, 3000);
    w.split = w.split || {type:'none', a:2200, b:3200};
    w.inTop = clamp(w.inTop, -2000, sh.L - 600); w.inBot = clamp(w.inBot, w.inTop + 600, sh.L + 2000);
    if (Math.min(w.inBot, sh.L) - Math.max(w.inTop, 0) < 600) { w.inTop = Math.min(w.inTop, sh.L - 600); w.inBot = Math.max(w.inBot, w.inTop + 600); }
    w.outTop = clamp(w.outTop, w.inTop - 1500, w.inBot - 600); w.outBot = clamp(w.outBot, w.outTop + 600, w.inBot + 1500);
    w.split.a = clamp(w.split.a, Math.min(w.inTop, w.outTop) + 300, Math.max(w.inBot, w.outBot) - 300);
    w.split.b = clamp(w.split.b ?? w.split.a, Math.min(w.inTop, w.outTop) + 300, Math.max(w.inBot, w.outBot) - 300); });
}
function convWing(w, L) {
  if (w.inTop != null) { w.split = w.split || {type:'none', a:2200, b:3200}; return w; }
  const s = w.straight ?? 2200, a = w.angle ?? 0;
  return w.anchor === 'bottom' ? {on:w.on, w:w.w, inTop:L - s - a, inBot:L, outTop:L - s, outBot:L, split:{type:'none', a:2200, b:3200}}
                              : {on:w.on, w:w.w, inTop:0, inBot:s + a, outTop:0, outBot:s, split:{type:'none', a:2200, b:3200}};
}
function fit25() {
  const lim = S.site.limit || 25; let guard = 0; const sh = S.shape;
  while (buildGeo(sh).area > lim && guard++ < 300) {
    const ws = ['left', 'right'].map(k => sh[k]).filter(w => w.on && Math.max(w.inBot, w.outBot) - Math.min(w.inTop, w.outTop) > 1800);
    if (ws.length && guard % 3) { const w = ws.sort((a, b) => (b.inBot - b.inTop) - (a.inBot - a.inTop))[0]; w.inBot -= 100; w.outBot -= 100; }
    else sh.L -= 100;
    normShape();
  }
}
/* mirror the whole design */
function mirror(axis) {
  const geo0 = buildGeo(S.shape), Wt = geo0.bbox[2], L = S.shape.L;
  // remember openings by world position
  const ops = S.openings.map(o => { const f = opFrame(geo0, o); return f ? {o, p:mul(add(f.a, f.b), .5)} : null; }).filter(Boolean);
  const sh = S.shape;
  if (axis === 'x') { const t = sh.left; sh.left = sh.right; sh.right = t; if (S.hints.bathWing !== 'end') S.hints.bathWing = S.hints.bathWing === 'left' ? 'right' : 'left'; }
  else {
    ['left', 'right'].forEach(k => { const w = sh[k], it = w.inTop, ib = w.inBot, ot = w.outTop, ob = w.outBot;
      w.inTop = L - ib; w.inBot = L - it; w.outTop = L - ob; w.outBot = L - ot;
      if (w.split) { w.split.a = L - w.split.a; w.split.b = L - (w.split.b ?? w.split.a); } });
    S.hints.bedEnd = S.hints.bedEnd === 'top' ? 'bottom' : 'top';
  }
  const geo = buildGeo(sh), W2 = geo.bbox[2];
  const mp = p => axis === 'x' ? [W2 - p[0] + (W2 - Wt) * 0, p[1]] : [p[0], L - p[1]];
  S.items.forEach(it => { const q = axis === 'x' ? [Wt - it.x, it.y] : [it.x, L - it.y]; it.x = q[0]; it.y = q[1];
    it.rot = axis === 'x' ? ((-it.rot) % 360 + 360) % 360 : ((180 - it.rot) % 360 + 360) % 360;
    if (it.opt) { if (it.opt.sink != null) it.opt.sink = 1 - it.opt.sink; if (it.opt.cook != null) it.opt.cook = 1 - it.opt.cook; if (it.opt.dpos != null) it.opt.dpos = 1 - it.opt.dpos; } });
  S.openings = ops.map(({o, p}) => { const q = axis === 'x' ? [Wt - p[0], p[1]] : [p[0], L - p[1]];
    let best = null; geo.ext.forEach(e => { const t = dot(sub(q, e.a), e.u), r = add(e.a, mul(e.u, clamp(t, 0, e.len))), d = Math.hypot(q[0] - r[0], q[1] - r[1]); if (!best || d < best.d) best = {d, e, t}; });
    if (!best || best.d > 60) return null; o.edge = best.e.key; o.s = Math.round(best.t); o.hinge = o.hinge === 'R' ? 'L' : 'R'; return o; }).filter(Boolean);
}
function initPanel() {
  $('#rail').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; const was = G.tab; G.tab = b.dataset.tab; renderRail(); renderPanel(); $('#panel').scrollTop = 0; if (was === 'shape' || G.tab === 'shape') renderPlan(); });
  const panel = $('#panel');
  panel.addEventListener('input', e => { const el = e.target; if (el.type === 'range' && el.dataset.bind) { const s = el.parentElement.querySelector('.lbl span'); const num = el.parentElement.querySelector('input[type=number]'); if (num) num.value = el.value; } });
  panel.addEventListener('change', e => { if (e.target.dataset.bind) onBind(e.target); });
  panel.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.set === 'program.style') { snapshot(); S.program.style = b.dataset.val; const f = autoArrange('furn'); G.motion = true; commit(true); toast(({standard:'Standard style', japanese:'Japanese style', korean:'Korean style'})[b.dataset.val] + (f.length ? '. No room for: ' + f.map(t => CAT[t] ? CAT[t].label.toLowerCase() : t).join(', ') : ', everything placed')); return; }
    if (b.dataset.set) { snapshot(); set(S, b.dataset.set, b.dataset.set === 'site.north' ? +b.dataset.val : b.dataset.val); if (b.dataset.set.startsWith('shape.')) normShape(); commit(true); return; }
    if (b.dataset.preset) { snapshot(); const th = G.thumbs && G.thumbs[+b.dataset.preset]; let f;
      if (th && th.state) { const st = JSON.parse(JSON.stringify(th.state)); const sp = st.siteP || PRESETS[+b.dataset.preset].site; delete st.siteP; Object.assign(S, st); if (sp) Object.assign(S.site, sp); S.unplaced = []; f = []; } else f = applyPreset(PRESETS[+b.dataset.preset]);
      G.sel = null; G.variants = null; G.motion = true; commit(true); const tv = G.view; G.view = null; fitView(); const to = G.view; G.view = tv; animateView(to); reset3D(); if (isPhone()) setTimeout(() => switchView('plan'), 30); const lim = S.site.limit || 0; toast(lim && G.geo.area > lim + 1e-4 ? `This one is ${G.geo.area.toFixed(1)} m², over your ${lim} m² limit. Change the limit in Shape.` : f.length ? 'Some items did not fit: ' + f.map(t => CAT[t] ? CAT[t].label.toLowerCase() : t).join(', ') : 'Layout applied'); return; }
    if (b.dataset.variant) { snapshot(); S = JSON.parse(JSON.stringify(G.variants[+b.dataset.variant].st)); G.sel = null; G.motion = true; commit(true); reset3D(); toast('Arrangement applied. Undo brings back your plan.'); if (isPhone()) switchView('plan'); return; }
    if (b.dataset.wingq) { const [sd, i] = b.dataset.wingq.split(':'); snapshot(); const q = WING_Q[+i]; const L = S.shape.L;
      S.shape[sd] = q.f ? Object.assign(q.f(L), {w:S.shape[sd].w}) : Object.assign(S.shape[sd], {on:false}); normShape(); commit(true); toast('Wing changed. Re-plan inside if things no longer fit.'); return; }
    if (b.dataset.add) { addItem(b.dataset.add); return; }
    if (b.dataset.addop) { addOpening(b.dataset.addop); return; }
    if (b.dataset.selop) { select({kind:'op', id:b.dataset.selop}); return; }
    if (b.dataset.idea) { toggleIdea(b.dataset.idea); renderPanel(); return; }
    if (b.dataset.st) { G.storeys = +b.dataset.st; renderPanel(); return; }
    if (b.dataset.cl) { G.clusterN = +b.dataset.cl; renderPanel(); return; }
    if (b.dataset.act === 'clbig') { const d = $('#dlg'); d.innerHTML = `<h3>${G.cluster.homes.length} homes interlocked</h3><div class="cl-view big">${clusterSVG(S, G.cluster)}</div><p><button class="btn primary" data-d="close">Close</button></p>`; if (!d.open) d.showModal(); return; }
    if (b.dataset.plevel) { snapshot(); const k = +b.dataset.plevel, d = defaultState(); Object.keys(d.prices).forEach(p => S.prices[p] = p === 'contingency' ? d.prices[p] : Math.round(d.prices[p] * k * 100) / 100); Object.keys(d.iprices).forEach(p => S.iprices[p] = Math.round(d.iprices[p] * k)); commit(true); toast('Prices set to ' + b.textContent.toLowerCase()); return; }
    if (b.dataset.spec) { snapshot(); S.spec = Object.assign({}, S.spec, ({eco:{glazing:'double', cladding:'steel', insul:'std', finish:'ply', frame:'light'}, std:{glazing:'double', cladding:'fibre', insul:'std', finish:'vinyl'}, lux:{glazing:'triple', cladding:'timber', insul:'std', finish:'lino'}})[b.dataset.spec]); commit(true); return; }
    const a = b.dataset.act;
    if (a === 'auto-all' || a === 'auto-furn') { snapshot(); const f = autoArrange(a === 'auto-all' ? 'all' : 'furn'); G.sel = null; G.motion = true; commit(true); toast(f.length ? 'Could not fit: ' + f.map(t => CAT[t] ? CAT[t].label.toLowerCase() : t).join(', ') + '. Try a smaller size or another arrangement.' : 'Arranged'); }
    if (a === 'auto-ops') { snapshot(); autoOpenings(G.geo); commit(true); toast('Doors and windows re-planned'); }
    if (a === 'variants') startVariants();
    if (a === 'fit25') { snapshot(); fit25(); commit(true); }
    if (a === 'complete2') { snapshot(); completeForTwo(); }
    if (a === 'storefill') { snapshot(); const n = fillStorage(G.geo); G.motion = true; commit(true); toast(n ? `Added ${n} storage piece${n > 1 ? 's' : ''}` : 'No free wall left for more storage'); }
    if (a === 'mirrorX' || a === 'mirrorY') { snapshot(); mirror(a === 'mirrorX' ? 'x' : 'y'); G.view = null; G.motion = true; commit(true); fitView(); renderPlan(); reset3D(); toast('Flipped'); }
    if (a === 'reset-prices') { snapshot(); const d = defaultState(); S.prices = d.prices; S.iprices = d.iprices; commit(true); toast('Prices reset'); }
  });
}
function fit25() {
  let guard = 0; const sh = S.shape;
  while (buildGeo(sh).area > 25 && guard++ < 200) {
    const w = (sh.right.on && sh.right.straight > 1200) ? sh.right : (sh.left.on && sh.left.straight > 1200 ? sh.left : null);
    if (w && (guard % 2 === 0 || !sh.left.on || !sh.right.on)) w.straight -= 100; else sh.L -= 100;
  }
}
function layCard(i) {
  const th = G.thumbs && G.thumbs[i], p = PRESETS[i];
  if (!th) return `<div class="skel"></div><div class="nm">${esc(p.name)}</div><div class="sub">Drawing…</div>`;
  const lim = S.site.limit || 0;
  if (th.cost == null && th.state) { const keepS = S; S = Object.assign({}, th.state, {prices:keepS.prices, iprices:keepS.iprices, spec:keepS.spec, sys:keepS.sys, site:Object.assign({}, keepS.site, th.state.siteP || {})}); try { th.cost = costs(buildGeo(S.shape)).total; } finally { S = keepS; } }
  return `${th.svg}<div class="nm">${esc(p.name)}</div><div class="sub">${th.area.toFixed(1)} m²${lim && th.area > lim + 1e-4 ? ' (over limit)' : ''}, ${money(th.cost)}, ${th.mods} module${th.mods > 1 ? 's' : ''}</div>`;
}
const THUMB_KEY = 'mhb-thumbs-v6';
function loadThumbCache() {
  const E = window.__MH_THUMBS; if (E && E.length === PRESETS.length) { return E.map(e => ({svg:miniSVG(e.state), area:e.area, mods:e.mods, state:e.state})); }
  try { const c = JSON.parse(localStorage.getItem(THUMB_KEY) || 'null'); if (c && c.n === PRESETS.length) return c.items; } catch (e) {} return null; }
function buildThumbsStep() {
  const i = G.thumbs.length;
  if (i >= PRESETS.length) { try { localStorage.setItem(THUMB_KEY, JSON.stringify({n:PRESETS.length, items:G.thumbs.map(t => ({svg:t.svg, area:t.area, mods:t.mods, state:t.state}))})); } catch (e) {} return; }
  const keep = JSON.stringify(S);
  try { applyPreset(PRESETS[i]); const g = buildGeo(S.shape); G.thumbs.push({svg:miniSVG(S), area:g.area, cost:costs(g).total, mods:g.mods.length, state:{shape:S.shape, items:S.items, openings:S.openings, hints:S.hints, program:S.program, siteP:PRESETS[i].site || null}}); }
  catch (e) { G.thumbs.push({svg:'', area:0, cost:0, mods:0}); }
  S = JSON.parse(keep); G.geo = buildGeo(S.shape);
  const el = document.getElementById('lay-' + i); if (el) { el.innerHTML = layCard(i); el.classList.add('pop'); }
  (window.requestIdleCallback || setTimeout)(buildThumbsStep, {timeout:200});
}
/* ======================= BETTER ARRANGEMENTS ======================= */
const ESS = ['kitchen', 'bed160', 'bed140', 'bed90', 'tatamibed', 'platformbed', 'wallbed', 'energy', 'shower', 'bath', 'ofuro', 'toilet', 'wc', 'basin', 'sofabed', 'accshower', 'acctoilet', 'accbasin'];
function scoreLayout(st, failed) {
  const keepS = S; S = st;
  const g = buildGeo(st.shape), why = [], warn = [];
  let sc = 0;
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  failed = failed || [];
  failed.forEach(t => sc -= ESS.includes(t) ? 100 : (t === 'sofa' || t === 'wardrobe') ? 30 : 15);
  if (failed.length) warn.push('Leaves out ' + [...new Set(failed.map(t => CAT[t] ? CAT[t].label.toLowerCase() : t))].join(', '));
  (st.swapped || []).forEach(t => { sc -= 8; warn.push(t); });
  const wk = walkCheck(g, st);
  if (wk) { const n = wk.unreachable.length; sc -= n * 30; if (!n) { sc += 12; why.push('Clear walkway from the door to everything'); } else warn.push('Hard to reach: ' + [...new Set(wk.unreachable.map(i => CAT[i.type].label.toLowerCase()))].join(', ')); }
  const dOp = st.openings.find(o => OPN[o.type].kind === 'door'), df = dOp ? opFrame(g, dOp) : null, door = df ? mul(add(df.a, df.b), .5) : null;
  const bed = st.items.find(i => CAT[i.type].zone === 'bed'), kit = st.items.find(i => i.type === 'kitchen');
  const wets = st.items.filter(i => CAT[i.type].zone === 'wet');
  const wins = st.openings.filter(o => OPN[o.type].glass).map(o => { const f = opFrame(g, o); return f ? {p:mul(add(f.a, f.b), .5), a:o.w * o.h} : null; }).filter(Boolean);
  const bigGlass = wins.slice().sort((a, b) => b.a - a.a)[0];
  let bedDoor = 0;
  if (bed && door) { bedDoor = dist([bed.x, bed.y], door); sc += Math.min(bedDoor, 5000) / 1000 * 5;
    if (bedDoor > 3600) why.push('Bed is well away from the entrance'); }
  if (bed && BED_TYPES.includes(bed.type)) { const ex = exitSegments(g, st.openings); if (ex.length) { const dx = bedExitDist(bed, ex); if (dx < BED_EXIT_MIN) { sc -= 60; warn.push('Bed too close to an exit'); } } }
  if (kit && door) { const d = dist([kit.x, kit.y], door); sc -= d / 1000 * 2; if (d < 2300) why.push('Kitchen close to the door for shopping'); }
  if (kit && wets.length) {
    const t = kit.rot * Math.PI / 180, sx = ((kit.opt && kit.opt.sink != null ? kit.opt.sink : .7) - .5) * kit.w, sink = [kit.x + sx * Math.cos(t), kit.y + sx * Math.sin(t)];
    const d = Math.min(...wets.map(w => dist(sink, [w.x, w.y]))); sc -= d / 1000 * 4;
    if (d < 2300) why.push('Kitchen and bathroom back to back, short pipes'); else if (d > 4500) warn.push('Kitchen far from the bathroom, longer pipes');
  }
  const groups = new Set(wets.map(w => grp(modAt(g, w.x, w.y)))); if (groups.size === 1) sc += 4;
  const seat = st.items.find(i => ['sofa', 'sofabed', 'dining', 'foldtable'].includes(i.type));
  if (seat && wins.length) { const d = Math.min(...wins.map(w => dist(w.p, [seat.x, seat.y]))); if (d < 1700) { sc += 4; why.push('Sitting area next to a window'); } }
  if (bed && bigGlass && dist(bigGlass.p, [bed.x, bed.y]) < 2300) { sc += 3; why.push('Bed beside the big window'); }
  const sun = sunCheck(g); if (sun && sun.ok) { sc += 5; why.push('Big glass faces the sun'); }
  const inner = g.zones.reduce((s, z) => s + polyArea(z.poly), 0), foot = st.items.filter(i => !CAT[i.type].overlay && i.type !== 'partition').reduce((s, i) => s + i.w * i.d, 0);
  const freeFloor = Math.max(0, inner - foot) / 1e6; sc += freeFloor * 2;
  const cost = costs(g).total; sc -= cost / 1000 * .4;
  S = keepS;
  return {sc, why, warn, cost, freeFloor, bedDoor};
}
const dispScore = sc => clamp(Math.round(50 + sc * 1.1), 1, 99);
function variantName(h) {
  const b = h.bathWing === 'end' ? 'Bathroom across the end' : `Bathroom in the ${h.bathWing} wing`;
  const k = ({wing:'kitchen in the other wing', central:'kitchen in the main room', bathwing:'kitchen beside the bathroom'})[h.kitchenIn];
  return `${b}, bed at the ${h.bedEnd}, ${k}${h.doorAt === 'side' ? ', door on the side' : ''}`;
}
function variantCombos() {
  const c = [];
  ['left', 'right', 'end'].forEach(bw => ['top', 'bottom'].forEach(be => ['wing', 'central', 'bathwing'].forEach(ki => ['auto', 'side'].forEach(dr => {
    if (bw !== 'end' && !S.shape[bw].on) return;
    if (ki === 'bathwing' && (bw === 'end' || !(S.shape[bw].split && S.shape[bw].split.type !== 'none'))) return;
    if (ki === 'wing' && !S.shape.left.on && !S.shape.right.on) return;
    c.push({bathWing:bw, bedEnd:be, kitchenIn:ki, doorAt:dr});
  }))));
  return c;
}
function startVariants() {
  if (G.varRun) return;
  const base = JSON.stringify(S);
  G.variantsCurrent = scoreLayout(JSON.parse(base), (S.unplaced || []).filter(t => !S.items.some(i => i.type === t)));
  G.variants = null;
  G.varRun = {i:0, combos:variantCombos(), base, seen:new Map()};
  G.varRun.n = G.varRun.combos.length;
  renderPanel(); setTimeout(varStep, 20);
}
function varStep() {
  const R = G.varRun; if (!R) return;
  const cur = JSON.stringify(S), t0 = performance.now();
  const run = (h, bedOverride) => { S = JSON.parse(R.base); S.hints = Object.assign({}, S.hints, h); if (bedOverride) S.program.bed = bedOverride;
    S.items = S.items.filter(i => i.lock); S.openings = []; const f = autoArrange('all'); if (bedOverride) S.swapped = (S.swapped || []).concat(['Wall bed, folds up to save space']); return f; };
  while (R.i < R.n && performance.now() - t0 < 150) {
    const h = R.combos[R.i++];
    let failed = run(h);
    if (failed.some(t => ['bed160', 'bed140', 'bed90', 'tatamibed'].includes(t))) failed = run(h, 'wallbed');
    const st = JSON.parse(JSON.stringify(S)), ev = scoreLayout(st, failed);
    const g = buildGeo(st.shape), cell = it => it ? `${Math.round(it.x / 900)},${Math.round(it.y / 900)}` : '-';
    const sig = [h.bathWing, cell(st.items.find(i => CAT[i.type].zone === 'bed')), cell(st.items.find(i => i.type === 'kitchen')), (st.openings.find(o => OPN[o.type].kind === 'door') || {}).edge].join('|');
    const prev = R.seen.get(sig); if (!prev || ev.sc > prev.ev.sc) R.seen.set(sig, {h, st, ev, failed});
  }
  S = JSON.parse(cur); G.geo = buildGeo(S.shape);
  const pe = document.getElementById('varProg'); if (pe) pe.textContent = `Checking ${R.i} of ${R.n} arrangements…`;
  const pb = document.getElementById('varBar'); if (pb) pb.style.width = (R.i / Math.max(1, R.n) * 100) + '%';
  if (R.i < R.n) { setTimeout(varStep, 0); return; }
  let list = [...R.seen.values()].sort((a, b) => b.ev.sc - a.ev.sc);
  const full = list.filter(v => !v.failed.some(t => ESS.includes(t))); if (full.length >= 3) list = full;
  list = list.slice(0, 6);
  const tag = (fn, label) => { const v = list.slice().sort(fn)[0]; if (v && !v.tag) v.tag = label; };
  if (list[0]) list[0].tag = 'Best overall';
  tag((a, b) => b.ev.bedDoor - a.ev.bedDoor, 'Most private bed');
  tag((a, b) => a.ev.cost - b.ev.cost, 'Lowest cost');
  tag((a, b) => b.ev.freeFloor - a.ev.freeFloor, 'Most open floor');
  list.forEach(v => { v.svg = miniSVG(v.st); v.name = variantName(v.h); });
  G.variants = list; G.varRun = null;
  if (G.tab === 'layouts') { renderPanel(); $$('.vcard').forEach((c, i) => { c.style.setProperty('--d', i * 70 + 'ms'); c.classList.add('pop'); }); }
  toast(list.length ? `Found ${list.length} good arrangements` : 'No working arrangement found for this shape');
}

/* ======================= LOWEST PRICE ======================= */
function badness() {
  const g = buildGeo(S.shape), v = validate(g), has = (...t) => S.items.some(i => t.includes(i.type));
  let n = Object.values(v.items).filter(x => x.length).length + Object.values(v.ops).filter(x => x.length).length;
  [['bed160', 'bed140', 'bed90', 'tatamibed', 'platformbed', 'wallbed', 'sofabed'], ['kitchen'], ['toilet', 'wc', 'acctoilet'], ['shower', 'bath', 'ofuro', 'accshower'], ['basin', 'accbasin']].forEach(t => { if (!has(...t)) n += 10; });
  const wk = walkCheck(g); if (wk) n += wk.unreachable.length;
  return n;
}
function cheapest() {
  const before = costs(buildGeo(S.shape)).total, bad0 = badness();
  // materials and frame: no effect on the layout
  S.spec = Object.assign({}, S.spec, {glazing:'double', cladding:'steel', finish:'ply', frame:'light'});
  S.sys.heater = 'inst'; S.sys.mvhr = Math.min(S.sys.mvhr, 1);
  // layout changes: keep each one only if the plan stays as good as before
  const step = fn => { const snap = JSON.stringify(S); fn(); if (badness() > bad0) S = JSON.parse(snap); };
  ['stove', 'washer', 'fridge', 'shelf'].forEach(t => step(() => { S.items = S.items.filter(i => i.lock || i.type !== t); S.program[{stove:'stove', washer:'washer', fridge:'fridgeTall', shelf:'shelf'}[t]] = false; }));
  S.items.filter(i => i.type === 'bath' && !i.lock).forEach(i => step(() => { const it = S.items.find(x => x.id === i.id); const f = frontDir(it.rot); it.type = 'shower'; it.x -= f[0] * 0; it.w = 800; it.d = 800; S.program.bathing = 'shower'; }));
  S.items.filter(i => i.type === 'kitchen' && i.w > 1500 && !i.lock).forEach(i => step(() => { const it = S.items.find(x => x.id === i.id); it.w = 1500; S.program.kitchen = 1500; }));
  S.openings.forEach(o => step(() => { const p = S.openings.find(x => x.id === o.id); if (p.type === 'slide') { p.type = 'win_tall'; p.w = Math.min(p.w, 1600); p.h = OPN.win_tall.h; p.sill = OPN.win_tall.sill; } if (p.type === 'door_glass') p.type = 'door'; }));
  G.geo = buildGeo(S.shape);
  // size solar, battery and water to what this home uses
  const size = () => { const og = offgrid(), y = S.sys;
    y.pv = Math.max(.9, Math.round(Math.ceil(og.kwh / (y.sun * .8) / .45) * .45 * 100) / 100);
    y.batt = Math.max(5, Math.ceil(og.kwh * 1.6 / .9 / 2.5) * 2.5);
    const need = og.water * 21 - (y.tank ? y.tankL : 0); y.cisternL = Math.max(0, Math.ceil(need / 500) * 500); };
  size();
  // dry or flush toilet: keep whichever is cheaper once water storage is counted
  const t = S.items.find(i => (i.type === 'toilet' || i.type === 'wc') && !i.lock);
  if (t) { const snap = JSON.stringify(S), a = costs(buildGeo(S.shape)).total;
    const tt = S.items.find(i => i.id === t.id); tt.type = tt.type === 'toilet' ? 'wc' : 'toilet'; tt.w = CAT[tt.type].w; S.program.toilet = tt.type; size();
    if (costs(buildGeo(S.shape)).total >= a || badness() > bad0) S = JSON.parse(snap); }
  G.geo = buildGeo(S.shape);
  return before - costs(G.geo).total;
}

/* ======================= COSTS PANEL ======================= */
function renderCosts() {
  const c = costs(G.geo); G.cost = c;
  animateNum($('#totalVal'), c.total);
  let h = `<p style="margin:0 0 10px"><button class="btn primary" data-act="cheapest" style="width:100%">Lowest possible price</button></p><div class="big" id="bigTotal">${money(G.prevTotal ?? c.total)}</div><div class="persqm">${money(c.total / Math.max(G.geo.area, 1))} per m², ${Math.round(c.steelKg)} kg of steel, ${c.trucks.n} truck${c.trucks.n > 1 ? 's' : ''}</div>`;
  const gs = Object.entries(c.groups).sort((a, b) => b[1] - a[1]), mx = gs[0] ? gs[0][1] : 1;
  const pw = G.barW || {};
  h += `<div class="bars">${gs.map(([g, v]) => `<div class="bar"><span>${g}</span><span class="v">${money(v)}</span><div class="t"><i data-w="${(v / mx * 100).toFixed(1)}" style="width:${pw[g] ?? 0}%"></i></div></div>`).join('')}</div>`;
  h += `<details class="breakdown"><summary>Every line</summary><table>${c.lines.map(l => `<tr><td>${esc(l.t)}</td><td>${money(l.v)}</td></tr>`).join('')}</table></details>`;
  const sv = savers(G.geo, c.total); G.savers = sv;
  if (sv.length) h += `<h3>Ways to spend less</h3>${sv.map((s, i) => `<div class="saver"><span>${esc(s.label)}</span><b>−${money(s.save)}</b><span></span><button class="btn small" data-saver="${i}">Apply</button></div>`).join('')}`;
  h += `<h3>Checks</h3><ul class="checks">${G.val.checks.map(k => `<li class="${k.state}"><span class="m">${k.state === 'ok' ? '✓' : k.state === 'warn' ? '!' : '✕'}</span><span>${esc(k.text)}</span></li>`).join('')}</ul>`;
  h += `<p class="note" style="margin-top:14px">Estimates for planning only. Ask your factory and engineer for real quotes.</p><p><button class="btn small" data-act="print">Print summary</button></p>`;
  $('#costs').innerHTML = h;
  const big = $('#bigTotal'); big._v = G.prevTotal ?? c.total; animateNum(big, c.total); G.prevTotal = c.total;
  G.barW = {}; gs.forEach(([g, v]) => G.barW[g] = (v / mx * 100).toFixed(1));
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#costs .bar .t i').forEach(i => i.style.width = i.dataset.w + '%')));
}
function initCosts() {
  $('#costs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.saver) { const s = G.savers[+b.dataset.saver]; if (!s) return; snapshot(); s.fn(); G.motion = true; commit(true); toast('Applied, saves ' + money(s.save)); }
    if (b.dataset.act === 'print') { buildPrint(); window.print(); }
    if (b.dataset.act === 'cheapest') { snapshot(); const sv = cheapest(); G.motion = true; commit(true); toast(sv > 1 ? `Saved ${money(sv)}. Undo brings the old version back.` : 'Already at the lowest price for this design'); }
  });
}

/* ======================= 3D ======================= */
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
let threeP = null;
function ensure3D() {
  if (V3.ok) return Promise.resolve();
  if (!threeP) threeP = new Promise(res => {
    if (window.THREE) { res(); return; }
    const sc = document.createElement('script'); sc.src = THREE_URL; sc.async = true; sc.onload = res; sc.onerror = res; document.head.appendChild(sc);
  }).then(() => { init3D(); if (V3.ok) { build3D(); reset3D(true); } });
  return threeP;
}
const V3 = {ok:false};
function init3D() {
  const msg = $('#v3msg');
  if (!window.THREE) { msg.hidden = false; msg.textContent = 'The 3D view could not load. Check your connection and reload.'; return; }
  const canvas = $('#c3d');
  let renderer; try { renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true}); } catch (e) { msg.hidden = false; msg.textContent = 'This browser cannot show 3D.'; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9290, .85));
  const sun = new THREE.DirectionalLight(0xffffff, .7); sun.position.set(-6, 12, -4); scene.add(sun); V3.sun = sun;
  const root = new THREE.Group(); scene.add(root);
  canvas.classList.add('ready');
  Object.assign(V3, {unit:new THREE.BoxGeometry(1, 1, 1), sun, ok:true, renderer, scene, camera, root, orb:{th:-2.3, ph:1.0, r:13, tgt:new THREE.Vector3(2.75, 1, 2.7)}, need:true});
  const ro = new ResizeObserver(() => { const r = canvas.getBoundingClientRect(); if (r.width < 2) return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); V3.need = true; });
  ro.observe(canvas);
  // orbit
  const pt = new Map(); let last = null, pinch = null;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pt.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY, e.shiftKey || e.button === 2]; if (pt.size === 2) { const [a, b] = [...pt.values()]; pinch = {d:Math.hypot(a[0]-b[0], a[1]-b[1]), r:V3.orb.r}; } });
  canvas.addEventListener('pointermove', e => {
    if (!pt.has(e.pointerId)) return; pt.set(e.pointerId, [e.clientX, e.clientY]);
    if (pt.size === 2 && pinch) { const [a, b] = [...pt.values()]; V3.orb.r = clamp(pinch.r * pinch.d / Math.max(1, Math.hypot(a[0]-b[0], a[1]-b[1])), 3, 40); V3.need = true; return; }
    const dx = e.clientX - last[0], dy = e.clientY - last[1]; last[0] = e.clientX; last[1] = e.clientY;
    if (last[2]) { const o = V3.orb, s = o.r * .0016; const right = new THREE.Vector3(Math.sin(o.th), 0, -Math.cos(o.th)); o.tgt.addScaledVector(right, -dx * s); o.tgt.y += dy * s; }
    else { V3.orb.th += dx * .008; V3.orb.ph = clamp(V3.orb.ph - dy * .008, .12, 1.52); }
    V3.need = true;
  });
  const up = e => { pt.delete(e.pointerId); if (pt.size < 2) pinch = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); V3.orb.r = clamp(V3.orb.r * Math.exp(e.deltaY * .0012), 3, 40); V3.need = true; }, {passive:false});
  V3.anims = [];
  const loop = now => {
    if (V3.anims.length) { V3.anims = V3.anims.filter(a => { const k = clamp((now - a.t0) / a.dur, 0, 1); a.fn(a.ease ? a.ease(k) : easeOut(k)); return k < 1; }); V3.need = true; }
    if (V3.need) { V3.need = false; placeCam(); renderer.render(scene, camera); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
function anim3D(dur, fn, delay = 0, ease) { if (!V3.ok) return; if (RM) { fn(1); V3.need = true; return; } V3.anims.push({t0:performance.now() + delay, dur, fn, ease}); V3.need = true; }
function placeCam() { const o = V3.orb, c = V3.camera; c.position.set(o.tgt.x + o.r * Math.sin(o.ph) * Math.cos(o.th), o.tgt.y + o.r * Math.cos(o.ph), o.tgt.z + o.r * Math.sin(o.ph) * Math.sin(o.th)); c.lookAt(o.tgt); }
function reset3D(instant) { if (!V3.ok || !G.geo) return; const b = G.geo.bbox;
  const asp = V3.camera ? V3.camera.aspect : 1.4, fitK = asp < 1.1 ? (1.1 / asp) * .8 + .2 : 1;
  const to = {th:-2.25, ph:.86, r:Math.max(b[2]-b[0], b[3]-b[1]) / 1000 * 2.55 * fitK, tgt:new THREE.Vector3((b[0]+b[2])/2000, .9, (b[1]+b[3])/2000)};
  if (instant || !V3.orb) { V3.orb = to; V3.need = true; return; } camTo(to); }
function camTo(to) { const fr = {th:V3.orb.th, ph:V3.orb.ph, r:V3.orb.r, tgt:V3.orb.tgt.clone()}; let dth = to.th - fr.th; dth = ((dth + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  anim3D(750, k => { V3.orb.th = fr.th + dth * k; V3.orb.ph = fr.ph + (to.ph - fr.ph) * k; V3.orb.r = fr.r + (to.r - fr.r) * k; V3.orb.tgt.lerpVectors(fr.tgt, to.tgt, k); }); }
const MAT = {};
function mat(hex, opts) { const k = hex + JSON.stringify(opts || {}); if (!MAT[k]) MAT[k] = new THREE.MeshStandardMaterial(Object.assign({color:hex, roughness:.85, metalness:0}, opts || {})); return MAT[k]; }
function build3D() {
  if (!V3.ok) return;
  if (V3.sun) { const sv = sunVec(); V3.sun.position.set(sv[0] * 10 + 3, 12, sv[1] * 10 + 3); }
  const root = V3.root; while (root.children.length) { const c = root.children.pop(); c.traverse && c.traverse(o => { if (o.geometry && o.geometry !== V3.unit) o.geometry.dispose(); }); }
  const dark = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim().toLowerCase() === '#111618';
  const geo = G.geo, s = .001;
  const clad = {fibre:0xA6ABA6, timber:0x9A6B45, steel:0x5E6A70}[S.spec.cladding];
  const box = (w, h, d, x, y, z, ry, m, parent = root) => { const me = new THREE.Mesh(V3.unit, m); me.scale.set(Math.max(w, .001), Math.max(h, .001), Math.max(d, .001)); me.position.set(x, y, z); me.rotation.y = ry || 0; parent.add(me); return me; };
  // ground
  const cxm = (geo.bbox[0]+geo.bbox[2])/2000, czm = (geo.bbox[1]+geo.bbox[3])/2000;
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(9, 64), mat(dark ? 0x26302C : 0xC9D1C6)); gnd.rotation.x = -Math.PI / 2; gnd.position.set(cxm, (S.spec.ideas && S.spec.ideas.stilts) ? -2.4 : -.5, czm); root.add(gnd);
  { const nv = (() => { const n = (S.site.north || 0) * Math.PI / 180; return [-Math.sin(n), -Math.cos(n)]; })();
    const rad = Math.max(geo.bbox[2] - geo.bbox[0], geo.bbox[3] - geo.bbox[1]) / 2000 + 1.4;
    const shp = new THREE.Shape([new THREE.Vector2(0, .55), new THREE.Vector2(.28, -.25), new THREE.Vector2(0, -.08), new THREE.Vector2(-.28, -.25)]);
    const ar = new THREE.Mesh(new THREE.ShapeGeometry(shp), mat(0xB4412C, {side:THREE.DoubleSide}));
    ar.rotation.x = -Math.PI / 2; ar.rotation.z = Math.atan2(-nv[0], -nv[1]);
    ar.position.set(cxm + nv[0] * rad, -.47, czm + nv[1] * rad); root.add(ar); }
  const sh = new THREE.Mesh(new THREE.PlaneGeometry((geo.bbox[2]-geo.bbox[0])/1000 + 1.2, (geo.bbox[3]-geo.bbox[1])/1000 + 1.2), mat(0x000000, {transparent:true, opacity:dark ? .35 : .14})); sh.rotation.x = -Math.PI / 2; sh.position.set(cxm, -.49, czm); root.add(sh);
  const extrude = (poly, depth, y, m) => { const sh = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0] * s, p[1] * s))); const g = new THREE.ExtrudeGeometry(sh, {depth, bevelEnabled:false}); g.rotateX(Math.PI / 2); const me = new THREE.Mesh(g, m); me.position.y = y; root.add(me); return me; };
  // piles + floors
  { const hp = (S.spec.ideas && S.spec.ideas.stilts) ? 2.4 : .5; pillarsOf(geo).forEach(p => { const c = new THREE.Mesh(new THREE.CylinderGeometry(hp > 1 ? .09 : .06, hp > 1 ? .09 : .06, hp, 10), mat(0x777777)); c.position.set(p.p[0]*s, -hp / 2, p.p[1]*s); root.add(c); }); }
  geo.mods.forEach(m => extrude(m.poly, FLOOR_H * s, FLOOR_H * s, mat(0x3B4446)));
  geo.zones.forEach(z => extrude(z.poly, .01, FLOOR_H * s + .01, mat({ply:0xD9B98A, vinyl:0xCFC9BC, lino:0xB9A88C}[S.spec.finish])));
  // walls
  const WH = G.cut && !G.roof ? 1650 : WALL_H;
  const wallM = mat(clad), liningM = mat(0xF2F1EC), glassM = mat(0x9CCBDD, {transparent:true, opacity:.35, roughness:.1}), doorM = mat(0x2E3436), frameM = mat(0x3C4446);
  if (!G.frame) geo.ext.forEach(e => {
    const ry = Math.atan2(-e.u[1], e.u[0]);
    const ops = S.openings.filter(o => o.edge === e.key).map(o => ({o, a:o.s - o.w/2, b:o.s + o.w/2})).sort((a, b) => a.a - b.a);
    const piece = (a, b, y0, y1, isLining = true) => {
      const ext0 = a <= 1 ? T * .99 : 0, ext1 = b >= e.len - 1 ? T * .99 : 0;
      const A = a - ext0 * 0, B = b + 0; const L = B - A; if (L < 2 || y1 - y0 < 2) return;
      const mpos = add(e.a, mul(e.u, (A + B) / 2));
      const c = add(mpos, mul(e.n, (T - 12) / 2));
      box(L * s, (y1 - y0) * s, (T - 12) * s, c[0]*s, (y0 + y1) / 2 * s, c[1]*s, ry, wallM);
      if (isLining) { const c2 = add(mpos, mul(e.n, T - 6)); box(L * s, (Math.min(y1, CEIL) - Math.max(y0, FLOOR_H)) * s, 12 * s, c2[0]*s, (Math.max(y0, FLOOR_H) + Math.min(y1, CEIL)) / 2 * s, c2[1]*s, ry, liningM); }
    };
    let cur = 0;
    ops.forEach(({o, a, b}) => {
      piece(cur, a, 0, WH);
      const y0 = FLOOR_H + o.sill, y1 = Math.min(FLOOR_H + o.sill + o.h, WH - 60);
      if (y0 > 2) piece(a, b, 0, y0);
      piece(a, b, y1, WH);
      const mp = add(e.a, mul(e.u, (a + b) / 2)), c = add(mp, mul(e.n, T / 2)), kind = OPN[o.type].kind;
      if (y1 - y0 < 60) { cur = b; return; }
      if (kind === 'door' && !OPN[o.type].glass) box((o.w - 60) * s, (y1 - y0) * s, 45 * s, c[0]*s, (y0 + y1) / 2 * s, c[1]*s, ry, doorM);
      else box((o.w - 40) * s, (y1 - y0 - 40) * s, 24 * s, c[0]*s, (y0 + y1) / 2 * s, c[1]*s, ry, glassM);
      box(o.w * s, 40 * s, 70 * s, c[0]*s, y1 * s, c[1]*s, ry, frameM);
      cur = b;
    });
    piece(cur, e.len, 0, WH);
  });
  // ramp from the first entry door
  if (S.site.entry === 'ramp') { const d0 = S.openings.find(o => OPN[o.type].kind === 'door'), f = d0 && opFrame(geo, d0);
    if (f) { const L2 = rampLen() / 1000, rise = (S.site.rise || 740) / 1000, out = mul(f.e.n, -1), u = f.e.u, m0 = mul(add(f.a, f.b), .5);
      const land = add(m0, mul(out, 750)), dir = Math.abs(u[0]) > Math.abs(u[1]) ? u : u;
      box(1.5, .06, 1.5, land[0] * s, FLOOR_H * s - .04, land[1] * s, Math.atan2(-u[1], u[0]), mat(0x9AA3A6));
      const rl = L2 - 1.5, ctr = add(add(m0, mul(out, 1500 + 600)), mul(dir, rl * 500)), g = new THREE.Mesh(V3.unit, mat(0x9AA3A6));
      g.scale.set(rl, .06, 1.2); g.position.set(ctr[0] * s, FLOOR_H * s - rise / 2 - .02, ctr[1] * s); g.rotation.order = 'YXZ'; g.rotation.y = Math.atan2(-dir[1], dir[0]); g.rotation.z = -Math.atan(rise / rl); root.add(g); } }
  { const I = S.spec.ideas || {}, ops3 = S.openings.map(op => ({op, f:opFrame(geo, op)})).filter(x => x.f), glass3 = ops3.filter(x => OPN[x.op.type].kind !== 'door').sort((a, b) => b.op.w - a.op.w), Y = y => (FLOOR_H + y) * s;
    const along = (x, k) => add(x.f.a, mul(sub(x.f.b, x.f.a), k)), outN = x => mul(x.f.e.n, -1), ang = x => Math.atan2(-x.f.e.u[1], x.f.e.u[0]);
    if (I.shutters) glass3.forEach(x => { const m = along(x, .5), n = outN(x), w = x.op.w / 1000, top = x.op.sill + x.op.h + 60; const g = new THREE.Mesh(V3.unit, mat(0xF4F1E8, {transparent:true, opacity:.82}));
      g.scale.set(w + .1, .03, .9); const c = add(m, mul(n, 450)); g.position.set(c[0] * s, Y(top) - .26, c[1] * s); g.rotation.order = 'YXZ'; g.rotation.y = ang(x); g.rotation.x = -.55 * Math.sign(n[1] || n[0] || 1) * 0; g.rotateX(.55); root.add(g); });
    if (I.bay && glass3[0]) { const x = glass3[0], n = outN(x), m = along(x, .5), c = add(m, mul(n, 250)), w = x.op.w / 1000 + .2;
      box(w, .12, .55, c[0] * s, Y(x.op.sill) - .06, c[1] * s, ang(x), mat(0x9AA0A3)); box(w, .12, .55, c[0] * s, Y(x.op.sill + x.op.h) + .06, c[1] * s, ang(x), mat(0x9AA0A3));
      box(w - .2, .1, .45, c[0] * s, Y(x.op.sill) + .05, c[1] * s, ang(x), mat(0xD9B55A)); }
    if (I.trellis && glass3[0]) { const x = glass3[0], n = outN(x), L = len(sub(x.f.e.b, x.f.e.a)); for (let k = 0; k * 300 < L; k++) { const p = add(add(x.f.e.a, mul(x.f.e.u, k * 300 + 150)), mul(n, 700));
      box(.012, (WALL_H + 300) / 1000, .012, p[0] * s, (WALL_H + 300) / 2000 - .45, p[1] * s, 0, mat(0xE8DCC2)); box(.25, .3, .18, p[0] * s, -.35, p[1] * s, 0, mat(0x5E8C4A)); } }
    if (I.porch) { const d0 = ops3.find(x => OPN[x.op.type].kind === 'door'); if (d0) { const n = outN(d0), m = along(d0, .5), u = d0.f.e.u;
      const dk = add(m, mul(n, 650)); box(2.0, .05, 1.3, dk[0] * s, FLOOR_H * s - .03, dk[1] * s, ang(d0), mat(0x9B7A55));
      for (let k = -8; k <= 8; k++) { const p = add(add(m, mul(n, 1250)), mul(u, k * 110)); box(.04, 2.1, .04, p[0] * s, FLOOR_H * s + 1.05, p[1] * s, ang(d0), mat(0x8A6440)); } } }
    if (I.spout) { const b = geo.bbox, p = [b[2] + 150, b[3] - 400]; box(.12, .1, .5, p[0] * s, (WALL_H + 150) * s, p[1] * s, 0, mat(0x5C6468)); box(.6, .35, .6, (p[0] + 400) * s, -.33, p[1] * s, 0, mat(0x8C8F86)); }
    if (I.courtyard && glass3[0]) { const x = glass3[0], n = outN(x), c = add(along(x, .5), mul(n, 1900)); box(3.0, .04, 3.0, c[0] * s, -.47, c[1] * s, ang(x), mat(0xC9C4B8));
      [[-1, -1], [1, -1], [-1, 1]].forEach(([a, b2]) => { const p = add(add(c, mul(x.f.e.u, a * 1100)), mul(n, b2 * 1000)); box(.5, .6, .5, p[0] * s, -.2, p[1] * s, 0, mat(0x4F7A43)); }); } }
  { const I = S.spec.ideas || {}, ops3 = S.openings.map(op => ({op, f:opFrame(geo, op)})).filter(x => x.f), glass3 = ops3.filter(x => OPN[x.op.type].kind !== 'door').sort((a, b) => b.op.w - a.op.w), b = geo.bbox;
    const outN = x => mul(x.f.e.n, -1), ang = x => Math.atan2(-x.f.e.u[1], x.f.e.u[0]), mid = x => mul(add(x.f.a, x.f.b), .5);
    if (I.pergola && glass3[0]) { const x = glass3[0], n = outN(x), c = add(mid(x), mul(n, 1300)), wd = 3.0;
      box(wd, .05, 2.4, c[0] * s, FLOOR_H * s - .03, c[1] * s, ang(x), mat(0x9B7A55));
      [[-1, 1], [1, 1]].forEach(([a2]) => { const p = add(add(c, mul(x.f.e.u, a2 * 1450)), mul(n, 1150)); box(.09, 2.5, .09, p[0] * s, FLOOR_H * s + 1.25, p[1] * s, 0, mat(0x6F5236)); });
      for (let k = -6; k <= 6; k++) { const p = add(c, mul(n, k * 180)); box(wd, .04, .06, p[0] * s, FLOOR_H * s + 2.5, p[1] * s, ang(x), mat(0x8A6440)); } }
    if (I.wings) geo.ext.filter(e => e.len > 3500).sort((p, q) => q.len - p.len).slice(0, 2).forEach(e => { const n = mul(e.n, -1), m = mul(add(e.a, e.b), .5), r = Math.min(1.9, e.len / 2000 - .3), an = Math.atan2(-e.u[1], e.u[0]);
      for (let k = 0; k < 9; k++) { const a2 = Math.PI * (k + .5) / 9, len2 = r, p = add(m, mul(add(mul(e.u, -Math.cos(a2)), mul(n, Math.sin(a2) * .75)), len2 * 500));
        const g = new THREE.Mesh(V3.unit, mat(k % 2 ? 0xE8743B : 0xF19A5E, {transparent:true, opacity:.78, side:THREE.DoubleSide})); g.scale.set(.02, 2.2, len2); g.position.set(p[0] * s, FLOOR_H * s + 1.1, p[1] * s);
        g.rotation.y = an + Math.PI / 2 - (a2 - Math.PI / 2); root.add(g); } });
    if (I.slimline) { const p = [b[2] + 450, b[1] + 1400]; box(.42, 1.9, 2.2, p[0] * s, -.5 + .95, p[1] * s, 0, mat(0xB9C0C2, {metalness:.4, roughness:.4})); }
    if (I.wind) { const p = [b[0] - 2200, b[3] + 1200]; box(.08, 6.5, .08, p[0] * s, -.5 + 3.25, p[1] * s, 0, mat(0xD6D9DA)); box(.2, .18, .5, p[0] * s, 2.8, p[1] * s, 0, mat(0xD6D9DA));
      [0, 1, 2].forEach(k => { const g = new THREE.Mesh(V3.unit, mat(0xF2F3F3)); g.scale.set(.08, 1.1, .02); g.position.set(p[0] * s, 2.8, p[1] * s + .27); g.rotation.z = k * 2.094; g.translateY(.55); root.add(g); }); }
    if (I.skylight) { const c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; box(1.0, .12, 1.0, c[0] * s, (WALL_H + 260) * s, c[1] * s, 0, mat(0xBFE0EE, {transparent:true, opacity:.7})); } }
  // steel frame view
  if (G.frame) {
    const st = mat(0xC9562F), bl = mat(0x3D7FC0);
    geo.mods.forEach(m => {
      const z = insetSegs(m, e => e.type === 'ext' ? PIL_EXT : 50).poly;
      z.forEach(p => box(.1, 2.85, .1, p[0]*s, 1.425, p[1]*s, 0, st));
      z.forEach((p, i) => { const q = z[(i+1) % z.length], d = sub(q, p), l = len(d), ry = Math.atan2(-d[1], d[0]), mm = mul(add(p, q), .5);
        box(l * s, .2, .1, mm[0]*s, .12, mm[1]*s, ry, bl); box(l * s, .15, .1, mm[0]*s, 2.75, mm[1]*s, ry, bl); });
      const ys = z.map(p => p[1]); for (let y = Math.min(...ys) + 600; y < Math.max(...ys) - 150; y += 600) {
        const xs = []; for (let i = 0; i < z.length; i++) { const a = z[i], b = z[(i+1) % z.length]; if ((a[1]-y) * (b[1]-y) < 0) xs.push(a[0] + (y-a[1]) * (b[0]-a[0]) / (b[1]-a[1])); }
        if (xs.length >= 2) { const x0 = Math.min(...xs) + 50, x1 = Math.max(...xs) - 50; box((x1 - x0) * s, .1, .048, (x0 + x1) / 2 * s, .17, y * s, 0, mat(0x8E9A9E)); }
      }
    });
  }
  // roof + PV
  if (G.roof && S.shape.roof === 'gable') {
    const roofGrp = new THREE.Group(); root.add(roofGrp);
    const b = geo.bbox, ov = 300, x0 = (b[0] - ov) * s, x1 = (b[2] + ov) * s, z0 = (b[1] - ov) * s, z1 = (b[3] + ov) * s;
    const E = (WALL_H + 170) * s, half = (x1 - x0) / 2, pitch = 25 * Math.PI / 180, rise = half * Math.tan(pitch), xc = (x0 + x1) / 2, depth = z1 - z0, Ls = half / Math.cos(pitch);
    const roofM = mat(0x3A3F42), steel = mat(0x5C6468, {metalness:.4, roughness:.5});
    [[1, x0 + half / 2], [-1, x1 - half / 2]].forEach(([sg, cx2]) => { const me = box(Ls, .08, depth, cx2, E + rise / 2, (z0 + z1) / 2, 0, roofM, roofGrp); me.rotation.z = sg * pitch;
      for (let k = 1; k <= 4; k++) { const f = k / 5, px = sg > 0 ? x0 + half * f : x1 - half * f; box(.06, .06, depth, px, E + rise * f + .08, (z0 + z1) / 2, 0, steel, roofGrp); } });
    const tri = new THREE.Shape([new THREE.Vector2(x0 + .3, E), new THREE.Vector2(x1 - .3, E), new THREE.Vector2(xc, E + rise - .05)]);
    [z0 + .3, z1 - .3].forEach(z => { const g2 = new THREE.Mesh(new THREE.ShapeGeometry(tri), mat(0xEEF0EC, {side:THREE.DoubleSide})); g2.position.z = z; roofGrp.add(g2); });
    box(.1, E + rise - FLOOR_H * s, .1, xc, (FLOOR_H * s + E + rise) / 2, (z0 + z1) / 2, 0, steel, roofGrp);
    const n = Math.round(S.sys.pv / .45); for (let j = 0; j < n; j++) { const zz = z0 + .6 + (j % Math.floor((depth - 1) / 1.16)) * 1.16, row = Math.floor(j / Math.floor((depth - 1) / 1.16)); if (row > 1) break;
      const f = .3 + row * .4, me = box(1.903 * .55, .035, 1.134, x1 - half * f, E + rise * f + .12, zz + .57, 0, mat(0x1C2A44, {roughness:.35, metalness:.3}), roofGrp); me.rotation.z = -pitch; }
    if (G.anim3D === 'roof') anim3D(700, k => { roofGrp.position.y = (1 - k) * 2.2; }, 0, easeOut);
  } else if (G.roof) {
    const roofGrp = new THREE.Group(); root.add(roofGrp); const keepRoot = root;
    geo.mods.forEach(m => { const me = extrude(m.poly, .17, (WALL_H + 170) * s, mat(0x3A3F42)); keepRoot.remove(me); roofGrp.add(me); });
    if (G.anim3D === 'roof') anim3D(700, k => { roofGrp.position.y = (1 - k) * 2.2; }, 0, easeOut);
    const n = Math.round(S.sys.pv / .45); let placed = 0;
    geo.mods.slice().sort((a, b) => polyArea(b.poly) - polyArea(a.poly)).forEach(m => {
      const zz = insetSegs(m, () => 150).poly, xs = zz.map(p => p[0]), ys = zz.map(p => p[1]);
      for (let y = Math.min(...ys); y + 1903 <= Math.max(...ys) && placed < n; y += 2000) for (let x = Math.min(...xs); x + 1134 <= Math.max(...xs) && placed < n; x += 1160) {
        const cs = [[x, y], [x + 1134, y], [x + 1134, y + 1903], [x, y + 1903]]; if (!cs.every(p => inPoly(p, zz))) continue;
        const me = box(1.134, .035, 1.903, (x + 567) * s, (WALL_H + 170) * s + .25, (y + 951) * s, 0, mat(0x1C2A44, {roughness:.35, metalness:.3})); me.rotation.x = .17; placed++;
      }
    });
    S.items.filter(i => i.type === 'skylight').forEach(i => box(i.w * s, .06, i.d * s, i.x * s, (WALL_H + 170) * s + .03, i.y * s, -i.rot * Math.PI / 180, glassM));
  }
  // items
  let n3 = 0;
  S.items.filter(it => it.type === 'overhead').forEach(it => { const t = -it.rot * Math.PI / 180; const me = box(it.w * s, .5, it.d * s, it.x * s, (FLOOR_H + 2150) * s, it.y * s, t, mat(0xD8CBB8)); });
  S.items.forEach(it => { if (CAT[it.type].overlay) return; const g = itemMesh(it, box); g.position.set(it.x * s, FLOOR_H * s, it.y * s); g.rotation.y = -it.rot * Math.PI / 180; root.add(g);
    if (G.motion3D) { const d = n3++ * 45; g.scale.set(.001, .001, .001); anim3D(520, k => { const v = Math.max(.001, k); g.scale.set(v, v, v); }, d, easeBack); } });
  if (G.anim3D === 'frame' || G.anim3D === 'walls') { const kids = root.children.slice(); kids.forEach((c, i) => { if (c.geometry && c.geometry.type === 'BoxGeometry') { const sy = c.scale.y; c.scale.y = .001; anim3D(600, k => c.scale.y = Math.max(.001, k * sy), Math.min(i * 6, 500)); } }); }
  G.motion3D = false; G.anim3D = null;
  V3.need = true;
}
function itemMesh(it, box) {
  const g = new THREE.Group(), w = it.w / 1000, d = it.d / 1000, t = it.type;
  const W = mat(0xF4F3EF), wood = mat(0xC79A63), dark = mat(0x2D3234), fab = mat(0x8EA58C), bed = mat(0xE9E4DA), grey = mat(0xA9AFB0), glass = mat(0xA6D3E2, {transparent:true, opacity:.35});
  const B = (bw, bh, bd, x, y, z, m) => box(bw, bh, bd, x, y, z, 0, m, g);
  if (t === 'daybed') { B(w, .38, d, 0, .19, 0, wood); B(w - .1, .12, d - .2, 0, .44, .05, fab); B(w, .4, .12, 0, .62, -d/2 + .06, fab); }
  else if (t === 'loftbed') { const bw = w - .55; [[-w/2 + .05, -d/2 + .05], [-w/2 + .05, d/2 - .05], [w/2 - .6, -d/2 + .05], [w/2 - .6, d/2 - .05]].forEach(([x, z]) => B(.06, 1.6, .06, x, .8, z, wood));
    B(bw, .2, d, -w/2 + bw/2, 1.6, 0, wood); B(bw - .1, .18, d - .1, -w/2 + bw/2, 1.79, 0, bed); B(bw - .3, .03, .6, -w/2 + bw/2, .75, -d/2 + .35, wood);
    [0, 1, 2, 3, 4].forEach(k => B(.5, .32 * (k + 1), d / 5, w/2 - .27, .16 * (k + 1), d/2 - d/10 - k * d / 5, wood)); }
  else if (t === 'wallstore') { B(w, 2.4, d, 0, 1.2, 0, mat(0xD8C3A0)); B(w * .2, .5, .02, 0, 1.1, d/2 + .005, mat(0x8A6B49)); }
  else if (t === 'cart') { B(w, .04, d, 0, .88, 0, mat(0x9DB6A8)); B(w - .04, .7, d - .04, 0, .48, 0, wood); }
  else if (t === 'platformbed') { B(w, .45, d, 0, .225, 0, mat(0x6B4A33)); B(w - .3, .18, d - .9, 0, .54, -.3, bed); [-1, 0, 1].forEach(k => B(.9, .02, .22, 0, .15 + (k + 1) * .15, d/2 - .11 - (1 - k) * .22, W)); }
  else if (t === 'accshower') { B(w, .02, d, 0, .01, 0, mat(0xC9D6DA)); B(.02, 2, d, w/2, 1, 0, glass); B(.35, .04, .35, -w/2 + .2, .47, -d/2 + .2, wood); }
  else if (t === 'acctoilet') { B(.4, .42, .5, 0, .21, .05, W); B(.4, .45, .18, 0, .5, -d/2 + .09, W); B(.03, .03, .6, -w/2 + .02, .75, 0, grey); B(.03, .03, .6, w/2 - .02, .75, 0, grey); }
  else if (t === 'accbasin') { B(w, .12, d, 0, .82, 0, W); B(w - .05, .6, .02, 0, 1.45, -d/2 + .01, glass); }
  else if (t === 'tatamibed') { B(w, .3, d, 0, .15, 0, wood); B(w - .06, .06, d - .06, 0, .33, 0, mat(0xCBC28A)); B(w - .3, .12, 1.0, 0, .42, .3, bed); B(w - .3, .1, .3, 0, .41, -d/2 + .3, W); }
  else if (t === 'oshiire') { B(w, 2.1, d, 0, 1.05, 0, mat(0xEDE6D3)); B(w - .04, .03, .02, 0, 1.0, d/2 + .01, mat(0x9B8F72)); }
  else if (t === 'jang') { B(w, 1.1, d, 0, .55, 0, mat(0x8A5A3C)); B(w, .04, d + .02, 0, 1.12, 0, mat(0x6E4630)); }
  else if (t === 'shoeslim') B(w, 1.1, d, 0, .55, 0, mat(0xE6E1D6));
  else if (t === 'getabako' || t === 'pantry' || t === 'cleaning') B(w, CAT[t].h / 1000, d, 0, CAT[t].h / 2000, 0, t === 'pantry' ? W : mat(0xD8CBB4));
  else if (t === 'nook') { B(w, .45, d, 0, .225, 0, wood); B(w - .1, .06, d - .1, 0, .48, 0, fab); B(w - .2, .7, .03, 0, 1.25, -d/2 + .03, wood); }
  else if (t === 'rail') { B(.03, 1.8, d, -w/2 + .02, .9, 0, grey); B(.03, 1.8, d, w/2 - .02, .9, 0, grey); B(w, .03, .03, 0, 1.75, 0, grey); B(w - .1, 1.0, d - .1, 0, 1.2, 0, mat(0x9DA6B5)); }
  else if (t === 'cleanrail') B(w, .9, d, 0, 1.1, 0, grey);
  else if (t === 'benchstore') { B(w, .42, d, 0, .21, 0, wood); B(w - .1, .06, d - .1, 0, .45, 0, fab); }
  else if (t === 'divider') { B(.03, 1.6, d, -w/2, .8, 0, wood); B(.03, 1.6, d, w/2, .8, 0, wood); [0, .4, .8, 1.2, 1.6].forEach(y => B(w, .025, d, 0, y + .01, 0, wood)); }
  else if (t === 'nightstand') B(w, .5, d, 0, .25, 0, wood);
  else if (t === 'bins') [0, 1, 2].forEach(i => B(w / 3 - .03, .6, d, -w/3 + i * w/3, .3, 0, mat([0x4A7A55, 0x3F6E9E, 0x8A8F92][i])));
  else if (t === 'kotatsu') { B(.95, .04, .95, 0, .4, 0, wood); B(1.05, .3, 1.05, 0, .22, 0, mat(0xB35848)); [[0, -.68], [0, .68]].forEach(([x, z]) => B(.45, .08, .45, x, .04, z, mat(0xD9C089))); }
  else if (t === 'soban') { B(.7, .03, .7, 0, .34, 0, wood); [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]].forEach(([x, z]) => B(.03, .33, .03, x, .165, z, wood)); [[0, -.55], [0, .55]].forEach(([x, z]) => B(.42, .06, .42, x, .03, z, mat(0x9DB39A))); }
  else if (t === 'ofuro') { B(w, .65, d, 0, .325, 0, mat(0xC79A63)); B(w - .12, .02, d - .12, 0, .66, 0, mat(0xBFD9E2)); }
  else if (t === 'wallbed') { B(w, 2.1, d, 0, 1.05, 0, mat(0xD9C3A2)); B(w - .2, .02, 2.0, 0, .01, d/2 + 1.0, mat(0xCFC6B4, {transparent:true, opacity:.35})); }
  else if (t.startsWith('bed')) { B(w, .3, d, 0, .15, 0, wood); B(w - .04, .22, d - .05, 0, .41, .02, bed); B(w, .5, .06, 0, .55, -d/2 + .03, wood); const n = w > 1.3 ? 2 : 1; for (let i = 0; i < n; i++) B((w - .2) / n - .05, .1, .32, -w/2 + .1 + (i + .5) * (w - .2) / n, .57, -d/2 + .3, W); }
  else if (t === 'sofa' || t === 'sofabed') { B(w, .42, d, 0, .21, 0, fab); B(w, .4, .2, 0, .62, -d/2 + .1, fab); B(.18, .25, d, -w/2 + .09, .54, 0, fab); B(.18, .25, d, w/2 - .09, .54, 0, fab); }
  else if (t === 'dining') { B(w, .04, d - .6, 0, .74, 0, wood); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(.04, .72, .04, a * (w/2 - .05), .36, b * ((d - .6)/2 - .05), wood)); B(.42, .45, .4, 0, .225, -d/2 + .2, grey); B(.42, .45, .4, 0, .225, d/2 - .2, grey); }
  else if (t === 'foldtable') { B(w, .04, d, 0, .74, 0, wood); B(.05, .72, .05, 0, .36, d/2 - .05, wood); }
  else if (t === 'desk') { B(w, .04, .56, 0, .74, -d/2 + .28, wood); B(.04, .72, .5, -w/2 + .03, .36, -d/2 + .28, wood); B(.04, .72, .5, w/2 - .03, .36, -d/2 + .28, wood); B(.45, .45, .45, 0, .225, -d/2 + .82, grey); }
  else if (t === 'wardrobe' || t === 'shelf') { B(w, (t === 'wardrobe' ? 2.1 : 2), d, 0, (t === 'wardrobe' ? 1.05 : 1), 0, t === 'wardrobe' ? mat(0xD9C3A2) : wood); }
  else if (t === 'shoe') B(w, .45, d, 0, .225, 0, wood);
  else if (t === 'kitchen') { const o = it.opt || {}; B(w, .87, d, 0, .435, 0, W); B(w, .03, d + .02, 0, .885, .01, mat(0x5B5F5C)); const sx = -w/2 + clamp(o.sink, 0, 1) * w, cx = -w/2 + clamp(o.cook, 0, 1) * w; B(.42, .02, .36, clamp(sx, -w/2 + .25, w/2 - .25), .9, .05, grey); B(.52, .015, .46, clamp(cx, -w/2 + .3, w/2 - .3), .905, .05, dark); B(w, .5, .32, 0, 1.7, -d/2 + .16, W); }
  else if (t === 'fridge') B(w, 1.8, d, 0, .9, 0, W);
  else if (t === 'shower') { B(w, .05, d, 0, .025, 0, W); B(w, 2, .01, 0, 1, d/2, glass); B(.01, 2, d, w/2, 1, 0, glass); }
  else if (t === 'bath') { B(w, .5, d, 0, .25, 0, W); B(w - .12, .02, d - .12, 0, .51, 0, mat(0xBFD9E2)); }
  else if (t === 'toilet' || t === 'wc') { B(w - .05, .42, d - .2, 0, .21, .08, W); B(w - .05, .45, .18, 0, .5, -d/2 + .09, W); }
  else if (t === 'basin') { B(w, .75, d, 0, .375, 0, wood); B(w, .1, d, 0, .82, 0, W); B(w - .05, .6, .02, 0, 1.45, -d/2 + .01, glass); }
  else if (t === 'washer') B(w, .85, d, 0, .425, 0, W);
  else if (t === 'energy') B(w, 2, d, 0, 1, 0, mat(0x9AA3A6));
  else if (t === 'stove') { B(w, .9, d, 0, .45, 0, dark); const f = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, 1.6, 12), dark); f.position.set(0, 1.7, 0); g.add(f); }
  else if (t === 'partition') { partitionParts(it).forEach(([a, b]) => B((b - a) / 1000, 2.41, d, (a + b) / 2000, 1.205, 0, mat(0xEDECE7))); if (it.opt && it.opt.door) { const dw = clamp(it.opt.dw, 500, it.w - 100) / 1000, c = clamp(it.opt.dpos * w - w/2, -w/2 + dw/2, w/2 - dw/2); B(dw, 2.05, .04, c, 1.025, -d/2 - .03, mat(0xFFFFFF)); } }
  else B(w, (CAT[t].h || 800) / 1000, d, 0, (CAT[t].h || 800) / 2000, 0, grey);
  return g;
}

/* ======================= DESIGNS DIALOG ======================= */
function designs() { try { return JSON.parse(localStorage.getItem('mhb-designs') || '[]'); } catch (e) { return []; } }
function saveDesigns(l) { try { localStorage.setItem('mhb-designs', JSON.stringify(l)); return true; } catch (e) { return false; } }
function openDesigns() {
  const d = $('#dlg'), list = designs();
  d.innerHTML = `<h3>Your designs</h3>
    <div class="field wide"><label for="dName">Name this design</label><input type="text" id="dName" value="${esc(S.name)}"></div>
    <p style="display:flex; gap:6px; flex-wrap:wrap"><button class="btn primary" data-d="save">Save design</button><button class="btn" data-d="new">Start a new design</button></p>
    ${list.length ? `<ul class="saved">${list.map((x, i) => `<li><span>${esc(x.name)}<br><small class="note">${new Date(x.t).toLocaleString()}</small></span><button class="btn small" data-d="load" data-i="${i}">Open</button><button class="btn small" data-d="del" data-i="${i}">Delete</button></li>`).join('')}</ul>` : '<p class="note">Saved designs stay in this browser.</p>'}
    <h3 style="margin-top:16px">Design file</h3><p class="note">Keep a copy, or move your design to another device.</p>
    <p style="display:flex; gap:6px; flex-wrap:wrap"><button class="btn" data-d="dlfile">Download design file</button><label class="btn" style="cursor:pointer">Open design file<input type="file" accept=".json,application/json" id="dFile" hidden></label></p>
    <h3 style="margin-top:16px">Share by code</h3><p class="note">Copy this code to send the design to someone, or paste a code to open one.</p>
    <textarea id="dCode" spellcheck="false"></textarea>
    <p style="display:flex; gap:6px; flex-wrap:wrap"><button class="btn" data-d="copy">Copy design code</button><button class="btn" data-d="paste">Open pasted code</button><button class="btn ghost" data-d="close">Close</button></p>`;
  if (!d.open) d.showModal();
}
function initDialog() {
  const d = $('#dlg');
  d.addEventListener('change', e => { if (e.target.id !== 'dFile' || !e.target.files[0]) return; const fr = new FileReader();
    fr.onload = () => { try { const st = JSON.parse(fr.result); if (!st.shape) throw 0; snapshot(); S = migrate(st); G.view = null; G.sel = null; commit(true); reset3D(); d.close(); toast('Design opened'); } catch (er) { toast('That file is not a design file.'); } };
    fr.readAsText(e.target.files[0]); });
  d.addEventListener('click', e => {
    if (e.target === d) { d.close(); return; }
    const b = e.target.closest('[data-d]'); if (!b) return; const a = b.dataset.d;
    if (a === 'close') d.close();
    if (a === 'tips') openHelp();
    if (a === 'dlfile') saveFile(`${(S.name || 'microhome').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`, JSON.stringify(S, null, 1), 'application/json');
    if (a === 'save') { S.name = $('#dName').value.trim() || 'Untitled'; const l = designs(); const i = l.findIndex(x => x.name === S.name); const rec = {name:S.name, t:Date.now(), state:S}; if (i >= 0) l[i] = rec; else l.unshift(rec); if (saveDesigns(l)) toast('Design saved'); else toast('This browser blocks saving. Use the design code instead.'); openDesigns(); }
    if (a === 'load') { const x = designs()[+b.dataset.i]; if (x) { snapshot(); S = migrate(x.state); G.view = null; G.sel = null; commit(true); reset3D(); d.close(); toast('Opened ' + x.name); } }
    if (a === 'del') { const l = designs(); l.splice(+b.dataset.i, 1); saveDesigns(l); openDesigns(); }
    if (a === 'new') { snapshot(); S = defaultState(); applyPreset(PRESETS[0]); G.view = null; G.sel = null; commit(true); reset3D(); d.close(); toast('New design started'); }
    if (a === 'copy') { const code = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); const ta = $('#dCode'); ta.value = code; ta.select(); (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Design code copied')).catch(() => { try { document.execCommand('copy'); toast('Design code copied'); } catch (er) { toast('Select the code and copy it'); } }); }
    if (a === 'paste') { try { const st = JSON.parse(decodeURIComponent(escape(atob($('#dCode').value.trim())))); snapshot(); S = migrate(st); G.view = null; G.sel = null; commit(true); reset3D(); d.close(); toast('Design opened'); } catch (er) { toast('That code is not a design code. Copy the whole code and try again.'); } }
  });
}
function openHelp() {
  const d = $('#dlg');
  d.innerHTML = `<h3>Tips and shortcuts</h3><div class="help-grid">
    <span class="kbd">Drag</span><span>Move furniture, or slide a door or window along any outside wall</span>
    <span class="kbd">R</span><span>Turn the selected piece 90°, with Shift 15°</span>
    <span class="kbd">← →</span><span>Nudge 50 mm, with Shift 10 mm. Hold Alt while dragging to skip the 50 mm grid</span>
    <span class="kbd">Del</span><span>Remove the selected piece</span>
    <span class="kbd">Ctrl D</span><span>Duplicate the selected piece</span>
    <span class="kbd">Ctrl Z</span><span>Undo, Ctrl Y redo</span>
    <span class="kbd">+ −</span><span>Zoom the plan in and out, or use the + and − buttons</span>
    <span class="kbd">Compass</span><span>Drag it to set north, tap to turn 45°. With Shift it snaps to 15°</span>
    <span class="kbd">Wheel</span><span>Zoom the plan or 3D view. Drag empty space to pan. Shift-drag pans in 3D</span>
  </div><p class="note" style="margin-top:12px">Lock a piece in its panel to keep it in place when you auto-arrange. Red outlines mean something overlaps or blocks a door, the Checks list says what.</p>
  <p><button class="btn primary" data-d="close">Got it</button></p>`;
  if (!d.open) d.showModal();
}
function migrate(st) { const d = defaultState(); const out = Object.assign(d, st);
  if (st.shape) { const L = st.shape.L || 5400; out.shape = Object.assign(defaultState().shape, st.shape); out.shape.left = convWing(Object.assign({}, st.shape.left), L); out.shape.right = convWing(Object.assign({}, st.shape.right), L); } ['hints', 'program', 'spec', 'sys', 'site'].forEach(k => out[k] = Object.assign(defaultState()[k], st[k] || {})); out.prices = Object.assign(d.prices, st.prices || {}); out.iprices = Object.assign(defaultState().iprices, st.iprices || {});
  if (st.pv !== 2) { const f = defaultState(); out.prices = f.prices; out.iprices = f.iprices; out.spec = Object.assign({}, out.spec, {frame:'light', cladding:'steel', finish:'ply'}); out.pv = 2; } out.items = (st.items || []).filter(i => CAT[i.type]); out.openings = (st.openings || []).filter(o => OPN[o.type]); return out; }

/* ======================= IDEAS ======================= */
// Ideas from the reference images: the best ones are our picks, the rest are more ideas.
const IDEAS = [
  // our picks: the best across all reference images
  {k:'quadcore', main:true, kind:'feature', g:'Build', t:'Kingspan QuadCore insulated panels', d:'Factory panels for walls and roof instead of the rockwool build-up. About 30% less heating energy, faster to close in, and a Kingspan product for the award.'},
  {k:'daybed', main:true, kind:'item', g:'Furniture', t:'Extendable daybed', d:'A sofa by day that slides out into a double bed at night. Frees a whole bed footprint.'},
  {k:'wallstore', main:true, kind:'item', g:'Furniture', t:'Full-height storage wall', d:'Floor-to-ceiling cupboards with open niches, about 1,600 L in 40 cm of depth.'},
  {k:'trundle', main:true, kind:'feature', g:'Furniture', t:'Pull-out guest bed under the platform', d:'A bed on wheels hides under the raised sleeping platform and rolls out for a guest. Works with the platform bed.'},
  {k:'shutters', main:true, kind:'feature', g:'Outside', t:'Lift-up shading shutters', d:'Translucent panels hinged above the glass: summer shade and breeze, closed for storms.'},
  {k:'wind', main:true, kind:'feature', g:'Energy', t:'Small wind turbine', d:'A 1 kW turbine on a 6 m mast adds about 1.8 kWh a day on average, most in winter when solar is weakest.'},
  {k:'pergola', main:true, kind:'feature', g:'Outside', t:'Covered pergola terrace', d:'A deck with a slatted roof outside the glass: an outdoor room for summer, shade for the glass.'},
  {k:'wings', main:true, kind:'feature', g:'Outside', t:'Fold-out fabric wings', d:'Translucent fabric wings fold out from both long walls like a fan, adding about 8 m² of sheltered summer room, and fold flat for winter and transport.'},
  {k:'slimline', main:true, kind:'feature', g:'Energy', t:'Kingspan Slimline 2,000 L tank', d:'A slim steel tank against the wall stores 2,000 L more rainwater, quick to install. Drain or frost-protect it in deep winter.'},
  // furniture and storage
  {k:'loftbed', kind:'item', g:'Furniture', t:'Loft bed over a desk', d:'Bed up under the gable, desk and shelves below, drawer stairs. Needs the gable roof.'},
  {k:'shelves', kind:'feature', g:'Furniture', t:'Angled open kitchen shelves', d:'Timber shelves on diagonal brackets above the counter, about 250 L of open storage.'},
  {k:'counterchairs', kind:'feature', g:'Furniture', t:'Chairs that slot into the counter', d:'Two slatted chairs that slide flush into the kitchen counter when not in use.'},
  {k:'bookring', kind:'feature', g:'Furniture', t:'High bookshelf ring', d:'A shelf running above the windows around the room, about 300 L that never gets in the way.'},
  {k:'hiddenkitchen', kind:'feature', g:'Furniture', t:'Kitchen behind folding doors', d:'The whole kitchen closes behind folding doors so the room becomes a quiet living space.'},
  {k:'curtain', kind:'feature', g:'Furniture', t:'Curtain-enclosed bathroom', d:'A curved curtain on a ceiling track instead of a door: softer and saves the door swing.'},
  {k:'liftbed', kind:'item', g:'Furniture', t:'Ceiling lift bed', d:'The bed rises to the ceiling by day and lowers at night, leaving the whole floor free. Needs the gable roof.'},
  {k:'cart', kind:'item', g:'Furniture', t:'Kitchen cart on wheels', d:'Extra worktop and pantry that rolls out when cooking.'},
  {k:'net', kind:'item', g:'Furniture', t:'Ceiling net lounge', d:'A strong net under the gable to read and lie in the light. Needs the gable roof.'},
  // outside and climate
  {k:'bay', kind:'feature', g:'Outside', t:'Box window seat', d:'The biggest window becomes a 50 cm deep seat projecting outside.'},
  {k:'stilts', kind:'feature', g:'Outside', t:'Raised on tall posts', d:'The home sits about 2.4 m up; shade and storage underneath, good for slopes and floods.'},
  {k:'porch', kind:'feature', g:'Outside', t:'Screened entrance porch', d:'A small deck at the door behind a timber slat screen.'},
  {k:'trellis', kind:'feature', g:'Outside', t:'Rope trellis for climbing plants', d:'Vines on vertical ropes shade the glass in summer and drop their leaves for winter sun.'},
  {k:'courtyard', kind:'feature', g:'Outside', t:'Courtyard patio', d:'About 9 m² of paving, gravel and planting outside the glass.'},
  {k:'facade', kind:'feature', g:'Outside', t:'Layered facade', d:'Insect screen, sailcloth curtain and bamboo screen in front of the glass, each adjustable for sun, rain and privacy.'},
  {k:'vents', kind:'feature', g:'Outside', t:'Roof stack vents', d:'Warm air leaves through two high vents and cool air comes in low: natural cooling without fans.'},
  {k:'skylight', kind:'feature', g:'Outside', t:'Central skylight', d:'An opening skylight at the heart of the home: daylight, stars at night and summer venting.'},
  {k:'exposed', kind:'feature', g:'Outside', t:'Exposed coloured steel', d:'Steel beams and post left visible and painted, with a display ledge on the beams.'},
  {k:'raincollector', kind:'feature', g:'Outside', t:'Rain-collector roof', d:'Roof planes tilt to one valley that feeds the tank, catching about 10% more rain with one short gutter.'},
  {k:'glazedroof', kind:'feature', g:'Outside', t:'Glazed roof bay with louvres', d:'A glass roof bay over the living area with movable louvres for shade. Bright, but it loses more heat in winter.'},
  {k:'greenroof', kind:'feature', g:'Outside', t:'Sedum green roof', d:'Planted roof that cools in summer and holds stormwater. Heavy, and it halves the rainwater you can collect.'},
  {k:'kilon', kind:'feature', g:'Outside', t:'Translucent polycarbonate wall', d:'A glowing wall section of Kilon polycarbonate by Kingspan: daylight with privacy.'},
  {k:'fog', kind:'feature', g:'Outside', t:'Fog catcher canopy', d:'A fine mesh on the canopy collects water from fog. Only worth it in misty highlands.'},
  // energy and water
  {k:'powerpanel', kind:'feature', g:'Energy', t:'Kingspan QuadCore PowerPanel', d:'Roof panels with the solar built in: fewer fixings and about 8% more yield from a cooler, tidier array.'},
  {k:'biodisc', kind:'feature', g:'Energy', t:'Kingspan BioDisc wastewater plant', d:'Treats all wastewater on site, for a flush toilet or several homes. The dry toilet makes it unnecessary for one home.'},
  {k:'greywell', kind:'feature', g:'Energy', t:'Greywater recharge well', d:'Filtered greywater soaks back into the ground through a gravel well instead of a planter.'},
  {k:'spout', kind:'feature', g:'Energy', t:'Concealed rain spout', d:'Roof water pours from a hidden spout into a stone basin, then to the cistern.'},
  // building products
  {k:'dridesign', kind:'feature', g:'Build', t:'Kingspan Dri-Design facade', d:'Precision metal cassettes on a ventilated rail: crisp, durable and quick to fix, in any colour.'},
  {k:'greenguard', kind:'feature', g:'Build', t:'Kingspan GreenGuard XPS floor', d:'Water-resistant rigid board under the floor: about 8% less winter heating and no damp from below.'},
  // links and concepts
  {k:'stack', kind:'link', g:'Concepts', t:'Stack homes 2 to 4 storeys', d:'Homes stacked and offset like the block studies. Open Cluster and choose storeys; needs the stackable frame.'},
  {k:'grow', kind:'info', g:'Concepts', t:'Grow over time', d:'Start with two modules and add a third later, upstairs or beside, for a child, a studio or a small shop. The extra door in Furnish is the connection point.'},
  {k:'modes', kind:'info', g:'Concepts', t:'Convertible furniture', d:'Fold-out dining, fold-down bed, mobile side table: one room, several uses. The daybed, wall bed, fold-down table and pull-out kitchen table do this.'},
  {k:'inhabited', kind:'info', g:'Concepts', t:'Inhabited walls', d:'Kitchen, storage, bed and desk packed into thick walls so the centre stays open. The storage wall and wall bed follow this idea.'},
  {k:'modulor', kind:'info', g:'Concepts', t:'Modulor and ergonomic heights', d:'Le Corbusier’s body-based heights: 43 cm seats and platform, 70 cm desk, 86 cm counter, 113 cm leaning, 183 cm high shelf, 226 cm reach. The fittings here follow them closely.'},
  {k:'split', kind:'info', g:'Concepts', t:'Step-down living', d:'A change in level divides the room without walls. The raised sleeping platform does this.'},
  {k:'angled', kind:'info', g:'Concepts', t:'Angled walls', d:'Turning the bedroom wall on a diagonal gives a longer view and a bigger bed corner. It suits site-built rooms more than factory modules.'},
  {k:'spiral', kind:'info', g:'Concepts', t:'Spiral stair and glass floor', d:'For stacked homes, a spiral stair and glass floor panels bring light down through the levels.'},
  {k:'floating', kind:'info', g:'Concepts', t:'Floating base for floods', d:'The steel floor frame can sit on sealed floats so the home rises with flood water. For flood plains, with an engineer’s design.'},
  {k:'pinwheel', kind:'info', g:'Concepts', t:'Pinwheel and rhombic tiling', d:'Your studies: one shape turned four ways tiles without gaps, and rhombic modules make rings and chains. The Cluster tab interlocks your modules the same way.'},
  {k:'aframe', kind:'info', g:'Concepts', t:'A-frame and 45° roof', d:'A steep roof from near the ground gives a tall room with a loft and a big rain and solar surface. The gable roof and loft bed get close to this.'},
  {k:'deploy', kind:'info', g:'Concepts', t:'Deployable shelters', d:'Fan-folding yurts and expanding caravans unfold to several times their size. The fold-out wings bring this to the home.'},
  {k:'radial', kind:'info', g:'Concepts', t:'Fan and rotated plans', d:'Rooms on radial lines or a bed turned on a diagonal give longer views. They suit site-built rooms more than factory modules.'},
  {k:'hex', kind:'info', g:'Concepts', t:'Hexagonal tiling', d:'Slanted modules can tile like a honeycomb. It needs slanted modules; the main design uses rectangles.'},
];
function ideaOn(k) { const I = S.spec.ideas || {}, it = IDEAS.find(x => x.k === k); if (it.kind === 'item') return S.items.some(i => i.type === k); return !!I[k]; }
function ideaPrice(k) { const it = IDEAS.find(x => x.k === k); if (it.kind === 'item') return money(itemCost(newItem(k))); const keep = JSON.stringify(S.spec.ideas || {}); S.spec.ideas = Object.assign({}, S.spec.ideas, {[k]:false}); const off = costs(G.geo).total; S.spec.ideas = Object.assign({}, S.spec.ideas, {[k]:true}); const on = costs(G.geo).total; S.spec.ideas = JSON.parse(keep); return '+' + money(on - off); }
function toggleIdea(k) {
  const it = IDEAS.find(x => x.k === k); snapshot();
  if (it.kind === 'link') { goTab('cluster'); return; }
  if (it.kind === 'item') {
    if (ideaOn(k)) { S.items = S.items.filter(i => i.type !== k); commit(); toast('Removed ' + it.t.toLowerCase()); return; }
    if (CAT[k].needsGable && S.shape.roof !== 'gable') { S.shape.roof = 'gable'; toast('Switched to the gable roof for headroom'); }
    const sp = findSpot(k); if (!sp) { toast('No free wall for the ' + it.t.toLowerCase() + '. Try Arrange furniture after adding it.'); S.items.push(newItem(k, {x:G.geo.bbox[0] + 1500, y:G.geo.bbox[1] + 1500})); G.motion = true; commit(true); return; }
    const n = newItem(k, sp); S.items.push(n); G.sel = {kind:'item', id:n.id}; G.motion = true; commit(true); toast('Added ' + it.t.toLowerCase()); return;
  }
  S.spec.ideas = Object.assign({}, S.spec.ideas, {[k]:!(S.spec.ideas || {})[k]});
  if (k === 'stilts') { S.site.rise = S.spec.ideas.stilts ? 2400 : 740; if (S.spec.ideas.stilts && S.site.entry === 'ramp') S.site.entry = 'steps'; }
  G.anim3D = 'walls'; commit(true); toast((S.spec.ideas[k] ? 'Added ' : 'Removed ') + it.t.toLowerCase());
}

/* ======================= CLUSTER ======================= */
// Interlock copies of a home: try every rotation and mirror, snapping corners together,
// and keep the placement that shares the most wall while staying compact.
function clusterLayout(st, n) {
  const geo = buildGeo(st.shape), base = geo.mods.map(m => m.poly);
  const c0 = centroid(base.flat ? base.flat() : [].concat(...base));
  const mods0 = base.map(P => P.map(p => [p[0] - c0[0], p[1] - c0[1]]));
  const O = []; [1, -1].forEach(mir => [0, 90, 180, 270].forEach(r => O.push({mir, r})));
  const xf = (p, o, t) => { const a = o.r * Math.PI / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)), x = p[0] * o.mir, y = p[1]; return [x * c - y * s + t[0], x * s + y * c + t[1]]; };
  const edgesOf = P => P.map((a, i) => [a, P[(i + 1) % P.length]]);
  const shared = (A, B) => { let L = 0;
    for (const P of A) for (const [a, b] of edgesOf(P)) { const u = sub(b, a), lu = len(u); if (lu < 1) continue; const un = mul(u, 1 / lu);
      for (const Q of B) for (const [c, d] of edgesOf(Q)) { const v = sub(d, c); if (Math.abs(un[0] * v[1] - un[1] * v[0]) > 1e-3 * len(v)) continue;
        if (Math.abs(un[0] * (c[1] - a[1]) - un[1] * (c[0] - a[0])) > 3) continue;
        const t1 = dot(sub(c, a), un), t2 = dot(sub(d, a), un), lo = Math.max(0, Math.min(t1, t2)), hi = Math.min(lu, Math.max(t1, t2)); if (hi > lo) L += hi - lo; } }
    return L; };
  // points just outside every door and window; doors must stay open to the outside, windows preferably too
  const outPts = kind => (st.openings || []).filter(o => kind === 'door' ? OPN[o.type].kind === 'door' : OPN[o.type].kind !== 'door').map(o => { const f = opFrame(geo, o); if (!f) return null; const m = mul(add(f.a, f.b), .5); return sub(add(m, mul(f.e.n, -400)), c0); }).filter(Boolean);
  const doors0 = outPts('door'), wins0 = outPts('win');
  const homes = [{o:O[0], t:[0, 0], polys:mods0, doors:doors0, wins:wins0}];
  let sharedTotal = 0;
  for (let k = 1; k < n; k++) {
    const all = homes.flatMap(h => h.polys), key = new Set(), verts = [];
    all.flat().forEach(p => { const kk = Math.round(p[0]) + ',' + Math.round(p[1]); if (!key.has(kk)) { key.add(kk); verts.push(p); } });
    const cc = centroid(all.flat()); let best = null;
    for (const o of O) { const po = mods0.map(P => P.map(p => xf(p, o, [0, 0]))), vo = po.flat();
      for (const vp of verts) for (const vn of vo) {
        const t = sub(vp, vn), polys = po.map(P => P.map(p => add(p, t)));
        if (polys.some(P => all.some(Q => overlap(P, Q, 5)))) continue;
        const dn = doors0.map(p => add(xf(p, o, [0, 0]), t)), wn = wins0.map(p => add(xf(p, o, [0, 0]), t));
        if (dn.some(p => all.some(Q => inPoly(p, Q))) || homes.some(hm => hm.doors.some(p => polys.some(Q => inPoly(p, Q))))) continue;
        const winHit = wn.filter(p => all.some(Q => inPoly(p, Q))).length + homes.reduce((k, hm) => k + hm.wins.filter(p => polys.some(Q => inPoly(p, Q))).length, 0);
        const sh = shared(polys, all); if (sh < 800) continue;
        const cen = centroid(polys.flat()), d = Math.hypot(cen[0] - cc[0], cen[1] - cc[1]);
        let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; for (const P of [...all, ...polys]) for (const q of P) { if (q[0] < bx0) bx0 = q[0]; if (q[0] > bx1) bx1 = q[0]; if (q[1] < by0) by0 = q[1]; if (q[1] > by1) by1 = q[1]; }
        const bw = bx1 - bx0, bh = by1 - by0;
        const sc = sh - (bw + bh) * .7 - Math.abs(bw - bh) * .5 - d * .15 - winHit * 900;
        if (!best || sc > best.sc) best = {sc, sh, o, t, polys, dn, wn};
      } }
    if (!best) break;
    homes.push({o:best.o, t:best.t, polys:best.polys, doors:best.dn, wins:best.wn}); sharedTotal += best.sh;
  }
  return {homes, geo, c0, shared:sharedTotal};
}
function clusterSVG(st, cl, opts = {}) {
  const pts = cl.homes.flatMap(h => h.polys.flat()), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const pad = 700, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const inner = planMarkup(st, cl.geo, {mini:true});
  let g = '';
  cl.homes.forEach((hm, i) => { const a = hm.o.r * Math.PI / 180, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a)), m = hm.o.mir;
    const tx = hm.t[0] - (c * m * cl.c0[0] - sn * cl.c0[1]), ty = hm.t[1] - (sn * m * cl.c0[0] + c * cl.c0[1]);
    g += `<g class="cl-home" style="--i:${i}"><g transform="matrix(${c * m} ${sn * m} ${-sn} ${c} ${tx.toFixed(1)} ${ty.toFixed(1)})">${inner}</g>`;
    g += hm.polys.map(P => `<polygon class="cl-out${i === 0 ? ' first' : ''}" points="${P.map(p => p[0].toFixed(0) + ',' + p[1].toFixed(0)).join(' ')}"/>`).join('');
    const cen = centroid(hm.polys.flat()); if (opts.labels !== false) g += `<text class="cl-num" x="${cen[0].toFixed(0)}" y="${(cen[1] + 160).toFixed(0)}" text-anchor="middle">${i + 1}</text>`;
    g += `</g>`; });
  return `<svg class="cl-svg" viewBox="${x0.toFixed(0)} ${y0.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" role="img" aria-label="${cl.homes.length} homes interlocked">${g}</svg>`;
}
function clusterStats(st, cl) {
  const n = cl.homes.length, unit = costs(cl.geo).total, P = S.prices;
  const save = (n - 1) * ((P.crane || 450) + (P.crew || 500)) * .5;
  const pts = cl.homes.flatMap(h => h.polys.flat()), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const site = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) / 1e6;
  return {n, area:cl.geo.area * n, unit, total:unit * n - save, save, site, shared:cl.shared / 1000};
}

/* ======================= COMPASS ======================= */
function renderCompass() {
  const n = ((+S.site.north || 0) % 360 + 360) % 360, nd = $('#cpNeedle'), dg = $('#cpDeg');
  if (nd) nd.setAttribute('transform', `rotate(${-n})`);
  if (dg) dg.textContent = `${n}°`;
  const c = $('#compass'); if (c) c.setAttribute('aria-valuenow', n);
}
function setNorth(v, live) {
  S.site.north = ((Math.round(v) % 360) + 360) % 360; renderCompass();
  if (live) { if (V3.ok) build3D(); return; }
  commit(G.tab === 'shape');
}
function initCompass() {
  const c = $('#compass'); if (!c) return;
  const ticks = c.querySelector('.cp-ticks'); if (ticks) ticks.innerHTML = [...Array(12)].map((_, k) => `<line x1="0" y1="-46" x2="0" y2="${k % 3 ? -41 : -38}" stroke="var(--steel)" stroke-width="${k % 3 ? 1.5 : 2.5}" transform="rotate(${k * 30})"/>`).join('');
  let st = null;
  const ang = e => { const r = c.querySelector('svg').getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2); return Math.atan2(x, -y) * 180 / Math.PI; };
  c.addEventListener('pointerdown', e => { e.preventDefault(); c.setPointerCapture(e.pointerId); st = {x:e.clientX, y:e.clientY, moved:false, before:JSON.stringify(S)}; });
  c.addEventListener('pointermove', e => { if (!st) return;
    if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return;
    st.moved = true; c.classList.add('drag');
    let a = -ang(e); const snap = e.shiftKey ? 15 : 5; setNorth(Math.round(a / snap) * snap, true); });
  const up = e => { if (!st) return; c.classList.remove('drag');
    if (st.moved) { G.hist.push(st.before); G.fut = []; setNorth(S.site.north); toast(`Plan top now faces ${DIRS[Math.round(S.site.north / 45) % 8]}`); }
    else { snapshot(); setNorth(Math.floor((+S.site.north || 0) / 45) * 45 + 45); }
    st = null; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); snapshot(); setNorth((+S.site.north || 0) + (e.key === 'ArrowRight' ? -5 : 5)); } });
  renderCompass();
}

function completeForTwo() {
  const miss = readyForTwo().filter(x => !x.ok && x.add && x.add !== 'storefill');
  const P = S.program;
  miss.forEach(x => { const a = x.add;
    if (a === 'washer') P.washer = true; else if (a === 'pantry') P.pantry = true; else if (a === 'getabako') P.getabako = true; else if (a === 'cleaning') P.cleaning = true;
    else if (a === 'bins') P.bins = true; else if (a === 'dryrack') P.dryrack = true; else if (['wardrobe', 'oshiire', 'jang'].includes(a)) P.wardrobe = true;
    else if (a === 'fridge') P.fridgeTall = true; else if (['dining', 'kotatsu', 'soban'].includes(a)) P.dining = true; else if (a === 'sofa' && P.sofa === 'none') P.sofa = 'sofa'; });
  const f = autoArrange('furn'); G.motion = true; commit(true);
  const still = readyForTwo().filter(x => !x.ok && x.add !== 'storefill');
  toast(still.length ? 'Added what fits. Still missing: ' + still.map(x => x.k.toLowerCase()).join(', ') : 'Everything a couple needs is in');
}

/* ======================= SMART MENU ======================= */
const isPhone = () => matchMedia('(max-width:880px)').matches;
function switchView(v) {
  $('#app').dataset.view = v; [...$('#mnav').children].forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v));
  if (v === 'plan') { fitView(); renderPlan(); } if (v === '3d') setTimeout(() => reset3D(), 60); if (V3.ok) V3.need = true;
}
function goTab(tab) { G.tab = tab; renderRail(); renderPanel(); $('#panel').scrollTop = 0; if (isPhone()) switchView('edit'); }
function runAuto(mode) { snapshot(); const f = autoArrange(mode); G.sel = null; G.motion = true; commit(true); toast(f.length ? 'Could not fit: ' + f.map(t => CAT[t] ? CAT[t].label.toLowerCase() : t).join(', ') : 'Arranged'); if (isPhone()) switchView('plan'); }
function smartSuggestions() {
  const out = [], v = G.val, geo = G.geo, push = (sev, label, sub, run) => out.push({sev, label, sub, run});
  const has = (...t) => S.items.some(i => t.includes(i.type));
  if (!S.openings.some(o => OPN[o.type].kind === 'door')) push('bad', 'Add an entry door', 'Every home needs one', () => addOpening('door'));
  const lim = S.site.limit || 0;
  if (lim && geo.area > lim + 1e-4) push('bad', `Shrink to fit ${lim} m²`, `Now ${geo.area.toFixed(1)} m²`, () => { snapshot(); fit25(); G.motion = true; commit(true); });
  const miss = [];
  if (!has('bed160', 'bed140', 'bed90', 'tatamibed', 'platformbed', 'wallbed', 'sofabed')) miss.push('bed'); if (!has('kitchen')) miss.push('kitchen');
  if (!has('toilet', 'wc', 'acctoilet')) miss.push('toilet'); if (!has('shower', 'bath', 'ofuro', 'accshower')) miss.push('shower');
  if (miss.length) push('bad', 'Add what is missing', miss.join(', '), () => runAuto('furn'));
  if (v.checks.some(c => c.state === 'bad' && /from an exit/.test(c.text))) push('bad', 'Move the bed away from the exit', `Keep at least ${BED_EXIT_MIN / 1000} m clear`, () => runAuto('furn'));
  const nb = Object.values(v.items).filter(a => a.length).length + Object.values(v.ops).filter(a => a.length).length;
  if (nb) push('bad', 'Fix pieces with red outlines', `${nb} overlap or block a door`, () => runAuto('furn'));
  { const r2 = readyForTwo().filter(x => !x.ok && x.add && x.add !== 'storefill'); if (r2.length) push('warn', 'Complete the home for two', 'Missing: ' + r2.map(x => x.k.toLowerCase()).join(', '), () => { snapshot(); completeForTwo(); }); }
  if (storageLitres() < STORE_TARGET) push('warn', 'Add more storage', `${storageLitres().toLocaleString('en-US')} L of ${STORE_TARGET.toLocaleString('en-US')} L for two people`, () => { snapshot(); const n = fillStorage(G.geo); G.motion = true; commit(true); toast(n ? `Added ${n} storage piece${n > 1 ? 's' : ''}` : 'No free wall left for more storage'); });
  if (!has('energy')) push('warn', 'Add an energy cabinet', 'For the batteries and inverter', () => addItem('energy'));
  const br = bracing(geo); if (br.x < 2 || br.y < 2) push('warn', 'Keep two solid walls each way', 'The steel bracing needs them', () => goTab('openings'));
  if (v.checks.some(c => /Hard to reach/.test(c.text))) push('warn', 'Clear the walkways', 'Some furniture blocks the path', () => runAuto('furn'));
  const left = (S.unplaced || []).filter(t => CAT[t] && !S.items.some(i => i.type === t));
  if (left.length) push('warn', 'Find a layout that fits everything', 'Left out: ' + left.map(t => CAT[t].label.toLowerCase()).join(', '), () => { goTab('layouts'); startVariants(); });
  const sun = sunCheck(geo); if (sun && !sun.ok) push('warn', 'Turn the big glass toward the sun', sun.text, () => goTab('shape'));
  const og = offgrid();
  if (og.days < 1.5) push('warn', 'Battery lasts under 2 days', `${og.days.toFixed(1)} days without sun`, () => goTab('systems'));
  if (og.wdays < 14) push('warn', 'Water storage is low', `${og.wdays.toFixed(0)} days of water`, () => goTab('systems'));
  if (!out.some(x => x.sev === 'bad')) push('go', 'Request a quote', 'Get a fixed price for this design', openQuote);
  push('go', 'Lowest possible price', 'Cheapest materials and right-sized systems', () => { snapshot(); const v2 = cheapest(); G.motion = true; commit(true); toast(v2 > 1 ? `Saved ${money(v2)}` : 'Already at the lowest price'); });
  const sv = (G.savers || [])[0]; if (sv) push('go', `Save ${money(sv.save)}`, sv.label, () => { snapshot(); sv.fn(); G.motion = true; commit(true); toast('Applied, saves ' + money(sv.save)); });
  push('go', 'Find better arrangements', 'Ranked by privacy, walkways, light and cost', () => { goTab('layouts'); startVariants(); });
  return out;
}
function smartCommands() {
  const c = [], add = (grp, label, sub, run, kw = '', kb = '') => c.push({grp, label, sub, run, kw:(label + ' ' + kw + ' ' + (sub || '')).toLowerCase(), kb});
  TABS.forEach(([k, l]) => add('Go to', l, null, () => goTab(k), 'tab panel open'));
  if (isPhone()) { add('Go to', 'Plan', null, () => switchView('plan'), 'view'); add('Go to', '3D view', null, () => switchView('3d'), 'view three'); add('Go to', 'Costs', null, () => switchView('cost'), 'view price money'); }
  add('Actions', 'Arrange furniture', 'Keeps doors and windows', () => runAuto('furn'), 'auto arrange place');
  add('Actions', 'Re-plan everything', 'Doors, windows and furniture', () => runAuto('all'), 'auto reset');
  add('Actions', 'Find better arrangements', null, () => { goTab('layouts'); startVariants(); }, 'variants options layout');
  add('Actions', 'Zoom in', null, () => zoomPlan(.8), 'bigger closer plus'); add('Actions', 'Zoom out', null, () => zoomPlan(1.25), 'smaller minus');
  add('Actions', 'Turn north 45°', null, () => { snapshot(); setNorth((+S.site.north || 0) + 45); }, 'compass rotate orientation sun');
  add('Actions', 'Fit plan to screen', null, () => { if (isPhone()) switchView('plan'); const tv = G.view; fitView(); const to = G.view; G.view = tv; animateView(to); }, 'zoom');
  add('Actions', 'Undo', null, undo, '', 'Ctrl Z'); add('Actions', 'Redo', null, redo, '', 'Ctrl Y');
  add('Actions', 'Flip left and right', null, () => { snapshot(); mirror('x'); G.view = null; G.motion = true; commit(true); fitView(); renderPlan(); reset3D(); }, 'mirror');
  add('Actions', 'Flip top and bottom', null, () => { snapshot(); mirror('y'); G.view = null; G.motion = true; commit(true); fitView(); renderPlan(); reset3D(); }, 'mirror');
  add('Actions', G.roof ? 'Hide the roof' : 'Show the roof and solar panels', null, () => { $('#roofBtn').click(); if (isPhone()) switchView('3d'); }, '3d');
  add('Actions', G.frame ? 'Hide the steel frame' : 'Show the steel frame', null, () => { $('#frameBtn').click(); if (isPhone()) switchView('3d'); }, '3d structure');
  add('Actions', 'Switch light or dark', null, () => $('#themeBtn').click(), 'theme night');
  add('Actions', 'Save or share this design', null, openDesigns, 'designs load code');
  add('Actions', 'Print summary', null, () => { buildPrint(); window.print(); }, 'pdf');
  add('Actions', 'Request a quote', null, openQuote, 'price buy order contact');
  add('Go to', 'Home page', null, () => showSite(), 'site landing');
  add('Actions', 'Tips and shortcuts', null, openHelp, 'help keyboard');
  Object.keys(OPN).forEach(k => add('Add', OPN[k].label, `${OPN[k].w} × ${OPN[k].h} mm`, () => { addOpening(k); if (isPhone()) switchView('plan'); }, 'opening wall'));
  Object.keys(CAT).forEach(k => add('Add', CAT[k].label, money(itemCost(newItem(k, k === 'kitchen' ? {w:S.program.kitchen} : {}))), () => { addItem(k); if (isPhone()) switchView('plan'); }, CAT[k].grp + ' furniture'));
  return c;
}
const SM = {list:[], idx:-1};
function openSmart() { const d = $('#smart'); G.smQ = '';
  d.innerHTML = `<div class="sm-head"><input type="search" id="smQ" placeholder="Search actions or furniture" autocomplete="off" aria-label="Search actions or furniture"><button class="btn small" data-sm="close">Close</button></div><div class="sm-body" id="smBody"></div>`;
  renderSmart(); if (!d.open) d.showModal(); if (!isPhone()) setTimeout(() => $('#smQ').focus(), 30); }
function renderSmart() {
  const q = (G.smQ || '').trim().toLowerCase(), body = $('#smBody'); SM.list = []; SM.idx = -1;
  const row = (ic, cls, label, sub, run, kb) => { const i = SM.list.length; SM.list.push(run);
    return `<button class="sm-item" data-smi="${i}"><span class="ic ${cls}">${ic}</span><span class="tx">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="kb">${kb || ''}</span></button>`; };
  let h = '';
  if (!q) {
    if (G.sel) {
      if (G.sel.kind === 'item') { const it = S.items.find(i => i.id === G.sel.id);
        if (it) { const act = a => () => { const b = $(`#inspector [data-ia="${a}"]`); if (b) b.click(); };
          h += `<div class="sm-sel"><b>Selected: ${esc(CAT[it.type].label)}</b><div class="row">${[['rotR', 'Turn'], ['wall', 'Back to wall'], ['dup', 'Duplicate'], ['del', 'Remove']].filter(([a]) => a !== 'wall' || CAT[it.type].wall).map(([a, l]) => { const i = SM.list.length; SM.list.push(act(a)); return `<button class="sm-chip" data-smi="${i}">${l}</button>`; }).join('')}${(() => { const i = SM.list.length; SM.list.push(() => { snapshot(); it.lock = !it.lock; commit(); }); return `<button class="sm-chip" data-smi="${i}">${it.lock ? 'Unlock' : 'Lock in place'}</button>`; })()}</div></div>`; } }
      else { const o = S.openings.find(x => x.id === G.sel.id);
        if (o) { const set = (k, v) => () => { snapshot(); o[k] = v; commit(); };
          const chips = [['Remove', removeSel]]; if (OPN[o.type].kind === 'door') chips.unshift(['Hinge other side', set('hinge', o.hinge === 'R' ? 'L' : 'R')], [o.swing === 'in' ? 'Open outward' : 'Open inward', set('swing', o.swing === 'in' ? 'out' : 'in')]);
          h += `<div class="sm-sel"><b>Selected: ${esc(OPN[o.type].label)}</b><div class="row">${chips.map(([l, f]) => { const i = SM.list.length; SM.list.push(f); return `<button class="sm-chip" data-smi="${i}">${l}</button>`; }).join('')}</div></div>`; } }
    }
    const sg = smartSuggestions();
    h += `<div class="sm-grp">Suggested next</div>` + sg.map(x => row(x.sev === 'bad' ? '!' : x.sev === 'warn' ? '•' : '→', x.sev, x.label, x.sub, x.run)).join('');
    h += `<div class="sm-grp">Quick add</div><div class="sm-chips">${[['bed160', 'Bed'], ['sofa', 'Sofa'], ['dining', 'Table'], ['desk', 'Desk'], ['wardrobe', 'Wardrobe'], ['kitchen', 'Kitchen'], ['shower', 'Shower'], ['toilet', 'Toilet'], ['partition', 'Inside wall']].map(([k, l]) => { const i = SM.list.length; SM.list.push(() => { addItem(k); if (isPhone()) switchView('plan'); }); return `<button class="sm-chip" data-smi="${i}">${l}</button>`; }).join('')}${[['win_m', 'Window'], ['door', 'Door']].map(([k, l]) => { const i = SM.list.length; SM.list.push(() => { addOpening(k); if (isPhone()) switchView('plan'); }); return `<button class="sm-chip" data-smi="${i}">${l}</button>`; }).join('')}</div>`;
    const cmds = smartCommands().filter(c => c.grp !== 'Add');
    ['Go to', 'Actions'].forEach(gname => { h += `<div class="sm-grp">${gname}</div>` + cmds.filter(c => c.grp === gname).map(c => row(gname === 'Go to' ? '↗' : '⌁', '', c.label, c.sub, c.run, c.kb)).join(''); });
  } else {
    const words = q.split(/\s+/), hits = smartCommands().filter(c => words.every(w => c.kw.includes(w)));
    if (!hits.length) h = `<div class="sm-empty">Nothing matches “${esc(G.smQ)}”. Try “sofa”, “window” or “roof”.</div>`;
    else ['Add', 'Actions', 'Go to'].forEach(gname => { const g = hits.filter(c => c.grp === gname).slice(0, 14); if (g.length) h += `<div class="sm-grp">${gname}</div>` + g.map(c => row(gname === 'Add' ? '+' : gname === 'Go to' ? '↗' : '⌁', gname === 'Add' ? 'go' : '', c.label, c.sub, c.run, c.kb)).join(''); });
  }
  body.innerHTML = h;
  if (q) { SM.idx = 0; const f = body.querySelector('.sm-item'); if (f) f.classList.add('on'); }
}
function initSmart() {
  const d = $('#smart');
  $('#smartBtn').onclick = openSmart;
  d.addEventListener('click', e => {
    if (e.target === d) { d.close(); return; }
    const b = e.target.closest('[data-smi],[data-sm]'); if (!b) return;
    if (b.dataset.sm === 'close') { d.close(); return; }
    const fn = SM.list[+b.dataset.smi]; d.close(); if (fn) setTimeout(fn, 10);
  });
  d.addEventListener('input', e => { if (e.target.id === 'smQ') { G.smQ = e.target.value; renderSmart(); } });
  d.addEventListener('keydown', e => {
    const its = [...d.querySelectorAll('.sm-item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!its.length) return; SM.idx = (SM.idx + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length; its.forEach((x, i) => x.classList.toggle('on', i === SM.idx)); its[SM.idx].scrollIntoView({block:'nearest'}); }
    else if (e.key === 'Enter' && e.target.id === 'smQ') { e.preventDefault(); const el = its[Math.max(0, SM.idx)]; if (el) el.click(); }
  });
  window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); d.open ? d.close() : openSmart(); } });
}
function updateBadge() {
  const n = smartSuggestions().filter(x => x.sev === 'bad').length, b = $('#smartBadge');
  if (!b) return; b.hidden = !n; b.textContent = n;
}

/* ======================= PRODUCT: CONFIG ======================= */
// Edit these for your business. Leave email empty to hide the email option.
// quoteEndpoint: a form service URL that accepts a JSON POST (only works when you host the page yourself).
const BRAND = Object.assign({name:'Microhome', email:'', quoteEndpoint:''}, window.MICROHOME_CONFIG || {});

/* ======================= FILES ======================= */
async function saveFile(name, text, mime) {
  try {
    if (window.claude && window.claude.use) {
      const dl = await window.claude.use('downloads');
      if (!dl) { toast('Saving files is not available here. Copy the design code instead.'); return false; }
      await dl.save({filename:name, data:new Blob([text], {type:mime})}); return true;
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type:mime})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return true;
  } catch (e) { if (e && e.code !== 'declined') toast('The file could not be saved.'); return false; }
}
function designSummary() {
  const g = G.geo, c = costs(g), cnt = {}; S.items.forEach(i => { if (i.type !== 'partition') cnt[CAT[i.type].label] = (cnt[CAT[i.type].label] || 0) + 1; });
  return {area:g.area, modules:g.mods.map(m => `${m.name} ${(polyArea(m.poly) / 1e6).toFixed(2)} m²`), total:c.total, perM2:c.total / Math.max(g.area, 1), trucks:c.trucks.n,
    openings:S.openings.map(o => `${OPN[o.type].label} ${o.w} mm`), items:Object.entries(cnt).map(([k, v]) => v > 1 ? `${k} × ${v}` : k),
    finishes:`${S.spec.frame === 'stack' ? 'Stackable' : 'Single-storey'} frame, ${S.spec.cladding} cladding, ${S.spec.glazing} glazing, ${S.spec.finish} floor`,
    systems:`Solar ${S.sys.pv} kWp, battery ${S.sys.batt} kWh, rain cistern ${S.sys.cisternL} L${S.sys.tank ? `, ${S.sys.tankL} L tank under the bed` : ''}`};
}
function summaryText(q) {
  const d = designSummary();
  return [`# Quote request${q ? ' from ' + q.name : ''}`, q ? `\nName: ${q.name}\nEmail: ${q.email}\nPhone: ${q.phone || '-'}\nBuilding in: ${q.where}\nTimeline: ${q.when}\nUse: ${q.use}\nNotes: ${q.notes || '-'}\nReference: ${q.ref}` : '',
    `\n## Design: ${S.name}`, `Floor area: ${d.area.toFixed(1)} m²`, `Modules: ${d.modules.join('; ')}`, `Estimated price: ${money(d.total)} (${money(d.perM2)} per m²), ${d.trucks} truck${d.trucks > 1 ? 's' : ''}, ${S.site.km} km from the factory`,
    `Finishes: ${d.finishes}`, `Systems: ${d.systems}`, `Doors and windows: ${d.openings.join(', ')}`, `Furniture and fittings: ${d.items.join(', ')}`,
    `\nDesign code (paste into Designs, Open pasted code):\n${btoa(unescape(encodeURIComponent(JSON.stringify(S))))}`].join('\n');
}

/* ======================= QUOTE REQUEST ======================= */
function openQuote() {
  const d = $('#dlg'), sm = designSummary(), prev = (() => { try { return JSON.parse(localStorage.getItem('mhb-contact') || '{}'); } catch (e) { return {}; } })();
  const issues = G.val.checks.filter(c => c.state === 'bad').length;
  d.innerHTML = `<h3>Request a quote</h3><p class="note" style="margin:-4px 0 10px">We confirm a fixed price for this exact design and your site. No obligation.</p>
  <div class="qsum"><b>${esc(S.name)}</b> · ${sm.area.toFixed(1)} m² · ${sm.modules.length} modules · estimated ${money(sm.total)}${issues ? `<br><span style="color:var(--warn)">The design still has ${issues} problem${issues > 1 ? 's' : ''}. You can send it anyway, we will help fix ${issues > 1 ? 'them' : 'it'}.</span>` : ''}</div>
  <form class="qform" id="qform" novalidate>
    <div class="qrow"><label>Name<input name="name" autocomplete="name" required value="${esc(prev.name || '')}"></label><label>Email<input name="email" type="email" autocomplete="email" required value="${esc(prev.email || '')}"></label></div>
    <div class="qrow"><label>Phone, optional<input name="phone" type="tel" autocomplete="tel" value="${esc(prev.phone || '')}"></label><label>Where will you build?<input name="where" placeholder="Town and country" required value="${esc(prev.where || '')}"></label></div>
    <div class="qrow"><label>When?<select name="when"><option>Within 6 months</option><option>6 to 12 months</option><option>Later than a year</option><option>Just exploring</option></select></label>
    <label>Main use<select name="use"><option>Home to live in</option><option>Holiday or weekend home</option><option>Rental</option><option>Office or studio</option><option>Other</option></select></label></div>
    <label>Anything else we should know?<textarea name="notes" placeholder="Site access, slope, utilities, questions"></textarea></label>
    <label class="check" style="font-weight:400"><input type="checkbox" name="ok" required> I agree to be contacted about this request.</label>
    <div class="qerr" id="qerr" role="alert"></div>
    <div style="display:flex; gap:8px; flex-wrap:wrap"><button class="btn primary" type="submit">Send request</button><button class="btn ghost" type="button" data-d="close">Cancel</button></div>
  </form>`;
  if (!d.open) d.showModal();
  $('#qform').addEventListener('submit', sendQuote);
}
async function sendQuote(e) {
  e.preventDefault();
  const f = e.target, v = Object.fromEntries(new FormData(f).entries()), err = $('#qerr');
  if (!v.name || !v.name.trim()) { err.textContent = 'Please add your name.'; f.name.focus(); return; }
  if (!/^\S+@\S+\.\S+$/.test(v.email || '')) { err.textContent = 'Please add a valid email address.'; f.email.focus(); return; }
  if (!v.where || !v.where.trim()) { err.textContent = 'Please say where you plan to build.'; f.where.focus(); return; }
  if (!v.ok) { err.textContent = 'Please tick the box so we can contact you.'; return; }
  const q = Object.assign(v, {ref:'MH-' + Date.now().toString(36).toUpperCase().slice(-6)});
  try { localStorage.setItem('mhb-contact', JSON.stringify({name:q.name, email:q.email, phone:q.phone, where:q.where})); } catch (er) {}
  const text = summaryText(q);
  let sent = false;
  if (BRAND.quoteEndpoint) {
    const sm = designSummary();
    const payload = {_subject:`Quote request ${q.ref} from ${q.name}`, _replyto:q.email, _template:'table', _captcha:'false',
      name:q.name, email:q.email, phone:q.phone || '-', building_in:q.where, timeline:q.when, use:q.use, notes:q.notes || '-', reference:q.ref,
      floor_area:`${sm.area.toFixed(1)} m²`, estimated_price:money(sm.total), modules:sm.modules.join('; '), full_request:text};
    try { const r = await fetch(BRAND.quoteEndpoint, {method:'POST', headers:{'Content-Type':'application/json', 'Accept':'application/json'}, body:JSON.stringify(payload)}); sent = r.ok; } catch (er) {}
  }
  const d = $('#dlg');
  d.innerHTML = `<div class="qdone"><div class="tick">✓</div><h3>${sent ? 'Request sent' : 'Your request is ready'}</h3><p class="note">Reference <b>${q.ref}</b>. ${sent ? 'We will reply by email, usually within two working days.' : 'Send it to us using one of these.'}</p></div>
    <div style="display:grid; gap:8px">${!sent && BRAND.email ? `<a class="btn primary" style="text-align:center; text-decoration:none" href="mailto:${encodeURIComponent(BRAND.email)}?subject=${encodeURIComponent('Quote request ' + q.ref)}&body=${encodeURIComponent(text.slice(0, 1800) + (text.length > 1800 ? '\n\n(Full design file attached separately)' : ''))}">Email the request</a>` : ''}
    <button class="btn${!sent && !BRAND.email ? ' primary' : ''}" data-q="file">Download request and design</button><button class="btn" data-q="copy">Copy request text</button><button class="btn ghost" data-d="close">Done</button></div>`;
  d.onclick = async ev => { const b = ev.target.closest('[data-q]'); if (!b) return;
    if (b.dataset.q === 'file') { await saveFile(`${q.ref}-request.md`, text, 'text/markdown'); }
    if (b.dataset.q === 'copy') { try { await navigator.clipboard.writeText(text); toast('Request copied'); } catch (er) { toast('Copy did not work here. Use the download instead.'); } } };
}

/* ======================= PRINT ======================= */
function buildPrint() {
  const g = G.geo, c = costs(g), sm = designSummary(), vb = viewBoxFor(g, 900);
  $('#printSheet').innerHTML = `<h1>${esc(S.name)}</h1><div class="pmeta">${sm.area.toFixed(1)} m² · ${g.mods.length} modules · ${sm.trucks} trucks · estimated ${money(c.total)} · ${new Date().toLocaleDateString()}</div>
    <svg viewBox="${vb.join(' ')}">${planMarkup(S, g, {dims:true, mini:false})}</svg>
    <div class="pgrid"><div><h3>What’s in it</h3><p>${esc(sm.items.join(', '))}</p><p><b>Doors and windows:</b> ${esc(sm.openings.join(', '))}</p><p><b>Finishes:</b> ${esc(sm.finishes)}</p><p><b>Systems:</b> ${esc(sm.systems)}</p></div>
    <div><h3>Estimated price</h3><table>${Object.entries(c.groups).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${money(v)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${money(c.total)}</b></td></tr></table>
    <p style="color:#666">Planning estimate based on typical factory-direct prices. Not an offer. A quote confirms the price for your design and site.</p></div></div>`;
}
window.addEventListener('beforeprint', () => { try { buildPrint(); } catch (e) {} });

/* ======================= WELCOME ======================= */
function maybeWelcome() {
  let seen = false; try { seen = !!localStorage.getItem('mhb-welcomed'); } catch (e) {}
  if (seen) return;
  try { localStorage.setItem('mhb-welcomed', '1'); } catch (e) {}
  const d = $('#dlg');
  d.innerHTML = `<h3>Welcome to the designer</h3><p class="note">This home is ready to live in. Change anything you like.</p>
    <div class="wsteps"><div><i>1</i><span><b>Pick a starting plan</b> in Layouts, or keep this one.</span></div>
    <div><i>2</i><span><b>Drag furniture, doors and windows</b> on the plan. The 3D view and price follow.</span></div>
    <div><i>3</i><span><b>Tap Menu</b> any time for suggestions, like fixing problems or the lowest price.</span></div>
    <div><i>4</i><span><b>Get a quote</b> when it looks right. Your design stays saved in this browser.</span></div></div>
    <p style="display:flex; gap:8px; flex-wrap:wrap"><button class="btn primary" data-d="close">Start designing</button><button class="btn" data-d="tips">See shortcuts</button></p>`;
  if (!d.open) d.showModal();
}

/* ======================= SITE ======================= */
function showSite(scrollTo) {
  document.body.classList.remove('mode-app'); document.body.classList.add('mode-site');
  if (heroTL) heroTL.resume(); if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 60);
  let saved = false; try { saved = !!localStorage.getItem('mhb-current'); } catch (e) {} $('#heroResume').hidden = !saved;
  renderSiteHomes(); if (scrollTo) setTimeout(() => goSection(scrollTo), 30);
}
function showApp() {
  if (document.body.classList.contains('mode-app')) return;
  document.body.classList.remove('mode-site'); document.body.classList.add('mode-app');
  if (heroTL) heroTL.pause();
  window.scrollTo(0, 0);
  requestAnimationFrame(() => { fitView(); G.motion = true; renderPlan(); ensure3D().then(() => { if (V3.ok) { V3.need = true; reset3D(true); } }); });
  setTimeout(maybeWelcome, 450);
}
function goSection(id) { const el = document.getElementById('s-' + id); if (el) el.scrollIntoView({behavior:RM ? 'auto' : 'smooth', block:'start'}); }
function renderSiteHomes() {
  const box = $('#siteHomes'); if (!box) return;
  const items = PRESET_GROUPS[0].items.map((p, i) => ({p, i}));
  box.innerHTML = items.map(({p, i}) => { const th = G.thumbs && G.thumbs[i]; if (th && th.cost == null) layCard(i);
    return `<button class="scard reveal${p.main ? ' main' : ''}" data-home="${i}">${th ? th.svg : '<div class="skel"></div>'}${p.main ? '<span class="badge">Our main design</span>' : ''}<b>${esc(p.name)}</b><span>${th ? `${th.area.toFixed(1)} m² · ${th.mods} modules · from ${money(th.cost)}` : 'Preparing…'}</span></button>`; }).join('');
  box.querySelectorAll('[data-it],[data-op]').forEach(el => { el.removeAttribute('data-it'); el.removeAttribute('data-op'); });
  observeReveal();
  const costsK = (G.thumbs || []).slice(0, PRESET_GROUPS[0].items.length).filter(t => t && t.cost != null).map(t => t.cost);
  const all = (G.thumbs || []).filter(t => t && t.cost != null && t.area <= 25.0001).map(t => t.cost);
  const min = all.length ? Math.min(...all) : null;
  const hf = $('#heroFrom'); if (hf) hf.innerHTML = min ? `Estimated from <b>${money(min)}</b>, factory-direct` : 'Estimated price shown as you design';
  heroBlueprint(); buildSiteCluster();
}
let heroTimer = null;
function heroPlansStatic() {
  const box = $('#heroPlan'); if (!box || !G.thumbs || !G.thumbs.length) return;
  const picks = [0, 4, 5, 2].filter(i => G.thumbs[i]);
  if (box.dataset.n == picks.length) return;
  box.dataset.n = picks.length;
  box.innerHTML = picks.map((i, k) => G.thumbs[i].svg.replace('<svg ', `<svg data-k="${k}" `)).join(''); box.querySelectorAll('[data-it],[data-op]').forEach(el => { el.removeAttribute('data-it'); el.removeAttribute('data-op'); });
  let k = 0; const tag = $('#heroTag');
  const show = () => { box.querySelectorAll('svg').forEach((s, j) => s.classList.toggle('on', j === k)); if (tag) tag.textContent = PRESETS[picks[k]].name; };
  show(); clearInterval(heroTimer); if (!RM) heroTimer = setInterval(() => { k = (k + 1) % picks.length; show(); }, 3800);
}
let revObs = null;
function observeReveal() {
  if (!('IntersectionObserver' in window) || RM) { document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')); return; }
  if (!revObs) revObs = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); revObs.unobserve(en.target); } }), {threshold:.12});
  document.querySelectorAll('.reveal:not(.in)').forEach(e => revObs.observe(e));
  clearTimeout(observeReveal.t); observeReveal.t = setTimeout(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')), 3500);
}
function initSite() {
  document.querySelectorAll('[data-brand]').forEach(e => e.textContent = BRAND.name);
  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
  if (!GS()) document.querySelectorAll('.ssec, .stats, .cta-band').forEach(e => e.classList.add('reveal'));
  $('#site').addEventListener('click', e => {
    const a = e.target.closest('[data-open-app],[data-go],[data-home]'); if (!a) return; e.preventDefault();
    if (a.dataset.go) { if (a.dataset.go === 'top') window.scrollTo({top:0, behavior:RM ? 'auto' : 'smooth'}); else goSection(a.dataset.go); return; }
    if (a.dataset.home != null) { const i = +a.dataset.home; wipeTo(() => { showApp(); setTimeout(() => { const card = document.querySelector(`[data-preset="${i}"]`); if (card) card.click(); }, 80); }); return; }
    wipeTo(showApp);
  });
  $('#toSite').onclick = () => wipeTo(() => showSite());
  $('#quoteBtn').onclick = openQuote;
  let saved = false; try { saved = !!localStorage.getItem('mhb-current'); } catch (e) {}
  if (saved) $('#heroResume').hidden = false;
  observeReveal();
  if (location.hash === '#design') showApp(); else showSite();
  initSiteMotion();
  window.addEventListener('hashchange', () => { if (location.hash === '#design') showApp(); });
  // refresh the site cards when thumbnails finish
  let n = -1; const tick = () => { const m = G.thumbs ? G.thumbs.filter(Boolean).length : 0; if (m !== n) { n = m; if (document.body.classList.contains('mode-site')) renderSiteHomes(); } if (!G.thumbs || m < PRESETS.length) setTimeout(tick, 700); };
  tick();
}

/* ======================= SITE MOTION ======================= */
const GS = () => (!RM && window.gsap) ? window.gsap : null;
let heroTL = null, heroIdx = 0;
function splitWords(el) {
  if (!el || el.dataset.split) return [];
  el.dataset.split = '1';
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/( +)/).forEach(p => { if (!p) return; if (/^ +$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
        const m = document.createElement('span'), i = document.createElement('span'); m.className = 'w-mask'; i.className = 'w-in'; i.textContent = p; m.appendChild(i); frag.appendChild(m); });
      n.replaceWith(frag);
    } else if (n.nodeType === 1) walk(n);
  });
  walk(el); return [...el.querySelectorAll('.w-in')];
}
function wipeTo(fn) {
  const g = GS(), w = $('#wipe'); if (!g || !w) { fn(); return; }
  g.timeline().set(w, {yPercent:100}).to(w, {yPercent:0, duration:.42, ease:'power3.in'})
    .add(() => fn()).to(w, {yPercent:-100, duration:.55, ease:'power3.out'}, '+=.1').set(w, {yPercent:100});
}
function heroBlueprint() {
  const box = $('#heroPlan'); if (!box || !G.thumbs) return;
  const picks = [0, 2, 3, 6].filter(i => G.thumbs[i] && G.thumbs[i].state);
  const g = GS();
  if (!g) { heroPlansStatic(); return; }
  if (!picks.length || box.dataset.bp) return; box.dataset.bp = '1';
  const play = () => {
    const i = picks[heroIdx++ % picks.length], st = G.thumbs[i].state, geo = buildGeo(st.shape), vb = viewBoxFor(geo, 820), sz = Math.max(vb[2], vb[3]);
    const vx = vb[0] - (sz - vb[2]) / 2, vy = vb[1] - (sz - vb[3]) / 2;
    let over = geo.mods.map((m, k) => `<polygon class="hp-out" data-m="${k}" pathLength="1" points="${pts(m.poly)}"/>`).join('');
    geo.mods.forEach(m => m.edges.filter(e => e.type === 'joint').forEach(e => [e.a, e.b].forEach(p => over += `<circle class="bolt" cx="${f1(p[0])}" cy="${f1(p[1])}" r="80"/>`)));
    box.innerHTML = `<svg viewBox="${vx} ${vy} ${sz} ${sz}" class="on" aria-hidden="true">${planMarkup(st, geo, {mini:true, dims:true})}<g>${over}</g></svg>`;
    const svg = box.querySelector('svg'), q = sel => svg.querySelectorAll(sel), tag = $('#heroTag');
    svg.querySelectorAll('[data-it],[data-op]').forEach(el => { el.removeAttribute('data-it'); el.removeAttribute('data-op'); });
    q('.dimline').forEach(l => l.setAttribute('pathLength', '1'));
    tag.textContent = PRESETS[i].name;
    if (heroTL) heroTL.kill();
    const tl = heroTL = g.timeline({onComplete:() => { heroTL = g.timeline().to({}, {duration:2.8}).to(svg, {opacity:0, duration:.6, ease:'power2.in'}).to(tag, {opacity:0, duration:.3}, '<').add(play); }});
    g.set(q('.wallfill, .floorfill, .floorwet'), {opacity:0}); g.set(tag, {opacity:0});
    tl.fromTo(q('.hp-out'), {strokeDasharray:1, strokeDashoffset:1}, {strokeDashoffset:0, duration:1.2, stagger:.16, ease:'power2.inOut'});
    geo.mods.forEach((m, k) => {
      const o = m.key.startsWith('LW') ? {x:-1100, y:0} : m.key.startsWith('RW') ? {x:1100, y:0} : {x:0, y:-900};
      tl.fromTo(q(`[data-m="${k}"]:not(.hp-out)`), {x:o.x, y:o.y, opacity:0}, {x:0, y:0, opacity:1, duration:.95, ease:'back.out(1.25)'}, k === 0 ? '-=.45' : '<.14');
    });
    tl.to(q('.hp-out'), {opacity:0, duration:.4}, '-=.25')
      .fromTo(q('.bolt'), {scale:0, transformOrigin:'50% 50%'}, {scale:1, duration:.35, stagger:.05, ease:'back.out(3)'}, '-=.2')
      .to(q('.bolt'), {scale:0, opacity:0, duration:.35, stagger:.03, ease:'power2.in'}, '+=.25')
      .from(q('.op'), {opacity:0, duration:.35, stagger:.07}, '-=.35')
      .from(q('.itin'), {scale:0, transformOrigin:'50% 50%', duration:.55, stagger:.07, ease:'back.out(1.8)'}, '-=.15')
      .fromTo(q('.dimline'), {strokeDasharray:1, strokeDashoffset:1}, {strokeDashoffset:0, duration:.7, stagger:.015, ease:'power1.inOut'}, '-=.35')
      .from(q('.dim'), {opacity:0, duration:.4, stagger:.03}, '<.25')
      .fromTo(tag, {y:12, opacity:0}, {y:0, opacity:1, duration:.45, ease:'power3.out'}, '-=.3');
  };
  play();
}
function buildAsm() {
  const svg = $('#asmSvg'); if (!svg || svg.dataset.done) return null; svg.dataset.done = '1';
  const geo = buildGeo(SHAPE_2M()), Hh = 2900, K = .07, c30 = Math.cos(Math.PI / 6);
  const b = geo.bbox, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const Q = (x, y, z) => [500 + (x - cx - (y - cy)) * c30 * K, 425 + (x - cx + (y - cy)) * .5 * K - z * K];
  const P = arr => arr.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const gr = [[b[0] - 3500, b[1] - 3500], [b[2] + 3500, b[1] - 3500], [b[2] + 3500, b[3] + 3500], [b[0] - 3500, b[3] + 3500]].map(p => Q(p[0], p[1], 0));
  let h = `<rect width="1000" height="720" fill="var(--sheet)"/><polygon points="${P(gr)}" fill="color-mix(in srgb, var(--ok) 16%, var(--paper))"/>`;
  h += `<g class="asm-sun"><g transform="translate(860 110)"><circle r="34" fill="#F2C14E"/>${[...Array(8)].map((_, k) => `<line x1="0" y1="-48" x2="0" y2="-64" stroke="#F2C14E" stroke-width="5" stroke-linecap="round" transform="rotate(${k * 45})"/>`).join('')}</g></g>`;
  h += `<g class="asm-rain">${[...Array(14)].map((_, k) => `<line x1="${120 + k * 55}" y1="${40 + (k % 3) * 25}" x2="${110 + k * 55}" y2="${70 + (k % 3) * 25}" stroke="#7FB6CF" stroke-width="3" stroke-linecap="round"/>`).join('')}</g>`;
  pillarsOf(geo).forEach(p => { const a = Q(p.p[0], p.p[1], 0), t = Q(p.p[0], p.p[1], -520); h += `<line class="asm-pile" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${t[0].toFixed(1)}" y2="${t[1].toFixed(1)}" stroke="var(--steel)" stroke-width="5" stroke-linecap="round"/>`; });
  const order = geo.mods.map((m, i) => ({m, i, d:centroid(m.poly)[0] + centroid(m.poly)[1]})).sort((a, c) => a.d - c.d);
  order.forEach(({m, i}) => {
    let g = `<g class="asm-mod" data-k="${m.key}"><polygon class="asm-sh" points="${P(m.poly.map(p => Q(p[0], p[1], 0)))}" fill="rgba(0,0,0,.16)"/><g class="asm-body">`;
    m.edges.forEach(e => { const no = [-e.n[0], -e.n[1]]; if (no[0] + no[1] <= .01) return;
      g += `<polygon points="${P([Q(e.a[0], e.a[1], 0), Q(e.b[0], e.b[1], 0), Q(e.b[0], e.b[1], Hh), Q(e.a[0], e.a[1], Hh)])}" fill="${no[0] > no[1] ? '#8E9A99' : '#B7C0BE'}" stroke="#1E2A2E" stroke-width="1.3" stroke-linejoin="round"/>`;
      if (e.type === 'ext' && e.len > 1800) { const u0 = .3, u1 = .7, A = add(e.a, mul(sub(e.b, e.a), u0)), B = add(e.a, mul(sub(e.b, e.a), u1));
        g += `<polygon points="${P([Q(A[0], A[1], 900), Q(B[0], B[1], 900), Q(B[0], B[1], 2300), Q(A[0], A[1], 2300)])}" fill="#9CCBDD" stroke="#1E2A2E" stroke-width="1"/>`; } });
    g += `<polygon points="${P(m.poly.map(p => Q(p[0], p[1], Hh)))}" fill="#EEF0EC" stroke="#1E2A2E" stroke-width="1.3" stroke-linejoin="round"/>`;
    if (m.key === 'C') { const xs = m.poly.map(p => p[0]), ys = m.poly.map(p => p[1]), x0 = Math.min(...xs) + 300, y0 = Math.min(...ys) + 300;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { const px = x0 + c * 1250, py = y0 + r * 2400;
        g += `<polygon class="asm-pv" points="${P([Q(px, py, Hh + 60), Q(px + 950, py, Hh + 60), Q(px + 950, py + 2000, Hh + 60), Q(px, py + 2000, Hh + 60)])}" fill="#1C2A44" stroke="#0E1626" stroke-width="1"/>`; } }
    g += `</g></g>`; h += g;
  });
  geo.mods.forEach(m => m.edges.filter(e => e.type === 'joint' && m.key === 'C').forEach(e => [e.a, e.b].forEach(p => { const q2 = Q(p[0], p[1], Hh); h += `<circle class="asm-bolt" cx="${q2[0].toFixed(1)}" cy="${q2[1].toFixed(1)}" r="9" fill="var(--wool)" stroke="#1E2A2E" stroke-width="2"/>`; })));
  h += `<g class="asm-hook"><line x1="500" y1="0" x2="500" y2="120" stroke="#1E2A2E" stroke-width="2.5"/><path d="M500 120 v10 a8 8 0 1 1 -8 8" fill="none" stroke="#1E2A2E" stroke-width="3"/></g>`;
  h += `<g class="asm-badge"><g transform="translate(500 660)"><rect x="-120" y="-24" width="240" height="48" rx="24" fill="#1E2A2E"/><text y="7" text-anchor="middle" fill="#fff" font-size="19" font-weight="700" font-family="Archivo, Arial, sans-serif">Ready to live in</text></g></g>`;
  svg.innerHTML = h;
  return svg;
}
function buildStudio() {
  const tr = document.getElementById('studioTrack'), G2 = window.__MH_GALLERY; if (!tr || !G2 || tr.dataset.done) return; tr.dataset.done = '1';
  tr.innerHTML = G2.map((g, i) => `<figure class="st-card" data-i="${i}"><div class="st-frame"><img src="${g.src}" width="${g.w}" height="${g.h}" alt="${esc(g.t + ': ' + g.c)}" decoding="async"></div><figcaption class="st-cap"><span class="st-num">${String(i + 1).padStart(2, '0')}</span><b>${esc(g.t)}</b><span class="c">${esc(g.c)}</span></figcaption></figure>`).join('');
  const lb = document.getElementById('lightbox');
  tr.addEventListener('click', e => { const c = e.target.closest('.st-card'); if (!c) return; const g = G2[+c.dataset.i]; $('#lbImg').src = g.src; $('#lbImg').alt = g.t; $('#lbCap').textContent = g.t + ' · ' + g.c; lb.showModal(); });
  lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('[data-lb]')) lb.close(); });
}
function studioMotion(g, ST) {
  const sec = document.getElementById('s-studio'), tr = document.getElementById('studioTrack'); if (!sec || !tr) return;
  const cards = [...tr.querySelectorAll('.st-card')], n = cards.length, cnt = document.getElementById('studioCount');
  const mm = g.matchMedia();
  mm.add('(min-width: 981px)', () => {
    const dist = () => tr.scrollWidth - window.innerWidth;
    const tween = g.to(tr, {x:() => -dist(), ease:'none', scrollTrigger:{trigger:sec, start:'top top', end:() => '+=' + dist(), pin:true, scrub:.9, anticipatePin:1, invalidateOnRefresh:true,
      onUpdate:self => { const k = Math.min(n, Math.max(1, Math.round(self.progress * (n - 1)) + 1)); if (cnt) cnt.textContent = String(k).padStart(2, '0') + ' / ' + String(n).padStart(2, '0'); g.set('#studioProg', {scaleX:self.progress}); }}});
    cards.forEach((c, i) => { const img = c.querySelector('img'), cap = c.querySelectorAll('.st-cap > *');
      g.fromTo(c.querySelector('.st-frame'), {clipPath:'inset(0 0 0 100% round 16px)'}, {clipPath:'inset(0 0 0 0% round 16px)', ease:'none', scrollTrigger:{trigger:c, containerAnimation:tween, start:'left 95%', end:'left 45%', scrub:true}});
      g.fromTo(img, {scale:1.25, xPercent:8}, {scale:1, xPercent:-4, ease:'none', scrollTrigger:{trigger:c, containerAnimation:tween, start:'left right', end:'right left', scrub:true}});
      g.from(cap, {yPercent:120, opacity:0, duration:.7, stagger:.08, ease:'power3.out', scrollTrigger:{trigger:c, containerAnimation:tween, start:'left 70%', toggleActions:'play none none reverse'}}); });
    return () => g.set(tr, {x:0});
  });
  mm.add('(max-width: 980px)', () => { cards.forEach(c => { g.fromTo(c.querySelector('.st-frame'), {clipPath:'inset(0 0 100% 0 round 16px)'}, {clipPath:'inset(0 0 0% 0 round 16px)', duration:1, ease:'power3.inOut', scrollTrigger:{trigger:c, start:'top 85%', once:true}});
    g.from(c.querySelector('img'), {scale:1.2, duration:1.4, ease:'power3.out', scrollTrigger:{trigger:c, start:'top 85%', once:true}}); }); });
  // cursor bubble on precise pointers
  if (matchMedia('(pointer:fine)').matches) { const dot = document.getElementById('cursorDot'); const xT = g.quickTo(dot, 'x', {duration:.35, ease:'power3'}), yT = g.quickTo(dot, 'y', {duration:.35, ease:'power3'});
    sec.addEventListener('pointerenter', () => g.to(dot, {scale:1, duration:.35, ease:'back.out(2)'})); sec.addEventListener('pointerleave', () => g.to(dot, {scale:0, duration:.25}));
    sec.addEventListener('pointermove', e => { xT(e.clientX); yT(e.clientY); const on = !!e.target.closest('.st-card'); if (dot.dataset.on !== String(on)) { dot.dataset.on = on; dot.textContent = on ? 'View' : 'Scroll'; g.fromTo(dot, {scale:.8}, {scale:1, duration:.3, ease:'back.out(3)'}); } }); }
  // headline mask for the studio heading
  const w = splitWords(sec.querySelector('h2')); g.from(w, {yPercent:115, duration:.9, stagger:.06, ease:'power4.out', scrollTrigger:{trigger:sec, start:'top 80%', once:true}});
  Promise.all([...tr.querySelectorAll('img')].map(i => i.decode ? i.decode().catch(() => {}) : 0)).then(() => ST.refresh());
}
function buildSiteCluster() {
  const box = document.getElementById('siteCluster'); if (!box || box.dataset.done || !G.thumbs || !G.thumbs[0] || !G.thumbs[0].state) return;
  box.dataset.done = '1'; const st = G.thumbs[0].state, cl = clusterLayout(st, 6);
  box.innerHTML = clusterSVG(st, cl, {labels:false});
  const g = GS();
  if (g && window.ScrollTrigger) { const homes = box.querySelectorAll('.cl-home'); g.set(homes, {opacity:0, scale:.85, transformOrigin:'50% 50%'});
    g.to(homes, {opacity:1, scale:1, duration:.7, stagger:.22, ease:'back.out(1.6)', scrollTrigger:{trigger:box, start:'top 75%', once:true}}); }
}
function buildFlow() {
  const svg = document.getElementById('flowSvg'); if (!svg) return;
  const phone = window.innerWidth < 640, mode = phone ? 'v' : 'h';
  if (svg.dataset.mode === mode) return; svg.dataset.mode = mode;
  const node = (x, y, w, h, t, sub, icon) => `<g class="fnode"><rect class="fbox" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/><text class="ftxt" x="${x + 16}" y="${y + 30}">${icon} ${t}</text><text class="fsub" x="${x + 16}" y="${y + 52}">${sub}</text></g>`;
  let h = '';
  if (!phone) {
    svg.setAttribute('viewBox', '0 0 1000 420');
    h += `<path class="fl e" d="M180 95 C 260 95, 270 95, 330 95"/><path class="fl e" d="M480 95 C 560 95, 560 95, 620 95"/><path class="fl e" d="M700 125 C 700 160, 700 165, 700 190"/>`;
    h += `<path class="fl w" d="M120 125 C 120 220, 120 260, 170 300"/><path class="fl w" d="M320 320 C 380 320, 400 320, 450 320"/><path class="fl w" d="M600 320 C 630 320, 640 300, 640 280"/>`;
    h += `<path class="fl g" d="M790 260 C 840 300, 860 320, 860 330"/>`;
    h += node(40, 55, 140, 70, 'Sun', 'free energy', '☀') + node(330, 55, 150, 70, 'Roof solar', 'about 1.4 kWp', '▦') + node(620, 55, 170, 70, 'Battery', 'about 2 days', '⚡');
    h += node(40, 300, 280, 70, 'Rain → cistern', 'about 3 weeks stored', '💧') + node(450, 285, 150, 70, 'Filter + UV', 'drinking quality', '◎');
    h += `<g class="fnode"><path class="fbox" d="M620 190 L700 140 L780 190 V270 H620 Z"/><text class="ftxt" x="645" y="230">Home</text><text class="fsub" x="645" y="252">lights, hob, fridge</text></g>`;
    h += node(800, 330, 170, 70, 'Reed planter', 'greywater reused', '❀');
  } else {
    // stacked layout for phones: power on the left, water on the right, home in the middle
    svg.setAttribute('viewBox', '0 0 400 640');
    h += `<path class="fl e" d="M105 90 V 130"/><path class="fl e" d="M105 200 V 240"/><path class="fl e" d="M105 310 C 105 360, 150 370, 170 390"/>`;
    h += `<path class="fl w" d="M295 90 V 130"/><path class="fl w" d="M295 200 V 240"/><path class="fl w" d="M295 310 C 295 360, 250 370, 230 390"/>`;
    h += `<path class="fl g" d="M200 490 V 540"/>`;
    h += node(20, 20, 170, 70, 'Sun', 'free energy', '☀') + node(20, 130, 170, 70, 'Solar', 'about 1.4 kWp', '▦') + node(20, 240, 170, 70, 'Battery', 'about 2 days', '⚡');
    h += node(210, 20, 170, 70, 'Rain', 'roof to cistern', '💧') + node(210, 130, 170, 70, 'Cistern', 'about 3 weeks', '◍') + node(210, 240, 170, 70, 'Filter + UV', 'drinking water', '◎');
    h += `<g class="fnode"><path class="fbox" d="M120 420 L200 370 L280 420 V490 H120 Z"/><text class="ftxt" x="200" y="452" text-anchor="middle">Home</text><text class="fsub" x="200" y="474" text-anchor="middle">lights, hob, fridge</text></g>`;
    h += node(110, 545, 180, 70, 'Reed planter', 'greywater reused', '❀');
  }
  svg.innerHTML = h;
  if (window.gsap && !RM && svg.dataset.shown) gsap.set(svg.querySelectorAll('.fnode, .fl'), {opacity:1, scale:1});
}
window.addEventListener('resize', () => { const svg = document.getElementById('flowSvg'); if (svg && svg.dataset.mode && (window.innerWidth < 640 ? 'v' : 'h') !== svg.dataset.mode) { svg.dataset.shown = '1'; buildFlow(); } });
function initSiteMotion() {
  const g = GS(), ST = window.ScrollTrigger;
  buildStudio();
  const svg = buildAsm();
  const steps = [...document.querySelectorAll('.asm-steps li')];
  const setStep = k => steps.forEach((li, j) => li.classList.toggle('on', j <= k));
  if (!g || !ST) { setStep(3); return; }
  g.registerPlugin(ST);
  studioMotion(g, ST);   // pinned sections must be created in page order: the gallery comes before the assembly
  // hero intro
  const words = splitWords(document.querySelector('.hero h1')), hl = document.querySelector('.hero .hl');
  if (hl) g.set(hl, {backgroundSize:'0% 100%'});
  g.timeline({defaults:{ease:'power3.out'}})
    .from('.snav', {y:-24, opacity:0, duration:.6})
    .from('.hero .eyebrow', {y:12, opacity:0, duration:.5}, '-=.3')
    .from(words, {yPercent:115, duration:.85, stagger:.045, ease:'power4.out'}, '-=.25')
    .to(hl, {backgroundSize:'100% 100%', duration:.7, ease:'power2.inOut'}, '-=.4')
    .from('.hero .lead2', {y:16, opacity:0, duration:.6}, '-=.55')
    .from('.hero-cta .btn', {y:14, opacity:0, duration:.5, stagger:.08}, '-=.4')
    .from('.hero .from, .hero .resume', {opacity:0, duration:.5}, '-=.3')
    .from('.hero-art', {y:40, opacity:0, scale:.96, duration:1.1, ease:'expo.out'}, .3);
  g.to('.hero-art', {yPercent:-7, ease:'none', scrollTrigger:{trigger:'.hero', start:'top top', end:'bottom top', scrub:true}});
  // stat count
  const sb = document.querySelector('.stats div b'); if (sb) { const o = {v:0}; g.to(o, {v:24.9, duration:1.4, ease:'power2.out', scrollTrigger:{trigger:'.stats', start:'top 85%', once:true}, onUpdate:() => sb.textContent = o.v.toFixed(1) + ' m²'}); }
  // headings: words rise out of a mask
  document.querySelectorAll('.ssec h2, .cta-band h2').forEach(h2 => { const w = splitWords(h2); g.from(w, {yPercent:115, duration:.8, stagger:.05, ease:'power4.out', scrollTrigger:{trigger:h2, start:'top 88%', once:true}}); });
  // cards and rows stagger in
  const batchSel = '.stats > div, .steps li, .scard, .feat > div, .spec tr, .faq details, .shead p, .cta-band p, .cta-band .btn';
  g.set(batchSel, {opacity:0, y:28});
  ST.batch(batchSel, {start:'top 90%', once:true, onEnter:els => g.to(els, {opacity:1, y:0, duration:.75, stagger:.07, ease:'power3.out', overwrite:true})});
  setTimeout(() => document.querySelectorAll(batchSel).forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && getComputedStyle(el).opacity === '0') g.to(el, {opacity:1, y:0, duration:.5}); }), 2500);
  // steps progress line
  g.to('#stepsLine', {scaleX:1, ease:'none', scrollTrigger:{trigger:'#s-how', start:'top 75%', end:'bottom 55%', scrub:.6}});
  // factory-to-site assembly, scrubbed and pinned
  if (svg) {
    const q = s => svg.querySelectorAll(s), mod = k => svg.querySelector(`.asm-mod[data-k="${k}"]`);
    const keys = [...q('.asm-mod')].map(e => e.dataset.k);
    const start = {LW:{x:-430, y:260}, C:{x:-300, y:330}, RW:{x:-170, y:400}};
    keys.forEach(k => { const s0 = start[k.slice(0, 2)] || start.C; g.set(mod(k), {x:s0.x, y:s0.y, opacity:0}); g.set(mod(k).querySelector('.asm-sh'), {opacity:0}); });
    g.set(q('.asm-pv'), {opacity:0, y:-60}); g.set(q('.asm-bolt'), {scale:0, transformOrigin:'50% 50%'}); g.set(q('.asm-sun, .asm-rain'), {opacity:0}); g.set(q('.asm-badge'), {opacity:0, y:20}); g.set(q('.asm-hook'), {y:-140}); g.set(q('.asm-pile'), {opacity:0});
    const tl = g.timeline({defaults:{ease:'power2.inOut'}});
    tl.to(keys.map(mod), {opacity:1, duration:.5, stagger:.12})
      .to(q('.asm-pile'), {opacity:1, duration:.4}, '<')
      .addLabel('drive')
      .to(keys.map(mod), {x:i => [-40, 0, 40][i] || 0, y:-110, duration:1.4, stagger:.15, ease:'power3.inOut'})
      .addLabel('lift')
      .to(q('.asm-hook'), {y:0, duration:.5}, 'lift')
      .to(keys.map(mod), {y:0, duration:1, stagger:.25, ease:'bounce.out'}, 'lift+=.3')
      .to(q('.asm-sh'), {opacity:1, duration:.4}, '<')
      .to(q('.asm-hook'), {y:-160, duration:.5}, '>-.2')
      .to(keys.map(mod), {x:0, duration:.6, ease:'power3.out'})
      .addLabel('bolt')
      .to(q('.asm-bolt'), {scale:1, duration:.35, stagger:.06, ease:'back.out(3)'})
      .to(q('.asm-bolt'), {scale:0, duration:.3, stagger:.03}, '+=.3')
      .addLabel('power')
      .to(q('.asm-pv'), {opacity:1, y:0, duration:.7, stagger:.12, ease:'power3.out'})
      .to(q('.asm-sun'), {opacity:1, duration:.5}, '<')
      .to(q('.asm-rain'), {opacity:1, duration:.5}, '<.3')
      .fromTo(q('.asm-rain line'), {y:-20}, {y:30, duration:1, stagger:.03, ease:'none'}, '<')
      .to(q('.asm-rain'), {opacity:0, duration:.5})
      .to(q('.asm-badge'), {opacity:1, y:0, duration:.6, ease:'back.out(2)'});
    const total = tl.duration(), at = l => tl.labels[l] / total;
    const mm = g.matchMedia();
    mm.add('(min-width: 981px)', () => { ST.create({trigger:'#s-build', start:'top top', end:'+=170%', pin:true, scrub:.8, animation:tl,
      onUpdate:self => { const p = self.progress; setStep(p < at('drive') + .02 ? 0 : p < at('bolt') - .05 ? 1 : p < at('power') ? 2 : 3); }}); });
    mm.add('(max-width: 980px)', () => { ST.create({trigger:'#s-build .asm-art', start:'top 70%', end:'bottom 20%', scrub:.8, animation:tl,
      onUpdate:self => { const p = self.progress; setStep(p < at('drive') + .02 ? 0 : p < at('bolt') - .05 ? 1 : p < at('power') ? 2 : 3); }}); });
  }
  g.to('.scroll-cue', {opacity:0, y:10, ease:'none', scrollTrigger:{trigger:'.hero', start:'top top', end:'15% top', scrub:true}});
  // pause the hero loop when it is off screen
  ST.create({trigger:'.hero', start:'top top', end:'bottom top', onLeave:() => heroTL && heroTL.pause(), onEnterBack:() => heroTL && heroTL.resume()});
  // floating fact chips
  g.from('.chip', {opacity:0, y:20, scale:.9, duration:.7, stagger:.15, delay:1.4, ease:'back.out(2)'});
  document.querySelectorAll('.chip').forEach((c, k) => g.to(c, {y:k % 2 ? 8 : -8, duration:2.4 + k * .4, yoyo:true, repeat:-1, ease:'sine.inOut', delay:2.2}));
  // reading progress, hide-on-scroll nav, active section
  g.to('#sprog', {scaleX:1, ease:'none', scrollTrigger:{trigger:'#site', start:'top top', end:'bottom bottom', scrub:.2}});
  const nav = document.querySelector('.snav');
  let lastY = 0; ST.create({start:0, end:'max', onUpdate:() => { const y = window.scrollY; nav.classList.toggle('hide', y > lastY && y > 400); lastY = y; }});
  [['access', 's-access'], ['how', 's-how'], ['homes', 's-homes'], ['included', 's-included'], ['faq', 's-faq']].forEach(([k, id]) => { const a = document.querySelector(`.slinks [data-go="${k}"]`);
    ST.create({trigger:'#' + id, start:'top 50%', end:'bottom 50%', onToggle:self => a && a.classList.toggle('on', self.isActive)}); });
  // feature icons draw on
  document.querySelectorAll('.ficon path').forEach(p => { const L = p.getTotalLength(); g.set(p, {strokeDasharray:L, strokeDashoffset:L}); });
  document.querySelectorAll('.feat').forEach(f => g.to(f.querySelectorAll('.ficon path'), {strokeDashoffset:0, duration:1.2, stagger:.15, ease:'power2.inOut', scrollTrigger:{trigger:f, start:'top 80%', once:true}}));
  // energy and water flow diagram
  buildFlow();
  const fs2 = document.querySelectorAll('#flowSvg .fnode');
  g.set(fs2, {opacity:0, scale:.8, transformOrigin:'50% 50%'}); g.set('#flowSvg .fl', {opacity:0});
  g.timeline({scrollTrigger:{trigger:'#s-flow', start:'top 70%', once:true}})
    .to(fs2, {opacity:1, scale:1, duration:.5, stagger:.1, ease:'back.out(2)'})
    .to('#flowSvg .fl', {opacity:1, duration:.6, stagger:.08}, '-=.2');
  // home cards: tilt and cursor light
  if (matchMedia('(pointer:fine)').matches) document.getElementById('siteHomes').addEventListener('pointermove', e => {
    const c = e.target.closest('.scard'); if (!c) return; const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    c.style.setProperty('--mx', px * 100 + '%'); c.style.setProperty('--my', py * 100 + '%');
    g.to(c, {rotateY:(px - .5) * 8, rotateX:(.5 - py) * 8, transformPerspective:700, duration:.4, ease:'power2.out', overwrite:'auto'}); });
  document.getElementById('siteHomes').addEventListener('pointerout', e => { const c = e.target.closest('.scard'); if (c && !c.contains(e.relatedTarget)) g.to(c, {rotateY:0, rotateX:0, duration:.6, ease:'power3.out'}); });
  // magnetic primary buttons on precise pointers
  if (matchMedia('(pointer:fine)').matches) document.querySelectorAll('.site .btn.primary').forEach(btn => {
    const xT = g.quickTo(btn, 'x', {duration:.4, ease:'power3'}), yT = g.quickTo(btn, 'y', {duration:.4, ease:'power3'});
    btn.addEventListener('pointermove', e => { const r = btn.getBoundingClientRect(); xT((e.clientX - r.left - r.width / 2) * .25); yT((e.clientY - r.top - r.height / 2) * .35); });
    btn.addEventListener('pointerleave', () => { xT(0); yT(0); });
  });
}

/* ======================= INIT ======================= */
function init() {
  try { const th = localStorage.getItem('mhb-theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
  let restored = false;
  try { const c = localStorage.getItem('mhb-current'); if (c) { S = migrate(JSON.parse(c)); restored = true; } } catch (e) {}
  if (!restored) { const c = loadThumbCache(); if (c && c[0] && c[0].state) Object.assign(S, JSON.parse(JSON.stringify(c[0].state))); else applyPreset(PRESETS[0]); }
  G.geo = buildGeo(S.shape);
  renderRail(); initPanel(); initInspector(); initCosts(); initDialog(); initPlanEvents(); initSmart(); initCompass();
  initSite();
  G.motion = true; G.intro = true; $('#plan').classList.add('intro'); setTimeout(() => $('#plan').classList.remove('intro'), 1600);
  commit(true); reset3D(true);
  new ResizeObserver(() => { if (!G.view) return; const v = G.view; fitAspect(); }).observe($('#plan'));
  $('#fitBtn').onclick = () => { const tv = G.view; fitView(); const to = G.view; G.view = tv; animateView(to); };
  $('#autoBtn').onclick = () => { snapshot(); const f = autoArrange('furn'); G.sel = null; G.motion = true; commit(true); toast(f.length ? 'Could not fit: ' + f.map(t => CAT[t] ? CAT[t].label.toLowerCase() : t).join(', ') : 'Furniture arranged'); };
  $('#dimsBtn').onclick = e => { G.dims = !G.dims; e.currentTarget.setAttribute('aria-pressed', G.dims); renderPlan(); };
  $('#clrBtn').onclick = e => { G.clr = !G.clr; e.currentTarget.setAttribute('aria-pressed', G.clr); renderPlan(); };
  $('#cutBtn').onclick = e => { G.cut = !G.cut; e.currentTarget.setAttribute('aria-pressed', G.cut); G.anim3D = 'walls'; build3D(); };
  $('#helpBtn').onclick = openHelp;
  $('#roofBtn').onclick = e => { G.roof = !G.roof; e.currentTarget.setAttribute('aria-pressed', G.roof); G.anim3D = G.roof ? 'roof' : null; build3D(); };
  $('#frameBtn').onclick = e => { G.frame = !G.frame; e.currentTarget.setAttribute('aria-pressed', G.frame); G.anim3D = G.frame ? 'frame' : 'walls'; build3D(); };
  $('#topBtn').onclick = () => { if (!V3.ok) return; camTo({th:V3.orb.th, ph:.13, r:V3.orb.r, tgt:V3.orb.tgt.clone()}); };
  $('#resetBtn').onclick = () => reset3D();
  $('#zIn').onclick = () => zoomPlan(.8); $('#zOut').onclick = () => zoomPlan(1.25);
  const z3 = k => { if (!V3.ok) return; camTo({th:V3.orb.th, ph:V3.orb.ph, r:clamp(V3.orb.r * k, 3, 40), tgt:V3.orb.tgt.clone()}); };
  $('#z3In').onclick = () => z3(.8); $('#z3Out').onclick = () => z3(1.25);
  $('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo;
  $('#saveBtn').onclick = openDesigns;
  $('#themeBtn').onclick = () => { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('mhb-theme', r.dataset.theme); } catch (e) {} build3D(); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => build3D());
  $('#mnav').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) switchView(b.dataset.v); });
}
function fitAspect() {
  const svg = $('#plan'), r = svg.getBoundingClientRect(); if (r.width < 2) return;
  const v = G.view, ar = r.width / r.height, cx = v.x + v.w/2, cy = v.y + v.h/2;
  let w = v.w, h = v.h; if (w / h < ar) w = h * ar; else h = w / ar;
  G.view = {x:cx - w/2, y:cy - h/2, w, h}; svg.setAttribute('viewBox', `${G.view.x} ${G.view.y} ${w} ${h}`);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
window.__mhb = {get S() { return S; }, G, autoArrange, buildGeo, costs, validate, findSpot, newItem, bodyPoly, walkCheck, exitSegments, bedExitDist, turnCheck, solidPolys};
})();
