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
  if (bw === 'end') { res.mode = 'end'; const depth = h.bathDepth || (S.program.access ? 2200 : S.program.bathing === 'bath' ? 1750 : 1550); res.endY = h.bedEnd === 'top' ? L - depth : depth; }
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
  const inScope = e => S.hints.bathScope !== 'central' || e.mod === 'C';
  const dry = e => !wetKeys.has(e.mod) && !(inScope(e) && (inWetY(e.a[1]) || inWetY(e.b[1])));
  const wetEdge = e => wetKeys.has(e.mod) || (inScope(e) && inWetY(e.a[1]) && inWetY(e.b[1]));
  const target = pl.mode === 'end' ? pl.endY : otherY;
  const da = S.hints.doorAt || 'auto';
  const dsc = e => Math.abs(mid(e)[1] - target) + (e.mod === 'C' ? 0 : 300) + (kitKeys.has(e.mod) && vertical(e) ? 1500 : 0)
    + (da === 'side' ? (vertical(e) ? 0 : 3000) : da === 'end' ? (Math.abs(e.u[0]) > .9 ? 0 : 3000) : 0);
  const de = geo.ext.filter(e => dry(e) && e.len >= 1300 && !isEnd(e, bedY)).sort((a, b) => dsc(a) - dsc(b))[0];
  const dType = S.program.access ? 'door_wide' : 'door';
  const fixedDoors = (S.hints.doors || []).map(d => {
    const e = geo.ext.filter(x => (x.mod === d.mod || x.mod.startsWith(d.mod)) && dot(mul(x.n, -1), d.out) > .9 && x.len >= 1200).sort((a, b) => b.len - a.len)[0];
    if (!e) return null; const ax = Math.abs(d.out[0]) > .5 ? 1 : 0, forward = e.u[ax] >= 0, w = OPN[dType].w;
    return newOpening(dType, e.key, clamp((forward ? d.at : 1 - d.at) * e.len, w / 2 + 150, e.len - w / 2 - 150), {pri:9}); }).filter(Boolean);
  if (fixedDoors.length) ops.push(...fixedDoors);
  else if (de) ops.push(newOpening(dType, de.key, de.len / 2, {pri:9}));
  if (S.program.secondExit && S.hints.extraDoor) {
    const d = S.hints.extraDoor, e = geo.ext.filter(x => (x.mod === d.mod || x.mod.startsWith(d.mod)) && dot(mul(x.n, -1), d.out) > .9 && x.len >= 1100).sort((a, b) => b.len - a.len)[0];
    if (e) { const ax = Math.abs(d.out[0]) > .5 ? 1 : 0, w = OPN[dType].w; ops.push(newOpening(dType, e.key, clamp((e.u[ax] >= 0 ? d.at : 1 - d.at) * e.len, w / 2 + 150, e.len - w / 2 - 150), {pri:9})); }
  } else if (fixedDoors.length < 2 && de && S.program.secondExit) {
    const far = geo.ext.filter(e => dry(e) && e.len >= 1300 && e.key !== de.key && !isEnd(e, bedY)).sort((a, b) => Math.hypot(mid(b)[0] - mid(de)[0], mid(b)[1] - mid(de)[1]) - Math.hypot(mid(a)[0] - mid(de)[0], mid(a)[1] - mid(de)[1]))[0];
    if (far) ops.push(newOpening(dType, far.key, far.len / 2, {pri:9}));
  }
  const ge = geo.ext.filter(e => e.mod === 'C' && isEnd(e, bedY)).sort((a, b) => b.len - a.len)[0];
  if (ge) {
    if (ge.len >= 2600) ops.push(newOpening('glasswall', ge.key, ge.len / 2, {w:Math.min(2000, ge.len - 500), pri:8}));
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
  if (S.program.access) S.items.forEach(i => { if (i.type === 'kitchen') i.opt = Object.assign({}, i.opt, {knee:true}); });
}

function programItems() {
  const p = S.program, st = p.style || 'standard', list = [];
  if (p.access) list.push('accshower', 'acctoilet', 'accbasin');
  else { const bathing = p.bathing === 'bath' ? (st === 'japanese' ? 'ofuro' : 'bath') : 'shower'; list.push(bathing, p.toilet, 'basin'); }
  if (p.washer) list.push('washer');
  list.push('kitchen'); if (p.fridgeTall) list.push('fridge');
  let bed = p.bed; if (st === 'japanese' && bed === 'bed160') bed = 'tatamibed';
  if (bed && bed !== 'none') list.push(bed);
  list.push('energy');
  if (p.wardrobe) list.push(st === 'japanese' ? 'oshiire' : st === 'korean' ? 'jang' : 'wardrobe');
  if (st === 'japanese') list.push('kotatsu');
  else if (st === 'korean') { if (p.sofa && p.sofa !== 'none') list.push(p.sofa); list.push('soban'); }
  else { if (p.sofa && p.sofa !== 'none') list.push(p.sofa); if (p.nook) list.push('nook'); else if (p.dining) list.push('dining'); }
  if (p.desk) list.push('desk');
  if (p.getabako) list.push('getabako'); else if (p.shoe) list.push('shoe');
  if (p.pantry) list.push('pantry');
  if (p.bins) list.push('bins');
  if (p.cleaning) list.push('cleaning');
  if (p.nightstand) list.push('nightstand');
  if (p.divider) list.push('divider');
  if (p.stove) list.push('stove');
  if (p.shelf) list.push('shelf');
  if (p.dryrack && !p.washer) list.push('dryrack');
  return list;
}

function autoArrange(mode) {
  const keep = JSON.stringify(S); let best = null;
  const ess = ['kitchen', 'bed160', 'bed140', 'bed90', 'tatamibed', 'platformbed', 'wallbed', 'energy', 'shower', 'bath', 'ofuro', 'toilet', 'wc', 'basin', 'sofabed', 'accshower', 'acctoilet', 'accbasin'];
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
        const it = newItem('partition', {x:p.c[0], y:p.c[1], rot:p.rot, w:Math.round(p.len)}); it.opt = {door:false, dpos:.5, dw:S.program.access ? 1000 : 700};
        if (p === dp) { const nearB = Math.abs(p.ze.b[1] - otherY) < Math.abs(p.ze.a[1] - otherY), fromEnd = Math.min(S.program.access ? 1500 : 1350, p.len / 2);
          it.opt.door = true; it.opt.dpos = clamp((nearB ? p.len - fromEnd : fromEnd) / p.len, 0, 1); }
        S.items.push(it);
      });
    }
    dryZones = geo.zones.filter(z => !wetKeys.has(z.key));
    cZone = geo.zones.find(z => z.key === 'C');
  } else {
    const y0 = pl.endY;
    const wy = top ? [y0 + 50, L + 10] : [-10, y0 - 50], dy = top ? [-10, y0 - 50] : [y0 + 50, L + 10];
    const scopeC = S.hints.bathScope === 'central';
    const cz0 = geo.zones.find(z => z.key === 'C');
    if (scopeC) {
      // bathroom only inside the central module: walls across it and along any open joint beside it
      let wz = clipZone(cz0, wy[0], wy[1]);
      const jl = geo.mods.find(m => m.key === 'C').edges.filter(e => e.type === 'joint');
      jl.forEach(e => { const lo = Math.min(e.a[1], e.b[1]), hi = Math.max(e.a[1], e.b[1]); if (hi <= wy[0] || lo >= wy[1]) return;
        const nv = e.n, c = dot(e.a, nv) + 100; if (wz) { const P = dedupe(clipHalf(wz.poly, nv, c)); wz = P.length >= 3 ? Object.assign({}, wz, {poly:P}) : null; } });
      if (wz) { const c0 = centroid(wz.poly); wz.edges = wz.poly.map((a, i) => { const b = wz.poly[(i + 1) % wz.poly.length], d = sub(b, a), l = len(d), u = nrm(d); let n = [-u[1], u[0]]; if (dot(n, sub(c0, mul(add(a, b), .5))) < 0) n = mul(n, -1); return {a, b, len:l, u, n, wall:true}; }); }
      wetZs = wz ? [wz] : [];
      if (!lockedPart) jl.forEach(e => { const lo = Math.max(Math.min(e.a[1], e.b[1]), wy[0] - 50), hi = Math.min(Math.max(e.a[1], e.b[1]), wy[1]); if (hi - lo < 300) return;
        const x = e.a[0] + e.n[0] * 50, it = newItem('partition', {x, y:(lo + hi) / 2, rot:90, w:Math.round(hi - lo)}); it.opt = {door:false, dpos:.5, dw:700}; S.items.push(it); });
    } else
    wetZs = geo.zones.map(z => clipZone(z, wy[0], wy[1])).filter(Boolean);
    wetZs.forEach(z => z.edges.forEach(e => { if (Math.abs(e.a[1] - e.b[1]) < 1 && Math.abs(e.a[1] - (top ? wy[0] : wy[1])) < 2) e.wall = true; }));
    dryZones = scopeC ? geo.zones.map(z => z.key === 'C' ? clipZone(z, dy[0], dy[1]) : z).filter(Boolean) : geo.zones.map(z => clipZone(z, dy[0], dy[1])).filter(Boolean);
    cZone = dryZones.find(z => z.key === 'C');
    if (!lockedPart) {
      let xmin = 1e9, xmax = -1e9;
      (scopeC ? [cz0] : geo.zones).forEach(z => { for (let i = 0; i < z.poly.length; i++) { const a = z.poly[i], b = z.poly[(i + 1) % z.poly.length];
        if ((a[1] - y0) * (b[1] - y0) <= 0 && Math.abs(a[1] - b[1]) > 1e-6) { const x = a[0] + (y0 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]); xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); } } });
      if (xmax > xmin) { const it = newItem('partition', {x:(xmin + xmax) / 2, y:y0, rot:0, w:Math.round(xmax - xmin)});
        it.opt = {door:true, dpos:S.hints.bathDoorAt != null ? S.hints.bathDoorAt : clamp((cx + 350 - xmin) / (xmax - xmin), .12, .88), dw:S.program.access ? 1000 : 700}; S.items.push(it); }
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
  if (S.hints.bedIn === 'wing' && cZone) kitZones = [cZone];
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
  const wet = want.filter(t => CAT[t].zone === 'wet' && t !== 'washer').sort((a, b) => CAT[b].w * CAT[b].d - CAT[a].w * CAT[a].d);
  let anchor = null;
  wet.forEach(t => {
    const sc = (it, c) => (anchor ? dist([it.x, it.y], anchor) : -dist([it.x, it.y], doorPt || entry)) + (t === 'acctoilet' && c && c.edge && Math.abs(c.edge.u[0]) > .9 ? 1500 : 0) + (t === 'accshower' && c && c.edge && Math.abs(c.edge.u[0]) > .9 ? 600 : 0);
    let r = place(t, wetZs, sc) || place(t, [liveHalf], sc);
    if (!r && t === 'bath') { r = place('shower', wetZs, sc) || place('shower', [liveHalf], sc); if (r) S.swapped = (S.swapped || []).concat(['Bathtub did not fit, used a shower']); }
    if (r) { if (!anchor) anchor = [r.x, r.y]; } else failed.push(t);
  });
  // washer-dryer last: keep it in the bathroom only if every path stays clear, else under the kitchen counter
  let washerToKitchen = false;
  if (want.includes('washer') && S.program.access) washerToKitchen = true;
  else if (want.includes('washer')) {
    const w0 = walkCheck(geo), b0 = w0 ? w0.unreachable.length : 0;
    const r = place('washer', wetZs, it => anchor ? dist([it.x, it.y], anchor) : 0);
    if (r) { const w1 = walkCheck(geo); if ((w1 ? w1.unreachable.length : 0) > b0) { S.items = S.items.filter(i => i !== r); washerToKitchen = true; } }
    else washerToKitchen = true;
  }
  const doBed = () => {
    const bedT = want.find(t => CAT[t].zone === 'bed'); if (!bedT) return;
    const target = [cx, bedY];
    const sc = (it, c) => dist([it.x, it.y], target) + (c.edge && Math.abs(c.edge.u[0]) > .9 ? 0 : 250);
    const wingBed = S.hints.bedIn === 'wing' ? dryZones.filter(z => z.key !== 'C') : null;
    const tryBed = t => (t === 'platformbed' && place(t, dryZones, (it, c) => it.y + it.x * .5 + (c.edge && Math.abs(c.edge.u[0]) > .9 ? 1200 : 0)))
      || (wingBed && wingBed.length && place(t, wingBed, (it, c) => it.y + (c.edge && Math.abs(c.edge.u[0]) > .9 ? 0 : 900))) || place(t, bedZones, sc) || place(t, dryZones, sc) || place(t, dryZones, sc, {free:true});
    if (tryBed(bedT)) return;
    const alt = bedT === 'platformbed' ? ['bed160', 'bed140'] : ['bed140', 'bed90'].filter(t => BED_TYPES.indexOf(t) > BED_TYPES.indexOf(bedT));
    for (const t of alt) if (tryBed(t)) { S.swapped = (S.swapped || []).concat([`${CAT[bedT].label} did not fit away from the exit, used ${CAT[t].label.toLowerCase()}`]); return; }
    if (bedT !== 'wallbed' && tryBed('wallbed')) { S.swapped = (S.swapped || []).concat([`${CAT[bedT].label} did not fit away from the exit, used a wall bed`]); return; }
    failed.push(bedT);
  };
  const doKitchen = () => {
    if (want.includes('kitchen')) {
      const outerK = S.hints.bedIn === 'wing';
      const sc = (it, c) => -(c.edge ? c.edge.len : 0) * 2 + dist([it.x, it.y], entry) * .3 - (windows.some(w => dist(w, [it.x, it.y]) < 900) ? 600 : 0) + (outerK && c.edge && Math.abs(c.edge.u[0]) > .9 ? 9000 : 0) + (outerK && it.x < cx ? 9000 : 0);
      let rightZ = null;
      if (outerK && cZone) { const P = dedupe(clipHalf(cZone.poly, [1, 0], cx + 200)); if (P.length >= 3) { const c0 = centroid(P);
        rightZ = Object.assign({}, cZone, {poly:P, edges:P.map((a, i) => { const b = P[(i + 1) % P.length], d = sub(b, a), l = len(d), u = nrm(d); let n = [-u[1], u[0]]; if (dot(n, sub(c0, mul(add(a, b), .5))) < 0) n = mul(n, -1);
          const onCut = Math.abs(a[0] - (cx + 200)) < 2 && Math.abs(b[0] - (cx + 200)) < 2; return {a, b, len:l, u, n, wall:!onCut}; })}); } }
      if (!(rightZ && tryShrink('kitchen', [rightZ], sc, 1200)) && !tryShrink('kitchen', kitZones, sc, 1200) && !tryShrink('kitchen', [liveHalf, ...dryZones], sc, 1200)) failed.push('kitchen');
    }
    if (want.includes('fridge')) { const k = S.items.find(i => i.type === 'kitchen'); if (!place('fridge', [...kitZones, ...dryZones], it => k ? dist([it.x, it.y], [k.x, k.y]) : 0)) failed.push('fridge'); }
  };
  if (kitFirst) { doKitchen(); doBed(); } else { doBed(); doKitchen(); }
  if (S.program.access) S.items.forEach(i => { if (i.type === 'kitchen') i.opt = Object.assign({}, i.opt, {knee:true}); });
  if (washerToKitchen) { const k = S.items.find(i => i.type === 'kitchen'); if (k) { k.opt = Object.assign({}, k.opt, {washer:true}); } else failed.push('washer'); }
  const bed = S.items.find(i => CAT[i.type].zone === 'bed');
  const kitItem = () => S.items.find(i => i.type === 'kitchen');
  ['energy', 'nook', 'kotatsu', 'soban', 'dining', 'sofa', 'sofabed', 'wardrobe', 'oshiire', 'jang', 'getabako', 'shoe', 'cleaning', 'pantry', 'desk', 'bins', 'nightstand', 'divider', 'stove', 'shelf'].filter(t => want.includes(t)).forEach(t => {
    let zs = dryZones, sc;
    if (t === 'wardrobe' || t === 'shelf' || t === 'oshiire' || t === 'jang' || t === 'divider') sc = it => (bed ? dist([it.x, it.y], [bed.x, bed.y]) : 0) + (t === 'shelf' ? 600 : 0);
    else if (t === 'nightstand') sc = it => bed ? dist([it.x, it.y], [bed.x, bed.y]) - (dist([it.x, it.y], [bed.x, bed.y]) < bed.w / 2 + 500 ? 800 : 0) : 0;
    else if (t === 'kotatsu' || t === 'soban') { zs = [liveHalf, cZone, ...dryZones]; sc = it => Math.min(...windows.map(w => dist(w, [it.x, it.y])), 4000) * .5 + dist([it.x, it.y], [cx, otherY]) * .3; }
    else if (t === 'getabako') sc = it => dist([it.x, it.y], entry);
    else if (t === 'nook') sc = it => -it.y + (S.hints.bedIn === 'wing' && it.x > cx ? 1500 : 0);
    else if (t === 'pantry' || t === 'bins') sc = it => { const k = kitItem(); return k ? dist([it.x, it.y], [k.x, k.y]) : dist([it.x, it.y], entry); };
    else if (t === 'cleaning') sc = it => dist([it.x, it.y], entry) * .7;
    else if (t === 'sofa' || t === 'sofabed') { zs = [liveHalf, ...dryZones]; sc = it => dist([it.x, it.y], [cx, otherY]) * .6 + (bed ? -dist([it.x, it.y], [bed.x, bed.y]) * .3 : 0); }
    else if (t === 'dining') { zs = [liveHalf, cZone, ...dryZones]; sc = it => Math.min(...windows.map(w => dist(w, [it.x, it.y])), 4000); }
    else if (t === 'desk') sc = it => Math.min(...windows.map(w => dist(w, [it.x, it.y])), 4000);
    else if (t === 'energy' || t === 'shoe') sc = it => dist([it.x, it.y], entry);
    else if (t === 'stove') { zs = [liveHalf, cZone]; sc = it => dist([it.x, it.y], [cx, otherY]); }
    const r = place(t, zs, sc) || ((t === 'sofa' || t === 'sofabed' || t === 'stove' || t === 'kotatsu' || t === 'soban') ? place(t, zs, sc, {free:true}) : null)
      || (['dining', 'kotatsu', 'soban'].includes(t) ? (place('foldtable', zs, sc) || place('nook', zs, sc)) : null)
      || (t === 'sofa' ? (place('benchstore', zs, sc) || place('nook', zs, sc)) : null)
      || (t === 'wardrobe' || t === 'oshiire' ? (place('jang', zs, sc) || place('rail', zs, sc)) : null)
      || (t === 'getabako' ? (place('shoe', zs, sc) || place('benchstore', zs, sc) || place('shoeslim', zs, sc)) : null)
      || (t === 'cleaning' ? place('cleanrail', zs, sc) : null);
    if (!r && !['nightstand', 'divider', 'bins', 'cleaning'].includes(t)) failed.push(t);
  });
  if (want.includes('dryrack')) { const z = wetZs[0] || kitZones[0]; if (z) { const c = centroid(z.poly), it = newItem('dryrack', {x:c[0], y:c[1], rot:0}); S.items.push(it); } }
  // ----- walkway repair: move or drop furniture that blocks the way to anything
  const movable = ['bed160', 'bed140', 'bed90', 'tatamibed', 'platformbed', 'sofa', 'sofabed', 'dining', 'foldtable', 'kotatsu', 'soban', 'divider', 'nightstand', 'stove', 'shoe', 'getabako', 'shelf', 'desk', 'bins', 'cleaning', 'jang', 'wardrobe', 'oshiire', 'pantry', 'fridge'];
  for (let pass = 0; pass < 4; pass++) {
    const wk = walkCheck(geo); if (!wk || !wk.unreachable.length) break;
    const before = wk.unreachable.length; let fixed = false;
    for (const t of movable) {
      const it = S.items.find(i => i.type === t && !i.lock); if (!it) continue;
      const orig = {x:it.x, y:it.y, rot:it.rot}, keep = BED_TYPES.includes(t);
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
      if (!ok && keep) { Object.assign(it, orig); S.items.push(it); continue; }
      if (!ok) failed.push(t);
      fixed = true; break;
    }
    if (!fixed) break;
  }
  {
    const cands = {'Table for two':['nook', 'foldtable'], 'Seats for two':['nook', 'benchstore'], 'Clothes storage for two':['rail', 'jang', 'shelf'], 'Shoe storage':['shoe', 'benchstore', 'getabako', 'shoeslim'], 'Cleaning storage':['cleanrail', 'cleaning']};
    const w0 = walkCheck(geo), base = w0 ? w0.unreachable.length : 0;
    readyForTwo().filter(x => !x.ok && cands[x.k]).forEach(x => {
      if (readyForTwo().find(y => y.k === x.k).ok) return;
      for (const t of cands[x.k]) {
        const r = place(t, dryZones, it => dist([it.x, it.y], t === 'shoe' || t === 'shoeslim' || t === 'cleanrail' ? entry : [cx, otherY]));
        if (!r) continue;
        const w = walkCheck(geo); if ((w ? w.unreachable.length : 0) > base) { S.items = S.items.filter(i => i !== r); continue; }
        break;
      }
    });
  }
  { const r2 = readyForTwo(), k = S.items.find(i => i.type === 'kitchen');
    if (k && k.w >= 1200 && r2.some(x => !x.ok && (x.k === 'Table for two' || x.k === 'Seats for two'))) k.opt = Object.assign({}, k.opt, {pullout:true}); }
  if (S.program.maxStorage) fillStorage(geo, (t, sc) => place(t, dryZones, sc));
  S.unplaced = failed.slice();
  return failed;
}
/* add storage along spare walls until the target is met or no wall is left, never blocking a walkway */
function fillStorage(geo, placer) {
  let added = 0;
  const w0 = walkCheck(geo), base = w0 ? w0.unreachable.length : 0;
  for (const t of ['benchstore', 'getabako', 'shelf', 'jang', 'benchstore', 'shelf', 'getabako']) {
    if (storageLitres() >= STORE_TARGET * 1.3 || added >= 7) break;
    const r = placer ? placer(t, () => 0) : (() => { const sp = findSpot(t, null, geo); if (!sp) return null; const it = newItem(t, sp); S.items.push(it); return it; })();
    if (!r) continue;
    const w = walkCheck(geo);
    if ((w ? w.unreachable.length : 0) > base || (S.program.access && !turnCheck(geo).living)) { S.items = S.items.filter(i => i !== r); continue; }
    added++;
  }
  // overhead cabinets use the wall above head height, so they cost no floor space
  for (let k = 0; k < 8 && storageLitres() < STORE_TARGET * 1.5; k++) { const sp = findSpot('overhead', null, geo); if (!sp) break; S.items.push(newItem('overhead', sp)); added++; }
  return added;
}

/* ======================= SHAPES & PRESETS ======================= */
const WG = (inTop, inBot, outTop, outBot, split) => ({on:true, w:1500, inTop, inBot, outTop, outBot, split:split || {type:'none', a:2200, b:3200}});
const WOFF = () => ({on:false, w:1500, inTop:0, inBot:3200, outTop:0, outBot:2200, split:{type:'none', a:2200, b:3200}});
const SH = (l, r) => ({Wc:2500, L:5400, left:l, right:r});
const SPL = (a, b) => b == null ? {type:'straight', a, b:a} : {type:'diag', a, b};
const SHAPE_A = () => SH(WG(0, 5400, 1000, 5400), WG(0, 3200, 0, 2200));
const SHAPE_B = () => SH(WG(0, 3200, 0, 2200), WG(0, 5400, 1000, 5400, SPL(3200)));
const BIGM = (inTop, inBot) => ({on:true, w:3100, inTop, inBot, outTop:inTop, outBot:inBot, split:{type:'none', a:2200, b:3200}});
const SMALLM = (inTop, inBot) => ({on:true, w:2100, inTop, inBot, outTop:inTop, outBot:inBot, split:{type:'none', a:2200, b:3200}});
const SHAPE_2M = () => ({Wc:3100, L:5200, wallT:250, roof:'gable', left:SMALLM(1000, 5200), right:WOFF()});
const MAIN_PROG = {access:false, secondExit:false, bed:'platformbed', dining:false, sofa:'none', wardrobe:false, desk:false, bathing:'shower'};
const ACC = {access:true, secondExit:false, bed:'bed160', dining:true, nook:true, sofa:'none', wardrobe:true, desk:false};
const DOOR_MAIN = [{mod:'C', out:[1, 0], at:.82}];
const LINK_DOOR = {mod:'LW', out:[0, -1], at:.55};
const H2M = {bathWing:'end', bathScope:'central', bedEnd:'bottom', kitchenIn:'central', doorAt:'side', bedIn:'wing', doors:DOOR_MAIN, extraDoor:LINK_DOOR, bathDoorAt:.3};
const PRESET_GROUPS = [
  {title:'Our home: two modules, 24.94 m²', note:'Our main design, as in our render: a 16.12 m² and an 8.82 m² module, one outside door, a raised sleeping platform with storage, gable steel roof. Add a second door from Furnish to link another module.', items:[
    {name:'Our home, as rendered', main:true, fixed:true, shape:SHAPE_2M, hints:Object.assign({}, H2M, {bathDepth:1250}), prog:MAIN_PROG, site:{entry:'steps', rise:740, north:0}},
    {name:'Wheelchair-accessible version', fixed:true, shape:SHAPE_2M, hints:Object.assign({}, H2M, {bathDepth:2300, bathDoorAt:.65}), prog:Object.assign({}, ACC, {bed:'wallbed', kitchen:1500}), site:{entry:'ramp', rise:450, north:0}},
    {name:'Small + small + big, 33.76 m²', shape:() => ({Wc:2100, L:4200, wallT:250, roof:'gable', left:SMALLM(0, 4200), right:BIGM(-1000, 4200)}), hints:{bathWing:'right', bedEnd:'bottom', kitchenIn:'central', doorAt:'side'}, prog:{bed:'platformbed', sofa:'sofa', dining:true}},
    {name:'Small + big + small, 33.76 m²', shape:() => ({Wc:3100, L:5200, wallT:250, roof:'gable', left:SMALLM(1000, 5200), right:SMALLM(1000, 5200)}), hints:{bathWing:'end', bathScope:'central', bedEnd:'bottom', kitchenIn:'wing', doorAt:'side'}, prog:{bed:'bed160', sofa:'sofa', dining:true}},
    {name:'Small + big + big, 41.06 m²', shape:() => ({Wc:3100, L:5200, wallT:250, roof:'gable', left:SMALLM(1000, 5200), right:BIGM(0, 5200)}), hints:{bathWing:'right', bedEnd:'bottom', kitchenIn:'central', doorAt:'side'}, prog:{bed:'bed160', sofa:'sofa', dining:true, desk:true}},
  ]},
  {title:'Signature homes, three modules', note:'All 24.9 m², two outlines with different room layouts.', items:[
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
    {name:'Japanese couple home', shape:SHAPE_A, hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{style:'japanese', bathing:'bath', bed:'bed160'}},
    {name:'Korean couple home', shape:SHAPE_B, hints:{bathWing:'end', bedEnd:'top', kitchenIn:'wing'}, prog:{style:'korean', bathing:'shower', bed:'bed160'}},
    {name:'Budget box, one wing', shape:() => SH(WG(0, 5400, 600, 5400), WOFF()), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'central'}, prog:{bathing:'shower', toilet:'wc', bed:'bed140', sofa:'none'}},
    {name:'Two wings, work corner', shape:() => SH(WG(0, 4200, 0, 3200), WG(1200, 5400, 2000, 5400)), hints:{bathWing:'right', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'shower', desk:true, sofa:'sofabed'}},
    {name:'Wall-bed studio, big living room', shape:SHAPE_A, hints:{bathWing:'left', bedEnd:'top', kitchenIn:'wing'}, prog:{bathing:'shower', bed:'wallbed', desk:true, dining:true, stove:true}},
    {name:'One diagonal-split wing, 21.6 m²', shape:() => SH(WG(0, 5400, 0, 5400, SPL(2200, 3200)), WOFF()), hints:{bathWing:'left', bedEnd:'top', kitchenIn:'bathwing'}, prog:{bathing:'shower', bed:'bed140', sofa:'sofabed', dining:false}},
  ]},
];
const PRESETS = PRESET_GROUPS.flatMap(g => g.items);
function applyPreset(p) {
  const shape = JSON.stringify(typeof p.shape === 'function' ? p.shape() : p.shape);
  const base = Object.assign(defaultState().program, p.prog || {});
  const misses = () => { const g = buildGeo(S.shape), v = validate(g);
    return readyForTwo().filter(x => !x.ok).length * 10
      + (S.unplaced || []).filter(t => ['kitchen', 'toilet', 'wc', 'basin', 'shower', 'bath', 'ofuro', 'accshower', 'acctoilet', 'accbasin'].concat(BED_TYPES).includes(t)).length * 30
      + Object.values(v.items).filter(x => x.length).length * 15 + Object.values(v.ops).filter(x => x.length).length * 15
      + v.checks.filter(c => c.state !== 'ok' && !/wide-load|limit|faces|No room found|Ready for two/i.test(c.text)).reduce((k, c) => k + (/wheelchair|turning|Step-free/i.test(c.text) ? 25 : 7), 0); };
  const progs = p.fixed ? [base, Object.assign({}, base, {kitchen:Math.min(base.kitchen, 1500)}), Object.assign({}, base, {bed:'bed140'}), Object.assign({}, base, {bed:'bed140', kitchen:1500}), Object.assign({}, base, {bed:'wallbed'})] : [base, Object.assign({}, base, {desk:false}), Object.assign({}, base, {desk:false, bathing:'shower'}), Object.assign({}, base, {desk:false, bathing:'shower', kitchen:Math.min(base.kitchen, 1500)})];
  const hintsList = [p.hints];
  if (!p.fixed) ['left', 'right', 'end'].forEach(bw => ['wing', 'central', 'bathwing'].forEach(ki => ['auto', 'side'].forEach(dr => {
    if (ki === 'bathwing' && bw === 'end') return;
    const h = Object.assign({}, p.hints, {bathWing:bw, kitchenIn:ki, doorAt:dr});
    if (JSON.stringify(h) !== JSON.stringify(Object.assign({doorAt:'auto'}, p.hints))) hintsList.push(h); })));
  const tries = []; progs.forEach(pr => tries.push([p.hints, pr]));
  if (p.fixed && base.access) [2100, 2200, 2300, 2400].forEach(dp => [base, Object.assign({}, base, {bed:'bed140', kitchen:1500}), Object.assign({}, base, {bed:'wallbed', maxStorage:false}), Object.assign({}, base, {bed:'bed140', maxStorage:false, wardrobe:false})].forEach(pr => tries.push([Object.assign({}, p.hints, {bathDepth:dp}), pr]))); hintsList.slice(1).forEach(h => progs.slice(0, 2).forEach(pr => tries.push([h, pr])));
  let best = null, failedBest = [];
  for (const [h, pr] of tries.slice(0, 30)) {
    S.shape = JSON.parse(shape); S.hints = Object.assign({}, h); S.program = JSON.parse(JSON.stringify(pr)); S.items = []; S.openings = [];
    let f; try { f = autoArrange('all'); } catch (e) { continue; }
    const sc = misses();
    if (!best || sc < best.sc) { best = {sc, st:JSON.stringify(S)}; failedBest = f; }
    if (sc === 0) break;
  }
  S = Object.assign(S, JSON.parse(best.st));
  if (p.site) Object.assign(S.site, p.site);
  return failedBest;
}
