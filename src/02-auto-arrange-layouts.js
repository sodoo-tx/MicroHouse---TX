/* ======================= AUTO ARRANGE ======================= */
function newItem(type, extra) {
  const c = CAT[type];
  return Object.assign({id:uid(), type, x:0, y:0, rot:0, w:c.w, d:c.d, lock:false, opt:c.opt ? JSON.parse(JSON.stringify(c.opt)) : undefined}, extra || {});
}
function newOpening(type, edge, s, extra) {
  const o = OPN[type];
  return Object.assign({id:uid(), type, edge, s, w:o.w, h:o.h, sill:o.sill, hinge:'L', swing:'out'}, extra || {});
}
function mid(e) { return mul(add(e.a, e.b), .5); }
const wingMods = (geo, pre) => geo.mods.filter(m => m.key.startsWith(pre));
const modsArea = ms => ms.reduce((s, m) => s + polyArea(m.poly), 0);

/* decide which modules hold the bathroom and the kitchen */
function planZones(geo) {
  const h = S.hints, L = geo.L, bedY = h.bedEnd === 'top' ? 0 : L, otherY = L - bedY;
  const res = {bedY, otherY, mode:'wing', wetMods:[], kitMods:[], wetAll:true, endY:null};
  let bw = h.bathWing;
  if (bw !== 'end') {
    let wm = wingMods(geo, bw === 'left' ? 'LW' : 'RW');
    if (!wm.length) wm = wingMods(geo, bw === 'left' ? 'RW' : 'LW');
    if (!wm.length) bw = 'end';
    else {
      const all = wm.slice();
      if (wm.length > 1) {
        // a split wing: the bathroom takes one piece, the other piece stays open to the house
        wm = [wm.slice().sort((a, b) => Math.abs(centroid(b.poly)[1] - bedY) - Math.abs(centroid(a.poly)[1] - bedY))[0]];
        if (h.kitchenIn === 'bathwing') res.kitMods = all.filter(m => !wm.includes(m));
      }
      res.wetMods = wm; res.wetAll = all.length === wm.length;
    }
  }
  if (bw === 'end') { res.mode = 'end'; const depth = S.program.bathing === 'bath' ? 1750 : 1550; res.endY = h.bedEnd === 'top' ? L - depth : depth; }
  if (!res.kitMods.length && h.kitchenIn !== 'central') {
    const wetG = res.wetMods.length ? grp(res.wetMods[0].key) : null;
    const others = ['LW', 'RW'].filter(g => g !== wetG).map(g => wingMods(geo, g)).filter(a => a.length).sort((a, b) => modsArea(b) - modsArea(a));
    if (others.length) res.kitMods = others[0];
  }
  return res;
}

function autoOpenings(geo) {
  const pl = planZones(geo), {bedY, otherY} = pl;
  const ops = [];
  const isEnd = (e, y) => Math.abs(e.a[1] - y) < 1 && Math.abs(e.b[1] - y) < 1;
  const vertical = e => Math.abs(e.u[1]) > .95;
  const wetKeys = new Set(pl.wetMods.map(m => m.key)), kitKeys = new Set(pl.kitMods.map(m => m.key));
  const top = S.hints.bedEnd === 'top';
  const inWetY = y => pl.mode === 'end' && (top ? y > pl.endY - 1 : y < pl.endY + 1);
  const dry = e => !wetKeys.has(e.mod) && !(inWetY(e.a[1]) || inWetY(e.b[1]));
  const wetEdge = e => wetKeys.has(e.mod) || (inWetY(e.a[1]) && inWetY(e.b[1]));
  const target = pl.mode === 'end' ? pl.endY : otherY;
  const da = S.hints.doorAt || 'auto';
  const dsc = e => Math.abs(mid(e)[1] - target) + (e.mod === 'C' ? 0 : 300) + (kitKeys.has(e.mod) && vertical(e) ? 1500 : 0)
    + (da === 'side' ? (vertical(e) ? 0 : 3000) : da === 'end' ? (Math.abs(e.u[0]) > .9 ? 0 : 3000) : 0);
  const de = geo.ext.filter(e => dry(e) && e.len >= 1300 && !isEnd(e, bedY)).sort((a, b) => dsc(a) - dsc(b))[0];
  if (de) ops.push(newOpening('door', de.key, de.len / 2, {pri:9}));
  const ge = geo.ext.filter(e => e.mod === 'C' && isEnd(e, bedY)).sort((a, b) => b.len - a.len)[0];
  if (ge) {
    if (ge.len >= 2600) ops.push(newOpening('slide', ge.key, ge.len / 2, {w:Math.min(2000, ge.len - 500), pri:8}));
    else if (ge.len >= 1200) ops.push(newOpening('win_tall', ge.key, ge.len / 2, {w:Math.min(1600, ge.len - 420), pri:8}));
  }
  const oe = geo.ext.filter(e => e.mod === 'C' && isEnd(e, otherY) && dry(e)).sort((a, b) => b.len - a.len)[0];
  if (oe && (!de || oe.key !== de.key) && oe.len >= 1300) ops.push(newOpening('win_m', oe.key, oe.len / 2, {w:Math.min(1200, oe.len - 420), pri:3}));
  const ke = geo.ext.filter(e => kitKeys.has(e.mod) && (!de || e.key !== de.key)).sort((a, b) => (vertical(b) - vertical(a)) || (b.len - a.len))[0];
  if (ke && ke.len >= 1400) ops.push(newOpening('win_strip', ke.key, ke.len / 2, {w:Math.min(1800, ke.len - 600), pri:6}));
  const be = geo.ext.filter(wetEdge).sort((a, b) => b.len - a.len)[0];
  if (be && be.len >= 1000) ops.push(newOpening('win_s', be.key, be.len / 2, {pri:5}));
  const se = geo.ext.filter(e => e.mod === 'C' && vertical(e) && e.len >= 1800 && dry(e) && (!de || e.key !== de.key)).sort((a, b) => b.len - a.len)[0];
  if (se) ops.push(newOpening('win_m', se.key, se.len / 2, {pri:2}));
  S.openings = ops;
  let guard = 0;
  while (guard++ < 8) { const b = bracing(geo); if (b.x >= 2 && b.y >= 2) break;
    const cands = S.openings.filter(o => o.pri < 8).sort((a, b) => a.pri - b.pri); if (!cands.length) break;
    S.openings = S.openings.filter(o => o !== cands[0]); }
  S.openings.forEach(o => delete o.pri);
}

function programItems() {
  const p = S.program, list = [];
  list.push(p.bathing === 'bath' ? 'bath' : 'shower', p.toilet, 'basin');
  if (p.washer) list.push('washer');
  list.push('kitchen'); if (p.fridgeTall) list.push('fridge');
  if (p.bed && p.bed !== 'none') list.push(p.bed);
  if (p.wardrobe) list.push('wardrobe');
  if (p.sofa && p.sofa !== 'none') list.push(p.sofa);
  if (p.dining) list.push('dining');
  if (p.desk) list.push('desk');
  list.push('energy');
  if (p.shoe) list.push('shoe');
  if (p.stove) list.push('stove');
  if (p.shelf) list.push('shelf');
  return list;
}

function autoArrange(mode) {
  const keep = JSON.stringify(S); let best = null;
  const ess = ['kitchen', 'bed160', 'bed140', 'bed90', 'wallbed', 'energy', 'shower', 'bath', 'toilet', 'wc', 'basin', 'sofabed'];
  for (const kf of [false, true]) {
    S = JSON.parse(keep);
    const f = arrangeOnce(mode, kf);
    const sc = f.reduce((s, t) => s + (ess.includes(t) ? 10 : 1), 0);
    if (!best || sc < best.sc) best = {sc, st:JSON.stringify(S), f};
    if (sc === 0) break;
  }
  S = JSON.parse(best.st); return best.f;
}

function arrangeOnce(mode, kitFirst) {
  const geo = buildGeo(S.shape);
  if (mode === 'all' || !S.openings.length) autoOpenings(geo);
  const kept = S.items.filter(i => i.lock);
  S.items = kept.slice(); S.swapped = [];
  const pl = planZones(geo), L = geo.L, {bedY, otherY} = pl, top = S.hints.bedEnd === 'top';
  const cx = (geo.xl + geo.xr0) / 2;
  const lockedPart = kept.some(i => i.type === 'partition');
  const wetKeys = new Set(pl.wetMods.map(m => m.key));
  let wetZs = [], dryZones, cZone;
  if (pl.mode === 'wing') {
    const isWallJ = e => e.type === 'joint' && (e.jk === 'central' || (e.jk === 'piece' && !pl.wetAll));
    const parts = [];
    pl.wetMods.forEach(m => {
      const z = zoneOf(m, e => isWallJ(e) ? 100 : 0, isWallJ); wetZs.push(z);
      m.edges.forEach((e, idx) => { if (!isWallJ(e)) return; const ze = z.edges.find(x => x.src === idx); if (!ze || ze.len < 300) return;
        parts.push({c:add(mid(ze), mul(e.n, -50)), rot:Math.atan2(e.u[1], e.u[0]) * 180 / Math.PI, len:ze.len, central:e.jk === 'central', ze}); });
    });
    if (!lockedPart && parts.length) {
      const pool = parts.filter(p => p.central && p.len >= 1000);
      const dp = (pool.length ? pool : parts.filter(p => p.len >= 900)).sort((a, b) => Math.abs(a.c[1] - otherY) - Math.abs(b.c[1] - otherY))[0];
      parts.forEach(p => {
        const it = newItem('partition', {x:p.c[0], y:p.c[1], rot:p.rot, w:Math.round(p.len)}); it.opt = {door:false, dpos:.5, dw:700};
        if (p === dp) { const nearB = Math.abs(p.ze.b[1] - otherY) < Math.abs(p.ze.a[1] - otherY), fromEnd = Math.min(1350, p.len / 2);
          it.opt.door = true; it.opt.dpos = clamp((nearB ? p.len - fromEnd : fromEnd) / p.len, 0, 1); }
        S.items.push(it);
      });
    }
    dryZones = geo.zones.filter(z => !wetKeys.has(z.key));
    cZone = geo.zones.find(z => z.key === 'C');
  } else {
    const y0 = pl.endY;
    const wy = top ? [y0 + 50, L + 10] : [-10, y0 - 50], dy = top ? [-10, y0 - 50] : [y0 + 50, L + 10];
    wetZs = geo.zones.map(z => clipZone(z, wy[0], wy[1])).filter(Boolean);
    wetZs.forEach(z => z.edges.forEach(e => { if (Math.abs(e.a[1] - e.b[1]) < 1 && Math.abs(e.a[1] - (top ? wy[0] : wy[1])) < 2) e.wall = true; }));
    dryZones = geo.zones.map(z => clipZone(z, dy[0], dy[1])).filter(Boolean);
    cZone = dryZones.find(z => z.key === 'C');
    if (!lockedPart) {
      let xmin = 1e9, xmax = -1e9;
      geo.zones.forEach(z => { for (let i = 0; i < z.poly.length; i++) { const a = z.poly[i], b = z.poly[(i + 1) % z.poly.length];
        if ((a[1] - y0) * (b[1] - y0) <= 0 && Math.abs(a[1] - b[1]) > 1e-6) { const x = a[0] + (y0 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]); xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); } } });
      if (xmax > xmin) { const it = newItem('partition', {x:(xmin + xmax) / 2, y:y0, rot:0, w:Math.round(xmax - xmin)});
        it.opt = {door:true, dpos:clamp((cx + 350 - xmin) / (xmax - xmin), .12, .88), dw:700}; S.items.push(it); }
    }
  }
  if (!cZone) cZone = geo.zones.find(z => z.key === 'C');
  let doorPt = null, doorRot = 0;
  const pItem = S.items.find(i => i.type === 'partition' && i.opt && i.opt.door);
  if (pItem) { const t = pItem.rot * Math.PI / 180, dc = pItem.opt.dpos * pItem.w - pItem.w / 2; doorPt = [pItem.x + dc * Math.cos(t), pItem.y + dc * Math.sin(t)]; doorRot = pItem.rot; }
  const bedRange = top ? [-10, L * .58] : [L * .42, L + 10], liveRange = top ? [L * .4, L + 10] : [-10, L * .6];
  const bedZones = dryZones.map(z => clipZone(z, bedRange[0], bedRange[1])).filter(Boolean);
  const liveHalf = clipZone(cZone, liveRange[0], liveRange[1]);
  let kitZones = pl.kitMods.length ? dryZones.filter(z => pl.kitMods.some(m => m.key === z.key)) : [];
  if (!kitZones.length) kitZones = [top ? clipZone(cZone, L * .5, L + 10) : clipZone(cZone, -10, L * .5)].filter(Boolean);
  const entry = (() => { const d = S.openings.find(o => OPN[o.type].kind === 'door'); if (!d) return [cx, otherY]; const f = opFrame(geo, d); return f ? mul(add(f.a, f.b), .5) : [cx, otherY]; })();
  const windows = S.openings.filter(o => OPN[o.type].kind !== 'door').map(o => { const f = opFrame(geo, o); return f ? mul(add(f.a, f.b), .5) : null; }).filter(Boolean);
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const blocks = S.openings.map(o => opZones(geo, o)).filter(Boolean);
  if (doorPt) blocks.push({poly:rectPoly(doorPt[0], doorPt[1], 740, 1050, doorRot), tall:false});
  const placed = () => S.items.filter(i => !CAT[i.type].overlay).map(i => ({polys:solidPolys(i), clr:clearPoly(i), type:i.type}));
  const allZones = geo.zones.concat(wetZs);
  const insideHouse = p => allZones.some(z => inPoly(p, z.poly));
  let PL = null;
  const exits = exitSegments(geo); let bedMin = BED_EXIT_MIN;
  const fits = (it, zones) => {
    const body = bodyPoly(it);
    if (!insideZones(body, zones)) return false;
    if (BED_TYPES.includes(it.type) && exits.length && bedExitDist(it, exits) < bedMin) return false;
    const clr = clearPoly(it);
    if (clr && !clr.slice(2).every(insideHouse)) return false;
    if (clr && it.type === 'wallbed' && !insideZones(clr, allZones)) return false;
    for (const o of (PL || placed())) {
      if (o.polys.some(q => overlap(body, q))) return false;
      if (o.clr && overlap(body, o.clr, 30)) return false;
      if (clr && o.polys.some(q => overlap(clr, q, 30)) && o.type !== 'partition') return false;
      if (clr && it.type === 'wallbed' && o.polys.some(q => overlap(clr, q, 5))) return false;
    }
    for (const b of blocks) { if (b.tall && CAT[it.type].h <= (b.sill || 0) + 30) continue; if (overlap(body, b.poly, 10)) return false; }
    return true;
  };
  const candidates = (it, zones, free) => {
    const out = [], edges = [];
    zones.forEach(z => z.edges.forEach(e => { if (e.wall) edges.push(e); }));
    partitionFaces(S.items).forEach(e => edges.push(e));
    edges.forEach(e => {
      if (e.len < it.w + 20) return;
      const steps = Math.max(1, Math.floor((e.len - it.w - 20) / 100));
      for (let k = 0; k <= steps; k++) {
        const s = it.w/2 + 10 + k * (e.len - it.w - 20) / steps;
        const p = add(add(e.a, mul(e.u, s)), mul(e.n, it.d/2 + 4));
        out.push({x:p[0], y:p[1], rot:Math.atan2(-e.n[0], e.n[1]) * 180 / Math.PI, edge:e});
      }
    });
    if (free) {
      const xs = zones.flatMap(z => z.poly.map(p => p[0])), ys = zones.flatMap(z => z.poly.map(p => p[1]));
      for (let x = Math.min(...xs) + 150; x < Math.max(...xs); x += 150) for (let y = Math.min(...ys) + 150; y < Math.max(...ys); y += 150)
        for (const rot of [0, 90, 180, 270]) out.push({x, y, rot, edge:null});
    }
    return out;
  };
  const recipe = {};
  const options = (type, zones, score, opts = {}) => {
    const it = newItem(type, opts.extra);
    if (opts.w) it.w = opts.w;
    zones = zones.filter(Boolean); if (!zones.length) return {it, list:[]};
    const list = []; PL = placed();
    for (const c of candidates(it, zones, !CAT[type].wall || opts.free)) {
      Object.assign(it, {x:c.x, y:c.y, rot:Math.round(c.rot * 100) / 100});
      if (!fits(it, zones)) continue;
      list.push({sc:score(it, c) + (c.edge ? 0 : 500), x:it.x, y:it.y, rot:it.rot});
    }
    PL = null;
    list.sort((a, b) => a.sc - b.sc);
    return {it, list};
  };
  const place = (type, zones, score, opts = {}) => {
    const {it, list} = options(type, zones, score, opts);
    if (!list.length) return null;
    if (!recipe[type]) recipe[type] = [];
    recipe[type].push({zones, score, opts});
    Object.assign(it, {x:list[0].x, y:list[0].y, rot:list[0].rot}); S.items.push(it); return it;
  };
  const tryShrink = (type, zones, score, minW) => {
    let w = CAT[type].w; if (type === 'kitchen') w = S.program.kitchen;
    while (w >= minW) { const r = place(type, zones, score, {w}); if (r) return r; w -= 300; }
    return null;
  };
  const failed = [];
  const want = programItems();
  const wet = want.filter(t => CAT[t].zone === 'wet').sort((a, b) => CAT[b].w * CAT[b].d - CAT[a].w * CAT[a].d);
  let anchor = null;
  wet.forEach(t => {
    const sc = it => anchor ? dist([it.x, it.y], anchor) : -dist([it.x, it.y], doorPt || entry);
    let r = place(t, wetZs, sc) || place(t, [liveHalf], sc);
    if (!r && t === 'bath') { r = place('shower', wetZs, sc) || place('shower', [liveHalf], sc); if (r) S.swapped = (S.swapped || []).concat(['Bathtub did not fit, used a shower']); }
    if (r) { if (!anchor) anchor = [r.x, r.y]; } else failed.push(t);
  });
  const doBed = () => {
    const bedT = want.find(t => CAT[t].zone === 'bed'); if (!bedT) return;
    const target = [cx, bedY];
    const sc = (it, c) => dist([it.x, it.y], target) + (c.edge && Math.abs(c.edge.u[0]) > .9 ? 0 : 250);
    const tryBed = t => place(t, bedZones, sc) || place(t, dryZones, sc) || place(t, dryZones, sc, {free:true});
    if (tryBed(bedT)) return;
    const alt = ['bed140', 'bed90'].filter(t => BED_TYPES.indexOf(t) > BED_TYPES.indexOf(bedT));
    for (const t of alt) if (tryBed(t)) { S.swapped = (S.swapped || []).concat([`${CAT[bedT].label} did not fit away from the exit, used ${CAT[t].label.toLowerCase()}`]); return; }
    failed.push(bedT);
  };
  const doKitchen = () => {
    if (want.includes('kitchen')) {
      const sc = (it, c) => -(c.edge ? c.edge.len : 0) * 2 + dist([it.x, it.y], entry) * .3 - (windows.some(w => dist(w, [it.x, it.y]) < 900) ? 600 : 0);
      if (!tryShrink('kitchen', kitZones, sc, 1200) && !tryShrink('kitchen', [liveHalf, ...dryZones], sc, 1200)) failed.push('kitchen');
    }
    if (want.includes('fridge')) { const k = S.items.find(i => i.type === 'kitchen'); if (!place('fridge', [...kitZones, ...dryZones], it => k ? dist([it.x, it.y], [k.x, k.y]) : 0)) failed.push('fridge'); }
  };
  if (kitFirst) { doKitchen(); doBed(); } else { doBed(); doKitchen(); }
  const bed = S.items.find(i => CAT[i.type].zone === 'bed');
  ['energy', 'wardrobe', 'sofa', 'sofabed', 'dining', 'desk', 'shoe', 'stove', 'shelf'].filter(t => want.includes(t)).forEach(t => {
    let zs = dryZones, sc;
    if (t === 'wardrobe' || t === 'shelf') sc = it => (bed ? dist([it.x, it.y], [bed.x, bed.y]) : 0) + (t === 'shelf' ? 600 : 0);
    else if (t === 'sofa' || t === 'sofabed') { zs = [liveHalf, ...dryZones]; sc = it => dist([it.x, it.y], [cx, otherY]) * .6 + (bed ? -dist([it.x, it.y], [bed.x, bed.y]) * .3 : 0); }
    else if (t === 'dining') { zs = [liveHalf, cZone, ...dryZones]; sc = it => Math.min(...windows.map(w => dist(w, [it.x, it.y])), 4000); }
    else if (t === 'desk') sc = it => Math.min(...windows.map(w => dist(w, [it.x, it.y])), 4000);
    else if (t === 'energy' || t === 'shoe') sc = it => dist([it.x, it.y], entry);
    else if (t === 'stove') { zs = [liveHalf, cZone]; sc = it => dist([it.x, it.y], [cx, otherY]); }
    const r = place(t, zs, sc) || ((t === 'sofa' || t === 'sofabed' || t === 'stove') ? place(t, zs, sc, {free:true}) : null) || (t === 'dining' ? place('foldtable', zs, sc) : null);
    if (!r) failed.push(t);
  });
  // ----- walkway repair: move or drop furniture that blocks the way to anything
  const movable = ['sofa', 'sofabed', 'dining', 'foldtable', 'stove', 'shoe', 'shelf', 'desk', 'wardrobe', 'fridge'];
  for (let pass = 0; pass < 4; pass++) {
    const wk = walkCheck(geo); if (!wk || !wk.unreachable.length) break;
    const before = wk.unreachable.length; let fixed = false;
    for (const t of movable) {
      const it = S.items.find(i => i.type === t && !i.lock); if (!it) continue;
      S.items = S.items.filter(i => i !== it);
      const w2 = walkCheck(geo), without = w2 ? w2.unreachable.length : 0;
      if (without >= before) { S.items.push(it); continue; }
      // removing it helps: try the best few other spots for it
      let ok = false;
      for (const r of (recipe[t] || [])) {
        const {list} = options(t, r.zones, r.score, Object.assign({}, r.opts, {w:it.w}));
        for (const c of list.slice(0, 18)) {
          Object.assign(it, {x:c.x, y:c.y, rot:c.rot}); S.items.push(it);
          const w3 = walkCheck(geo); if (w3 && w3.unreachable.length <= without) { ok = true; break; }
          S.items = S.items.filter(i => i !== it);
        }
        if (ok) break;
      }
      if (!ok) failed.push(t);
      fixed = true; break;
    }
    if (!fixed) break;
  }
  S.unplaced = failed.slice();
  return failed;
}

/* ======================= SHAPES & PRESETS ======================= */
const WG = (inTop, inBot, outTop, outBot, split) => ({on:true, w:1500, inTop, inBot, outTop, outBot, split:split || {type:'none', a:2200, b:3200}});
const WOFF = () => ({on:false, w:1500, inTop:0, inBot:3200, outTop:0, outBot:2200, split:{type:'none', a:2200, b:3200}});
const SH = (l, r) => ({Wc:2500, L:5400, left:l, right:r});
const SPL = (a, b) => b == null ? {type:'straight', a, b:a} : {type:'diag', a, b};
const SHAPE_A = () => SH(WG(0, 5400, 1000, 5400), WG(0, 3200, 0, 2200));
const SHAPE_B = () => SH(WG(0, 3200, 0, 2200), WG(0, 5400, 1000, 5400, SPL(3200)));
const PRESET_GROUPS = [
  {title:'Signature homes', note:'All 24.9 m², two outlines with different room layouts.', items:[
    {name:'Bath strip, bed by the glass', shape:SHAPE_A, hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'bath'}},
    {name:'Bed at the far end', shape:SHAPE_A, hints:{bathWing:'left', bedEnd:'bottom', kitchenIn:'wing'}, prog:{bathing:'bath'}},
    {name:'Kitchen at the entrance', shape:SHAPE_A, hints:{bathWing:'left', bedEnd:'bottom', kitchenIn:'central'}, prog:{bathing:'shower', desk:true, dining:false, shoe:false}},
    {name:'Long living wing', shape:() => SH(WG(2200, 5400, 3200, 5400), WG(0, 5400, 0, 4400)), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'shower'}},
    {name:'Kitchen on the slant', shape:SHAPE_B, hints:{bathWing:'right', bedEnd:'top', kitchenIn:'bathwing'}, prog:{bathing:'bath'}},
    {name:'Bath across the end, wall bed', shape:SHAPE_B, hints:{bathWing:'end', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'shower', bed:'wallbed', dining:true}},
    {name:'Bath across the end, desk', shape:SHAPE_B, hints:{bathWing:'end', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'bath', desk:true, dining:false}},
    {name:'Bath beside the bedroom', shape:SHAPE_B, hints:{bathWing:'left', bedEnd:'bottom', kitchenIn:'central'}, prog:{bathing:'bath'}},
  ]},
  {title:'Module kits', note:'Wings built from 3.3 m² and 4.05 m² modules. Most are 28–30 m², set the area limit to 30 m² or more.', items:[
    {name:'Four slanted pieces', shape:() => SH(WG(-1000, 5400, 0, 4400, SPL(2200)), WG(-1000, 5400, 0, 4400, SPL(2200))), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'bath', desk:true}},
    {name:'3.3 + 4.05 each side', shape:() => SH(WG(0, 5400, 0, 4400, SPL(2200)), WG(0, 5400, 0, 4400, SPL(2200))), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'bath', desk:true}},
    {name:'Diagonal split + 3.3 + 4.05', shape:() => SH(WG(0, 5400, 0, 5400, SPL(2200, 3200)), WG(0, 5400, 0, 4400, SPL(2200))), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'bath', desk:true}},
    {name:'Diagonal split only', shape:() => SH(WG(0, 5400, 0, 5400, SPL(2200, 3200)), WOFF()), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'central'}, prog:{bathing:'shower'}},
    {name:'Diagonal split + two 3.3', shape:() => SH(WG(0, 5400, 0, 5400, SPL(2200, 3200)), WG(0, 4400, 0, 4400, SPL(2200))), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'bath', desk:true}},
    {name:'Diagonal split + 4.05 + 3.3', shape:() => SH(WG(0, 5400, 0, 5400, SPL(2200, 3200)), WG(0, 5400, 0, 4400, SPL(2700))), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'bath', desk:true}},
    {name:'Diagonal split + two 4.05', shape:() => SH(WG(0, 5400, 0, 5400, SPL(2200, 3200)), WG(0, 5400, 0, 5400, SPL(2700))), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'bath', desk:true, washer:true}},
  ]},
  {title:'More ideas', note:'Extra options to compare cost and comfort.', items:[
    {name:'Budget box, one wing', shape:() => SH(WG(0, 5400, 600, 5400), WOFF()), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'central'}, prog:{bathing:'shower', toilet:'wc', bed:'bed140', sofa:'none'}},
    {name:'Two wings, work corner', shape:() => SH(WG(0, 4200, 0, 3200), WG(1200, 5400, 2000, 5400)), hints:{bathWing:'right', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'shower', desk:true, sofa:'sofabed'}},
    {name:'Wall-bed studio, big living room', shape:SHAPE_A, hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'shower', bed:'wallbed', desk:true, dining:true, stove:true}},
    {name:'One diagonal-split wing, 21.6 m²', shape:() => SH(WG(0, 5400, 0, 5400, SPL(2200, 3200)), WOFF()), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'bathwing'}, prog:{bathing:'shower', bed:'bed140', sofa:'sofabed', dining:false}},
  ]},
];
const PRESETS = PRESET_GROUPS.flatMap(g => g.items);
function applyPreset(p) {
  S.shape = JSON.parse(JSON.stringify(typeof p.shape === 'function' ? p.shape() : p.shape));
  S.hints = Object.assign({}, p.hints);
  const base = defaultState().program; S.program = Object.assign(base, p.prog || {});
  S.items = []; S.openings = [];
  return autoArrange('all');
}
