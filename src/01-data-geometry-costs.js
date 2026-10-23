(() => {
'use strict';
const $ = s => document.querySelector(s);
const T = 200;          // wall build-up, outer cladding face to inner board face (mm)
const PIL_EXT = 132;    // outer face to pillar centre
const FLOOR_H = 240;    // finished floor above pillar base (mm)
const WALL_H = 3000;    // frame + roof edge (mm)
const CEIL = 2650;      // finished ceiling above base (mm)
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;

/* ======================= CATALOGUE ======================= */
const CAT = {
  bed160:   {label:'Double bed 160', grp:'Sleep',   cls:'c-sleep',   w:1600, d:2050, h:600,  cost:220, clear:450, wall:true,  zone:'bed'},
  bed140:   {label:'Bed 140',        grp:'Sleep',   cls:'c-sleep',   w:1400, d:2050, h:600,  cost:190, clear:450, wall:true,  zone:'bed'},
  bed90:    {label:'Single bed 90',  grp:'Sleep',   cls:'c-sleep',   w:900,  d:2000, h:600,  cost:120, clear:450, wall:true,  zone:'bed'},
  wallbed:  {label:'Wall bed, folds up', grp:'Sleep', cls:'c-sleep', w:1700, d:450, h:2100, cost:380, clear:1700, wall:true, zone:'bed'},
  sofabed:  {label:'Sofa bed',       grp:'Living',  cls:'c-living',  w:1900, d:950,  h:850,  cost:260, clear:1100,wall:true,  zone:'living'},
  sofa:     {label:'Sofa, 2 seats',  grp:'Living',  cls:'c-living',  w:1500, d:850,  h:820,  cost:180, clear:500, wall:true,  zone:'living'},
  dining:   {label:'Table, 2 chairs',grp:'Living',  cls:'c-living',  w:800,  d:1300, h:750,  cost:80, clear:0,   wall:false, zone:'living'},
  foldtable:{label:'Fold-down table',grp:'Living',  cls:'c-living',  w:900,  d:450,  h:750,  cost:45, clear:600, wall:true,  zone:'living'},
  desk:     {label:'Desk and chair', grp:'Living',  cls:'c-living',  w:1000, d:1100, h:750,  cost:70, clear:0,   wall:true,  zone:'work'},
  stove:    {label:'Wood stove',     grp:'Living',  cls:'c-tech',    w:500,  d:500,  h:900,  cost:320, clear:600, wall:true,  zone:'living'},
  wardrobe: {label:'Wardrobe',       grp:'Storage', cls:'c-store',   w:1000, d:600,  h:2100, cost:120, clear:600, wall:true,  zone:'store'},
  shelf:    {label:'Shelving',       grp:'Storage', cls:'c-store',   w:800,  d:350,  h:2000, cost:35,  clear:450, wall:true,  zone:'store'},
  shoe:     {label:'Entry bench',    grp:'Storage', cls:'c-store',   w:800,  d:400,  h:450,  cost:30,  clear:400, wall:true,  zone:'entry'},
  kitchen:  {label:'Kitchen run',    grp:'Kitchen', cls:'c-kitchen', w:1800, d:600,  h:900,  cost:0,   clear:900, wall:true,  zone:'kitchen', opt:{sink:.72, cook:.25, fridge:true}},
  fridge:   {label:'Tall fridge',    grp:'Kitchen', cls:'c-kitchen', w:600,  d:650,  h:1800, cost:280, clear:900, wall:true,  zone:'kitchen'},
  shower:   {label:'Shower 800',     grp:'Bath',    cls:'c-bath',    w:800,  d:800,  h:2000, cost:170, clear:550, wall:true,  zone:'wet'},
  bath:     {label:'Bathtub',        grp:'Bath',    cls:'c-bath',    w:1500, d:700,  h:550,  cost:220, clear:600, wall:true,  zone:'wet'},
  toilet:   {label:'Dry toilet',     grp:'Bath',    cls:'c-bath',    w:450,  d:650,  h:450,  cost:380, clear:600, wall:true,  zone:'wet'},
  wc:       {label:'Flush toilet',   grp:'Bath',    cls:'c-bath',    w:400,  d:650,  h:450,  cost:90, clear:600, wall:true,  zone:'wet'},
  basin:    {label:'Basin unit',     grp:'Bath',    cls:'c-bath',    w:500,  d:420,  h:900,  cost:70, clear:550, wall:true,  zone:'wet'},
  washer:   {label:'Washing machine',grp:'Bath',    cls:'c-bath',    w:600,  d:600,  h:850,  cost:190, clear:600, wall:true,  zone:'wet'},
  energy:   {label:'Energy cabinet', grp:'Tech',    cls:'c-tech',    w:600,  d:500,  h:2000, cost:90, clear:700, wall:true,  zone:'tech'},
  partition:{label:'Inside wall',    grp:'Build',   cls:'c-build',   w:2000, d:100,  h:2450, cost:0,   clear:0,   wall:false, zone:'any', opt:{door:true, dpos:.5, dw:700}},
  skylight: {label:'Roof window',    grp:'Build',   cls:'c-roof',    w:550,  d:1000, h:0,    cost:0,   clear:0,   wall:false, zone:'any', overlay:true},
};
const OPN = {
  door:      {label:'Entry door',        kind:'door',  w:900,  h:2100, sill:0},
  door_glass:{label:'Glazed door',       kind:'door',  w:900,  h:2100, sill:0, glass:true},
  slide:     {label:'Sliding glass door',kind:'slide', w:2000, h:2200, sill:0, glass:true},
  win_s:     {label:'Small window',      kind:'win',   w:600,  h:600,  sill:1500, glass:true},
  win_m:     {label:'Window',            kind:'win',   w:1200, h:1200, sill:900,  glass:true},
  win_strip: {label:'Strip window',      kind:'win',   w:1800, h:700,  sill:1150, glass:true},
  win_tall:  {label:'Picture window',    kind:'win',   w:1200, h:2200, sill:50,   glass:true},
};

/* ======================= PRICES (base USD) ======================= */
const PRICE_DEF = {
  steel_kg:        {v:1.6,  l:'Steel frame, fabricated and galvanized, per kg'},
  pile:            {v:90,  l:'Screw pile, installed, each'},
  clad_fibre:      {v:20,   l:'Cladding, fibre-cement, per m²'},
  clad_timber:     {v:30,   l:'Cladding, timber boards, per m²'},
  clad_steel:      {v:12,   l:'Cladding, steel sheet, per m²'},
  wall_ins_std:    {v:15,   l:'Wall insulation, 100 + 50 mm rockwool and membranes, per m²'},
  wall_ins_eco:    {v:8,   l:'Wall insulation, 100 mm rockwool only, per m²'},
  lining:          {v:6,    l:'Inside wall board, painted, per m²'},
  roof:            {v:32,   l:'Roof build-up, deck, insulation and EPDM, per m²'},
  floorbuild:      {v:24,   l:'Floor build-up, deck, two rockwool layers, soffit, per m²'},
  fin_vinyl:       {v:9,   l:'Floor finish, vinyl, per m²'},
  fin_lino:        {v:18,   l:'Floor finish, linoleum, per m²'},
  fin_ply:         {v:4,    l:'Floor finish, oiled plywood, per m²'},
  ceiling:         {v:7,   l:'Ceiling board, painted, per m²'},
  door_ext:        {v:220,  l:'Insulated entry door'},
  door_glass:      {v:380,  l:'Glazed entry door'},
  slide_dbl:       {v:650, l:'Sliding glass door 2 m, double glazed'},
  slide_tri:       {v:950, l:'Sliding glass door 2 m, triple glazed'},
  win_dbl:         {v:110,  l:'Window, double glazed, per m²'},
  win_tri:         {v:180,  l:'Window, triple glazed, per m²'},
  skylight:        {v:250,  l:'Roof window 550 × 1000'},
  partition_m:     {v:45,   l:'Inside wall, per metre'},
  door_int:        {v:90,  l:'Inside sliding door'},
  kitchen_base:    {v:180,  l:'Kitchen, sink, tap and hob, fixed part'},
  kitchen_m:       {v:180,  l:'Kitchen, per metre of counter'},
  kitchen_fridge:  {v:260,  l:'Kitchen, under-counter DC fridge'},
  labour_m2:       {v:45,   l:'Factory assembly and fit-out, per m² floor'},
  mep_m2:          {v:22,   l:'Electrics and plumbing rough-in, per m² floor'},
  pv_kwp:          {v:280,  l:'Solar panels with racking, per kWp'},
  batt_kwh:        {v:140,  l:'LiFePO4 battery, per kWh'},
  inverter:        {v:450,  l:'Hybrid inverter and charger'},
  tank_l:          {v:0.12, l:'Water tank under bed, per litre'},
  cistern_l:       {v:0.15, l:'Buried rain cistern, per litre'},
  pump:            {v:180,  l:'Pump, filter and UV unit'},
  greywater:       {v:150,  l:'Greywater reed planter'},
  mvhr:            {v:220,  l:'Fresh-air heat recovery unit, each'},
  heatpump:        {v:450,  l:'Air-to-air heat pump'},
  heater_el:       {v:110,  l:'Electric water heater 50 L'},
  heater_inst:     {v:90,  l:'Instant water heater'},
  heater_solar:    {v:450,  l:'Solar thermal water heater'},
  truck_base:      {v:250,  l:'Truck, fixed charge each'},
  truck_km:        {v:1.6,  l:'Truck, per km each'},
  crane:           {v:450,  l:'Crane, one day'},
  crew:            {v:500,  l:'Site crew, joining and finishing'},
  contingency:     {v:5,    l:'Contingency, percent'},
};
const CUR = {USD:{s:'$', r:1}, EUR:{s:'€', r:.92}, GBP:{s:'£', r:.79}, CNY:{s:'¥', r:7.2}, TRY:{s:'₺', r:34}, MNT:{s:'₮', r:3400}};

/* ======================= STATE ======================= */
function defaultState() {
  const p = {}; for (const k in PRICE_DEF) p[k] = PRICE_DEF[k].v;
  const ip = {}; for (const k in CAT) ip[k] = CAT[k].cost;
  return {
    v: 1, pv: 2, name: 'My microhome',
    shape: {Wc:2500, L:5400,
      left: {on:true, w:1500, inTop:0, inBot:5400, outTop:1000, outBot:5400, split:{type:'none', a:2200, b:3200}},
      right:{on:true, w:1500, inTop:0, inBot:3200, outTop:0, outBot:2200, split:{type:'none', a:1100, b:1100}}},
    openings: [], items: [],
    hints: {bathWing:'left', bedEnd:'top', kitchenIn:'wing', doorAt:'auto'},
    program: {bed:'bed160', bathing:'shower', toilet:'toilet', kitchen:1800, fridgeTall:false, washer:false,
              wardrobe:true, sofa:'sofa', dining:true, desk:false, stove:false, shelf:false, shoe:true},
    spec: {glazing:'double', cladding:'steel', insul:'std', finish:'ply', frame:'light'},
    sys: {pv:1.8, batt:7.5, tank:true, tankL:880, cisternL:2500, grey:true, mvhr:1, heating:'heatpump', heater:'inst', people:2, sun:4, rain:700},
    site: {km:150, cur:'USD', rate:null, limit:25, north:180, hemi:'N'},
    prices: p, iprices: ip,
  };
}
let S = defaultState();

/* ======================= GEOMETRY ======================= */
const sub = (a, b) => [a[0]-b[0], a[1]-b[1]], add = (a, b) => [a[0]+b[0], a[1]+b[1]], mul = (a, k) => [a[0]*k, a[1]*k];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1], crs = (a, b) => a[0]*b[1] - a[1]*b[0];
const len = a => Math.hypot(a[0], a[1]), nrm = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l]; };
const centroid = P => { let x = 0, y = 0; P.forEach(p => { x += p[0]; y += p[1]; }); return [x/P.length, y/P.length]; };
const polyArea = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i+1)%P.length]; a += p[0]*q[1] - q[0]*p[1]; } return Math.abs(a)/2; };
function dedupe(P) { const o = []; P.forEach(p => { const l = o[o.length-1]; if (!l || Math.hypot(l[0]-p[0], l[1]-p[1]) > 1) o.push(p); }); if (o.length > 2 && Math.hypot(o[0][0]-o[o.length-1][0], o[0][1]-o[o.length-1][1]) < 1) o.pop(); return o; }
function inPoly(p, P) { let c = false; for (let i = 0, j = P.length-1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1]) + a[0]) c = !c; } return c; }

function buildGeo(sh) {
  const L = sh.L, Wc = sh.Wc, LW = sh.left, RW = sh.right;
  const lw = LW.on ? LW.w : 0, xl = lw, xr0 = xl + Wc, rw = RW.on ? RW.w : 0, xr1 = xr0 + rw;
  const jr = w => { if (!w.on) return null; const j = [Math.max(w.inTop, 0), Math.min(w.inBot, L)]; return j[1] - j[0] > 1 ? j : null; };
  const lj = jr(LW), rj = jr(RW);
  const onLine = (a, b, x, j) => !!j && Math.abs(a[0]-x) < 1 && Math.abs(b[0]-x) < 1 && Math.min(a[1], b[1]) >= j[0]-1 && Math.max(a[1], b[1]) <= j[1]+1;
  const mods = [];
  const C = [[xl,0],[xr0,0]];
  if (rj) { if (rj[0] > 1) C.push([xr0, rj[0]]); if (rj[1] < L-1) C.push([xr0, rj[1]]); }
  C.push([xr0, L], [xl, L]);
  if (lj) { if (lj[1] < L-1) C.push([xl, lj[1]]); if (lj[0] > 1) C.push([xl, lj[0]]); }
  mods.push(mkMod('C', 'Central module', C, (a, b) => (onLine(a, b, xr0, rj) || onLine(a, b, xl, lj)) ? ['joint', 'central'] : ['ext']));
  [['left', LW, 'LW', 'Left wing', xl, 0, lj], ['right', RW, 'RW', 'Right wing', xr0, xr1, rj]].forEach(([side, w, key, name, xi, xo, j]) => {
    if (!w.on) return;
    const mids = [0, L].filter(y => w.inTop < y - 1 && w.inBot > y + 1);
    let P = side === 'left'
      ? [[xo, w.outTop], [xi, w.inTop], ...mids.map(y => [xi, y]), [xi, w.inBot], [xo, w.outBot]]
      : [[xi, w.inTop], [xo, w.outTop], [xo, w.outBot], [xi, w.inBot], ...mids.slice().reverse().map(y => [xi, y])];
    P = dedupe(P);
    const sp = w.split || {type:'none'};
    let pieces = [P], line = null;
    if (sp.type === 'straight' || sp.type === 'diag') {
      const A = [xi, sp.a], B = [xo, sp.type === 'diag' ? sp.b : sp.a], d = sub(B, A), nv = nrm([-d[1], d[0]]), c = dot(A, nv);
      const p1 = dedupe(clipHalf(P, nv, c)), p2 = dedupe(clipHalf(P, mul(nv, -1), -c));
      if (p1.length >= 3 && p2.length >= 3 && polyArea(p1) > 3e5 && polyArea(p2) > 3e5) { pieces = [p1, p2].sort((x, y) => centroid(x)[1] - centroid(y)[1]); line = {nv, c}; }
    }
    pieces.forEach((Q, i) => mods.push(mkMod(pieces.length > 1 ? key + (i + 1) : key, pieces.length > 1 ? `${name}, part ${i + 1}` : name, Q, (a, b) => {
      if (onLine(a, b, xi, j)) return ['joint', 'central'];
      if (line && Math.abs(dot(a, line.nv) - line.c) < 1 && Math.abs(dot(b, line.nv) - line.c) < 1) return ['joint', 'piece'];
      return ['ext'];
    })));
  });
  const area = mods.reduce((s, m) => s + polyArea(m.poly), 0) / 1e6;
  let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
  mods.forEach(m => m.poly.forEach(p => { mnx = Math.min(mnx, p[0]); mny = Math.min(mny, p[1]); mxx = Math.max(mxx, p[0]); mxy = Math.max(mxy, p[1]); }));
  const ext = []; mods.forEach(m => m.edges.forEach(e => { if (e.type === 'ext') ext.push(e); }));
  const zones = mods.map(m => zoneOf(m, () => 0));
  return {mods, ext, area, bbox:[mnx, mny, mxx, mxy], zones, L, Wc, xl, xr0, xr1};
}
function mkMod(key, name, poly, typeFn) {
  poly = dedupe(poly);
  const c = centroid(poly), edges = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i+1) % poly.length], d = sub(b, a), l = len(d);
    if (l < 1) continue;
    const u = nrm(d); let n = [-u[1], u[0]];
    if (dot(n, sub(c, mul(add(a, b), .5))) < 0) n = mul(n, -1);
    const tt = typeFn(a, b);
    edges.push({mod:key, i:edges.length, key:key+':'+edges.length, a, b, len:l, u, n, type:tt[0], jk:tt[1] || null});
  }
  return {key, name, poly, edges};
}
/* inward offset of a convex polygon with a distance per edge; returns poly + edge list with source index */
function insetSegs(mod, offFn) {
  const E = mod.edges, n = E.length;
  const lines = E.map(e => { const d = offFn(e); return {p:add(e.a, mul(e.n, d)), u:e.u, n:e.n, d}; });
  const isPar = (A, B) => Math.abs(crs(A.u, B.u)) < 1e-9;
  const inter = (A, B) => { const t = crs(sub(B.p, A.p), B.u) / crs(A.u, B.u); return add(A.p, mul(A.u, t)); };
  const segs = [];
  for (let j = 0; j < n; j++) {
    const P = lines[(j-1+n)%n], Q = lines[j], R = lines[(j+1)%n];
    const s = isPar(P, Q) ? add(E[j].a, mul(Q.n, Q.d)) : inter(P, Q);
    const e = isPar(Q, R) ? add(E[j].b, mul(Q.n, Q.d)) : inter(Q, R);
    segs.push({a:s, b:e, src:j});
  }
  const edges = [];
  for (let j = 0; j < n; j++) {
    edges.push(segs[j]);
    const nx = segs[(j+1)%n];
    if (Math.hypot(segs[j].b[0]-nx.a[0], segs[j].b[1]-nx.a[1]) > 1) edges.push({a:segs[j].b, b:nx.a, src:-1});
  }
  return {poly:edges.map(e => e.a), edges};
}
function zoneOf(mod, jointOff, wallJoint) {
  const z = insetSegs(mod, e => e.type === 'ext' ? T : jointOff(e));
  const wj = typeof wallJoint === 'function' ? wallJoint : () => !!wallJoint;
  const c = centroid(z.poly);
  z.edges.forEach(e => {
    const src = e.src >= 0 ? mod.edges[e.src] : null;
    e.wall = !!src && (src.type === 'ext' || wj(src));
    const d = sub(e.b, e.a); e.len = len(d); e.u = nrm(d); let n = [-e.u[1], e.u[0]];
    if (dot(n, sub(c, mul(add(e.a, e.b), .5))) < 0) n = mul(n, -1); e.n = n;
  });
  z.key = mod.key; return z;
}
/* polygon clip (convex) by half-plane dot(p, n) >= c */
function clipHalf(P, nv, c) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i+1) % P.length], da = dot(a, nv) - c, db = dot(b, nv) - c;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t]); }
  }
  return out;
}
function clipZone(z, y0, y1) {
  let P = clipHalf(z.poly, [0, 1], y0); P = clipHalf(P, [0, -1], -y1); P = dedupe(P);
  if (P.length < 3) return null;
  const c = centroid(P), edges = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i+1) % P.length], d = sub(b, a), l = len(d); if (l < 1) continue;
    const u = nrm(d); let n = [-u[1], u[0]]; if (dot(n, sub(c, mul(add(a, b), .5))) < 0) n = mul(n, -1);
    const m = mul(add(a, b), .5);
    const wall = z.edges.some(e => e.wall && Math.abs(crs(e.u, sub(m, e.a))) < 2 && dot(sub(m, e.a), e.u) > -1 && dot(sub(m, e.a), e.u) < e.len + 1);
    edges.push({a, b, len:l, u, n, wall});
  }
  return {poly:P, edges, key:z.key};
}

/* ----- items ----- */
function itemDims(it) { return {w:it.w, d:it.d}; }
function rectPoly(x, y, w, d, rot) {
  const t = rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return [[-w/2, -d/2], [w/2, -d/2], [w/2, d/2], [-w/2, d/2]].map(([lx, ly]) => [x + lx*c - ly*s, y + lx*s + ly*c]);
}
function frontDir(rot) { const t = rot * Math.PI / 180; return [-Math.sin(t), Math.cos(t)]; }
function bodyPoly(it) { return rectPoly(it.x, it.y, it.w, it.d, it.rot); }
function clearPoly(it) {
  const c = CAT[it.type].clear; if (!c) return null;
  const f = frontDir(it.rot), o = it.d/2 + c/2;
  return rectPoly(it.x + f[0]*o, it.y + f[1]*o, it.w, c, it.rot);
}
function overlap(A, B, tol = 2) {
  let ax0 = 1e18, ax1 = -1e18, ay0 = 1e18, ay1 = -1e18, bx0 = 1e18, bx1 = -1e18, by0 = 1e18, by1 = -1e18;
  for (const p of A) { if (p[0] < ax0) ax0 = p[0]; if (p[0] > ax1) ax1 = p[0]; if (p[1] < ay0) ay0 = p[1]; if (p[1] > ay1) ay1 = p[1]; }
  for (const p of B) { if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0]; if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1]; }
  if (ax1 - tol <= bx0 || bx1 - tol <= ax0 || ay1 - tol <= by0 || by1 - tol <= ay0) return false;
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i+1) % P.length], ax = [-(b[1]-a[1]), b[0]-a[0]], L = Math.hypot(ax[0], ax[1]) || 1, n = [ax[0]/L, ax[1]/L];
    let a0 = 1e18, a1 = -1e18, b0 = 1e18, b1 = -1e18;
    A.forEach(p => { const v = dot(p, n); a0 = Math.min(a0, v); a1 = Math.max(a1, v); });
    B.forEach(p => { const v = dot(p, n); b0 = Math.min(b0, v); b1 = Math.max(b1, v); });
    if (a1 - tol <= b0 || b1 - tol <= a0) return false;
  }
  return true;
}
function partitionParts(it) {
  // returns wall pieces (local) honouring the door gap
  const o = it.opt || {}, w = it.w;
  if (!o.door) return [[-w/2, w/2]];
  const dw = clamp(o.dw || 700, 500, w - 100), c = clamp((o.dpos ?? .5) * w - w/2, -w/2 + dw/2, w/2 - dw/2);
  const parts = []; if (c - dw/2 > -w/2 + 20) parts.push([-w/2, c - dw/2]); if (c + dw/2 < w/2 - 20) parts.push([c + dw/2, w/2]);
  return parts;
}
function partitionPolys(it) {
  const t = it.rot * Math.PI / 180, cs = Math.cos(t), sn = Math.sin(t);
  return partitionParts(it).map(([a, b]) => { const m = (a + b) / 2; return rectPoly(it.x + m*cs, it.y + m*sn, b - a, it.d, it.rot); });
}
function solidPolys(it) { if (CAT[it.type].overlay) return []; return it.type === 'partition' ? partitionPolys(it) : [bodyPoly(it)]; }

/* ----- openings ----- */
function edgeByKey(geo, k) { return geo.ext.find(e => e.key === k); }
function opFrame(geo, o) {
  const e = edgeByKey(geo, o.edge); if (!e) return null;
  const a = add(e.a, mul(e.u, o.s - o.w/2)), b = add(e.a, mul(e.u, o.s + o.w/2));
  return {e, a, b};
}
function opZones(geo, o) {
  const f = opFrame(geo, o); if (!f) return null;
  const spec = OPN[o.type], depth = spec.kind === 'win' ? 380 : 950, inner = T;
  const p0 = add(f.a, mul(f.e.n, inner)), p1 = add(f.b, mul(f.e.n, inner)), q1 = add(p1, mul(f.e.n, depth)), q0 = add(p0, mul(f.e.n, depth));
  return {poly:[p0, p1, q1, q0], tall:spec.kind === 'win', sill:o.sill};
}

/* shared placement helpers */
function probePts(P) { const c = centroid(P), out = [];
  P.forEach((p, i) => { const q = P[(i + 1) % P.length]; out.push(p, mul(add(p, q), .5)); });
  return out.map(p => { const d = sub(c, p), l = len(d); return l < 4 ? p : add(p, mul(d, 4 / l)); }); }
function zbb(z) { if (!z._bb) { let a = 1e18, b = 1e18, c = -1e18, d = -1e18; for (const p of z.poly) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; } z._bb = [a, b, c, d]; } return z._bb; }
function inZones(x, y, zones) { for (const z of zones) { const b = zbb(z); if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; if (inPoly([x, y], z.poly)) return true; } return false; }
function insideZones(P, zones) {
  let cx = 0, cy = 0; for (const p of P) { cx += p[0]; cy += p[1]; } cx /= P.length; cy /= P.length;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    for (const [x, y] of [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]]) {
      const dx = cx - x, dy = cy - y, l = Math.hypot(dx, dy), k = l < 4 ? 0 : 4 / l;
      if (!inZones(x + dx * k, y + dy * k, zones)) return false;
    }
  }
  return true;
}
function partitionFaces(items) {
  const out = [];
  items.filter(i => i.type === 'partition').forEach(it => {
    const t = it.rot * Math.PI / 180, u = [Math.cos(t), Math.sin(t)], n = [-Math.sin(t), Math.cos(t)];
    partitionParts(it).forEach(([a, b]) => [1, -1].forEach(sg => {
      const off = mul(n, sg * it.d / 2), A = add(add([it.x, it.y], mul(u, a)), off), B = add(add([it.x, it.y], mul(u, b)), off);
      out.push({a:A, b:B, len:b - a, u, n:mul(n, sg), wall:true, part:true});
    }));
  });
  return out;
}
/* ======================= VALIDATION ======================= */
function validate(geo) {
  const res = {items:{}, ops:{}, checks:[]};
  const zones = geo.zones;
  const bodies = S.items.map(it => ({it, polys:solidPolys(it), clr:clearPoly(it)}));
  const opz = S.openings.map(o => ({o, z:opZones(geo, o)}));
  bodies.forEach(B => {
    const issues = []; const it = B.it, cat = CAT[it.type];
    const polys = cat.overlay ? [bodyPoly(it)] : B.polys;
    const okIn = it.type === 'partition'
      ? (() => { const t = it.rot * Math.PI / 180, u = [Math.cos(t), Math.sin(t)], h = Math.max(0, it.w / 2 - 120);
          return [-1, -.5, 0, .5, 1].every(k => zones.some(z => inPoly(add([it.x, it.y], mul(u, k * h)), z.poly))); })()
      : polys.every(P => insideZones(P, zones));
    if (!okIn) issues.push(cat.overlay ? 'Not over the roof of a module' : 'Pokes into a wall or outside the house');
    if (!cat.overlay) {
      bodies.forEach(C => { if (C === B || CAT[C.it.type].overlay) return;
        if (B.polys.some(p => C.polys.some(q => overlap(p, q)))) issues.push('Overlaps ' + CAT[C.it.type].label.toLowerCase());
        else if (B.clr && C.polys.some(q => overlap(B.clr, q, 40)) && C.it.type !== 'partition') issues.push('Not enough space in front (' + CAT[C.it.type].label.toLowerCase() + ')');
      });
      opz.forEach(({o, z}) => { if (!z) return; if (z.tall && cat.h <= z.sill + 30) return;
        if (B.polys.some(p => overlap(p, z.poly, 20))) issues.push(OPN[o.type].kind === 'win' ? 'Blocks a window' : 'Blocks a doorway'); });
    }
    if (BED_TYPES.includes(it.type)) { const d = bedExitDist(it, exitSegments(geo)); if (d < BED_EXIT_MIN) issues.push(`Too close to the exit (${(d / 1000).toFixed(1)} m, keep ${BED_EXIT_MIN / 1000} m clear)`); }
    res.items[it.id] = [...new Set(issues)];
  });
  S.openings.forEach(o => {
    const iss = []; const e = edgeByKey(geo, o.edge);
    if (!e) iss.push('Its wall no longer exists');
    else {
      if (o.s - o.w/2 < 180 || o.s + o.w/2 > e.len - 180) iss.push('Too close to a corner pillar');
      S.openings.forEach(p => { if (p !== o && p.edge === o.edge && Math.abs(p.s - o.s) < (p.w + o.w)/2 + 150) iss.push('Too close to another opening'); });
    }
    res.ops[o.id] = [...new Set(iss)];
  });
  // checks
  const has = (...t) => S.items.some(i => t.includes(i.type));
  const ck = (state, text) => res.checks.push({state, text});
  const lim = S.site.limit || 0;
  if (lim) ck(geo.area <= lim + 1e-4 ? 'ok' : 'bad', geo.area <= lim + 1e-4 ? `Floor area ${geo.area.toFixed(1)} m², within the ${lim} m² limit` : `Floor area ${geo.area.toFixed(1)} m² is over the ${lim} m² limit`);
  else ck('ok', `Floor area ${geo.area.toFixed(1)} m², no limit set`);
  ck(S.openings.some(o => OPN[o.type].kind === 'door') ? 'ok' : 'bad', S.openings.some(o => OPN[o.type].kind === 'door') ? 'Entry door placed' : 'Add an entry door');
  ck(has('bed160','bed140','bed90','sofabed','wallbed') ? 'ok' : 'bad', has('bed160','bed140','bed90','sofabed','wallbed') ? 'Somewhere to sleep' : 'Add a bed or sofa bed');
  const segs = exitSegments(geo), beds = S.items.filter(i => BED_TYPES.includes(i.type));
  if (beds.length && segs.length) { const d = Math.min(...beds.map(b => bedExitDist(b, segs)));
    ck(d >= BED_EXIT_MIN ? 'ok' : 'bad', d >= BED_EXIT_MIN ? `Bed is ${(d / 1000).toFixed(1)} m from the nearest exit` : `Bed is only ${(d / 1000).toFixed(1)} m from an exit. Keep it at least ${BED_EXIT_MIN / 1000} m away`); }
  ck(has('kitchen') ? 'ok' : 'bad', has('kitchen') ? 'Kitchen with sink and hob' : 'Add a kitchen run');
  ck(has('toilet','wc') ? 'ok' : 'bad', has('toilet','wc') ? 'Toilet' : 'Add a toilet');
  ck(has('shower','bath') ? 'ok' : 'bad', has('shower','bath') ? 'Shower or bath' : 'Add a shower or bath');
  ck(has('basin') || has('kitchen') ? 'ok' : 'warn', has('basin') ? 'Hand basin' : 'No hand basin, kitchen sink will be used');
  ck(has('energy') ? 'ok' : 'warn', has('energy') ? 'Energy cabinet for batteries' : 'Add an energy cabinet for batteries and inverter');
  const wet = S.items.filter(i => CAT[i.type].zone === 'wet');
  if (wet.length) {
    const wetMods = new Set(wet.map(i => grp(modAt(geo, i.x, i.y))));
    const walled = S.items.some(i => i.type === 'partition');
    ck(walled ? 'ok' : 'warn', walled ? 'Bathroom closed off by an inside wall' : 'Bathroom has no inside wall for privacy');
    ck(wetMods.size <= 1 || (S.hints.bathWing === 'end' && wetMods.size <= 2) ? 'ok' : 'warn', wetMods.size <= 1 || (S.hints.bathWing === 'end' && wetMods.size <= 2) ? 'Wet fittings grouped together, short pipes' : 'Wet fittings spread over modules, longer pipes');
  }
  if (S.swapped && S.swapped.length) S.swapped.forEach(t => ck('warn', t));
  if (S.unplaced && S.unplaced.length) { const miss = S.unplaced.filter(t => CAT[t] && !S.items.some(i => i.type === t)); if (miss.length) ck('warn', 'No room found for: ' + miss.map(t => CAT[t].label.toLowerCase()).join(', ') + '. Add them from Furnish, or pick smaller ones.'); }
  const br = bracing(geo);
  ck(br.x >= 2 && br.y >= 2 ? 'ok' : 'bad', `Solid walls for bracing: ${br.x} across, ${br.y} along (need 2 each)`);
  const glass = S.openings.reduce((s, o) => s + (OPN[o.type].glass ? o.w * o.h : 0), 0) / 1e6;
  const gr = glass / Math.max(geo.area, 1);
  ck(gr >= .1 && gr <= .35 ? 'ok' : 'warn', gr < .1 ? `Glass ${glass.toFixed(1)} m², rooms may feel dark (aim 10–35% of floor)` : gr > .35 ? `Glass ${glass.toFixed(1)} m², high heat loss and overheating risk` : `Glass ${glass.toFixed(1)} m², ${Math.round(gr*100)}% of floor`);
  const sun = sunCheck(geo); if (sun) ck(sun.ok ? 'ok' : 'warn', sun.text);
  const wk = walkCheck(geo);
  if (wk) ck(wk.unreachable.length ? 'warn' : 'ok', wk.unreachable.length ? `Hard to reach (needs a 55 cm path, 40 cm in the bathroom): ${[...new Set(wk.unreachable.map(i => CAT[i.type].label.toLowerCase()))].join(', ')}` : 'A clear path reaches everything from the door');
  const bad = Object.values(res.items).filter(a => a.length).length + Object.values(res.ops).filter(a => a.length).length;
  ck(bad ? 'bad' : 'ok', bad ? `${bad} part${bad > 1 ? 's' : ''} need moving (red outline)` : 'Nothing overlaps or blocks a door');
  if (S.shape.Wc > 2550) ck('warn', 'Central module wider than 2.55 m needs a wide-load permit');
  return res;
}
const grp = k => k.startsWith('LW') ? 'LW' : k.startsWith('RW') ? 'RW' : k === '?' ? '?' : 'C';
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
function dirName(vec) { // plan vector -> compass name, using site.north (degrees the plan top is turned from north)
  const n = (S.site.north || 0) * Math.PI / 180;
  const az = (Math.atan2(vec[0], -vec[1]) + n) * 180 / Math.PI;
  return DIRS[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}
function sunVec() { const n = (S.site.north || 0) * Math.PI / 180; const north = [-Math.sin(n), -Math.cos(n)]; return S.site.hemi === 'S' ? north : mul(north, -1); }
function sunCheck(geo) {
  const g = S.openings.filter(o => OPN[o.type].glass).sort((a, b) => b.w * b.h - a.w * a.h)[0]; if (!g) return null;
  const e = edgeByKey(geo, g.edge); if (!e) return null;
  const out = mul(e.n, -1), sv = sunVec(), c = dot(out, sv), dn = dirName(out), sn = S.site.hemi === 'S' ? 'north' : 'south';
  return c > .5 ? {ok:true, text:`Main glass faces ${dn}, toward the sun`} : {ok:false, text:`Main glass faces ${dn}. Turn the house so it faces ${sn} for free winter heat`};
}
function modAt(geo, x, y) { const m = geo.mods.find(m => inPoly([x, y], m.poly)); return m ? m.key : '?'; }
function bracing(geo) {
  let x = 0, y = 0;
  geo.ext.forEach(e => {
    if (e.len < 900) return;
    if (S.openings.some(o => o.edge === e.key)) return;
    const ax = Math.abs(e.u[0]), ay = Math.abs(e.u[1]);
    if (ax > .9) x++; else if (ay > .9) y++; else { x++; y++; }
  });
  return {x, y};
}

/* beds must stay clear of every exit */
const BED_EXIT_MIN = 1800;
const BED_TYPES = ['bed160', 'bed140', 'bed90', 'wallbed'];
function exitSegments(geo, openings) {
  return (openings || S.openings).filter(o => OPN[o.type].kind === 'door' || o.type === 'slide').map(o => { const f = opFrame(geo, o); if (!f) return null;
    return [add(f.a, mul(f.e.n, T)), add(f.b, mul(f.e.n, T))]; }).filter(Boolean);
}
function bedFootprints(it) { const P = [bodyPoly(it)]; if (it.type === 'wallbed') { const c = clearPoly(it); if (c) P.push(c); } return P; }
function bedExitDist(it, segs) {
  let m = 1e9;
  for (const [a, b] of segs) for (let k = 0; k <= 6; k++) { const p = add(a, mul(sub(b, a), k / 6)); for (const P of bedFootprints(it)) m = Math.min(m, polyDist(p, P)); }
  return m;
}
/* walkway check: can a person (about 55 cm wide) walk from the entry to the front of every item? */
function segDist(p, a, b) { const d = sub(b, a), l2 = dot(d, d) || 1, t = clamp(dot(sub(p, a), d) / l2, 0, 1); return Math.hypot(p[0] - a[0] - d[0]*t, p[1] - a[1] - d[1]*t); }
function polyDist(p, P) { if (inPoly(p, P)) return 0; let m = 1e9; for (let i = 0; i < P.length; i++) m = Math.min(m, segDist(p, P[i], P[(i + 1) % P.length])); return m; }
function walkCheck(geo, st, R0) {
  st = st || S;
  if (!R0) { const a = walkCheck(geo, st, 270); if (!a || !a.unreachable.some(i => CAT[i.type].zone === 'wet')) return a;
    const b = walkCheck(geo, st, 200); const ids = new Set(b ? b.unreachable.map(i => i.id) : []);
    return {unreachable:a.unreachable.filter(i => CAT[i.type].zone !== 'wet' || ids.has(i.id)), entryBlocked:a.entryBlocked}; }
  const R = R0, C = 100, zones = geo.zones, walls = [];
  zones.forEach(z => z.edges.forEach(e => { if (e.wall) walls.push(e); }));
  const [x0, y0, x1, y1] = geo.bbox, nx = Math.ceil((x1 - x0) / C), ny = Math.ceil((y1 - y0) / C);
  const free = new Uint8Array(nx * ny), seen = new Uint8Array(nx * ny);
  const cx = i => x0 + (i + .5) * C, cy = j => y0 + (j + .5) * C;
  const range = (lo, hi, n, o) => [Math.max(0, Math.floor((lo - o) / C)), Math.min(n - 1, Math.ceil((hi - o) / C))];
  // 1. inside the rooms
  zones.forEach(z => { const xs = z.poly.map(p => p[0]), ys = z.poly.map(p => p[1]);
    const [i0, i1] = range(Math.min(...xs), Math.max(...xs), nx, x0), [j0, j1] = range(Math.min(...ys), Math.max(...ys), ny, y0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * nx + i; if (!free[k] && inPoly([cx(i), cy(j)], z.poly)) free[k] = 1; } });
  // 2. keep clear of walls and furniture (only cells near each one are tested)
  const clearNear = (xsLo, ysLo, xsHi, ysHi, distFn) => {
    const [i0, i1] = range(xsLo - R, xsHi + R, nx, x0), [j0, j1] = range(ysLo - R, ysHi + R, ny, y0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * nx + i; if (free[k] && distFn([cx(i), cy(j)]) < R) free[k] = 0; } };
  walls.forEach(e => clearNear(Math.min(e.a[0], e.b[0]), Math.min(e.a[1], e.b[1]), Math.max(e.a[0], e.b[0]), Math.max(e.a[1], e.b[1]), p => segDist(p, e.a, e.b)));
  st.items.filter(i => CAT[i.type] && !CAT[i.type].overlay).forEach(i => solidPolys(i).forEach(P => {
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]); clearNear(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), p => polyDist(p, P)); }));
  const door = st.openings.find(o => OPN[o.type].kind === 'door'); if (!door) return null;
  const f = opFrame(geo, door); if (!f) return null;
  const near = (p, rad, arr) => { const ci = Math.floor((p[0] - x0) / C), cj = Math.floor((p[1] - y0) / C); let best = -1, bd = 1e9;
    for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      const k = j * nx + i; if (!arr[k]) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = k; } } return best; };
  const start = near(add(mul(add(f.a, f.b), .5), mul(f.e.n, T + R + 80)), 5, free);
  const all = st.items.filter(i => CAT[i.type] && !CAT[i.type].overlay && i.type !== 'partition');
  if (start < 0) return {unreachable:all, entryBlocked:true};
  const q = [start]; seen[start] = 1;
  while (q.length) { const k = q.pop(), i = k % nx, j = (k - i) / nx;
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
      const kk = b * nx + a; if (seen[kk] || !free[kk]) continue; if (di && dj && (!free[j * nx + a] || !free[b * nx + i])) continue; seen[kk] = 1; q.push(kk); } }
  const unreachable = all.filter(it => {
    const c = CAT[it.type], fr = frontDir(it.rot), sd = [fr[1], -fr[0]];
    const pts = [add([it.x, it.y], mul(fr, it.d/2 + R + 60))];
    if (!c.wall) { pts.push(add([it.x, it.y], mul(fr, -(it.d/2 + R + 60))), add([it.x, it.y], mul(sd, it.w/2 + R + 60)), add([it.x, it.y], mul(sd, -(it.w/2 + R + 60)))); }
    return !pts.some(p => near(p, 3, seen) >= 0);
  });
  return {unreachable};
}

/* ======================= COSTS ======================= */
function money(v) {
  const c = CUR[S.site.cur] || CUR.USD, r = S.site.rate || c.r, val = v * r;
  const big = Math.abs(val) >= 100000;
  return c.s + (Math.round(val / (big ? 100 : 1)) * (big ? 100 : 1)).toLocaleString('en-US');
}
function itemCost(it) {
  const P = S.prices;
  if (it.type === 'kitchen') return P.kitchen_base + P.kitchen_m * it.w / 1000 + (it.opt && it.opt.fridge ? P.kitchen_fridge : 0);
  if (it.type === 'partition') return P.partition_m * it.w / 1000 + (it.opt && it.opt.door ? P.door_int : 0);
  if (it.type === 'skylight') return P.skylight;
  return S.iprices[it.type] ?? CAT[it.type].cost;
}
function opCost(o) {
  const P = S.prices, sp = OPN[o.type], tri = S.spec.glazing === 'triple';
  if (o.type === 'door') return P.door_ext;
  if (o.type === 'door_glass') return P.door_glass;
  if (o.type === 'slide') return (tri ? P.slide_tri : P.slide_dbl) * Math.max(.7, o.w / 2000);
  return Math.max(140, (tri ? P.win_tri : P.win_dbl) * o.w * o.h / 1e6);
}
function pillarsOf(geo) {
  const out = [];
  geo.mods.forEach(m => {
    const z = insetSegs(m, e => e.type === 'ext' ? PIL_EXT : 50);
    z.poly.forEach(p => out.push({mod:m.key, p}));
    // extra pillars on long exterior walls
    m.edges.forEach((e, i) => { if (e.type !== 'ext' || e.len <= 3800) return; const k = Math.ceil(e.len / 3600) - 1;
      for (let j = 1; j <= k; j++) out.push({mod:m.key, p:add(add(e.a, mul(e.u, e.len * j / (k + 1))), mul(e.n, PIL_EXT))}); });
  });
  return out;
}
function trucksFor(geo) {
  const mods = geo.mods.map(m => { const xs = m.poly.map(p => p[0]), ys = m.poly.map(p => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), l = Math.max(...ys) - Math.min(...ys); return {k:m.key, w:Math.min(w, l), l:Math.max(w, l)}; });
  mods.sort((a, b) => b.l - a.l);
  const trucks = [];
  mods.forEach(m => { const t = trucks.find(t => t.used + m.l <= 13400 && m.w <= 2550); if (t) { t.used += m.l; t.m.push(m.k); } else trucks.push({used:m.l, m:[m.k], wide:m.w > 2550}); });
  return {n:trucks.length, wide:trucks.some(t => t.wide), mods};
}
function costs(geo) {
  const P = S.prices, A = geo.area;
  const lines = [];
  const L = (g, t, v) => lines.push({g, t, v});
  // structure
  const pil = pillarsOf(geo).length;
  const ringLen = geo.mods.reduce((s, m) => s + m.edges.reduce((a, e) => a + e.len, 0), 0) / 1000;
  const extLen = geo.ext.reduce((s, e) => s + e.len, 0) / 1000;
  const opW = S.openings.reduce((s, o) => s + o.w, 0) / 1000;
  const light = S.spec.frame !== 'stack';
  const steel = light
    ? pil * 2.85 * 14.1 + ringLen * (18.2 + 15.1) + A * (9.5 + 7.7) + Math.max(0, extLen - opW) * 10.7 + S.openings.length * 18 + 6 * 25
    : pil * 2.85 * 16.6 + ringLen * (26.4 + 18.6) + A * (16.7 + 13.3) + Math.max(0, extLen - opW) * 27.5 + S.openings.length * 45 + 6 * 35;
  const steelKg = steel * (light ? 1.06 : 1.1);
  L('Steel frame', `${light ? 'Single-storey' : 'Stackable 4-storey'} steel frame, about ${Math.round(steelKg)} kg (${pil} pillars, rings, joists, studs, bracing)`, steelKg * P.steel_kg);
  const pairs = geo.mods.reduce((s, m) => s + m.edges.filter(e => e.type === 'joint').length, 0); // joint edges (both sides)
  const piles = Math.max(4, pil - pairs);
  L('Steel frame', `${piles} screw piles`, piles * P.pile);
  // envelope
  const opA = S.openings.reduce((s, o) => s + o.w * o.h, 0) / 1e6;
  const clad = Math.max(0, extLen * WALL_H / 1000 - opA);
  const cp = {fibre:P.clad_fibre, timber:P.clad_timber, steel:P.clad_steel}[S.spec.cladding];
  L('Walls, floor and roof', `Cladding, ${clad.toFixed(1)} m²`, clad * cp);
  const insA = Math.max(0, extLen * 2.6 - opA);
  L('Walls, floor and roof', `Wall insulation, ${insA.toFixed(1)} m²`, insA * (S.spec.insul === 'std' ? P.wall_ins_std : P.wall_ins_eco));
  L('Walls, floor and roof', `Inside wall board, ${insA.toFixed(1)} m²`, insA * P.lining);
  L('Walls, floor and roof', `Roof build-up, ${A.toFixed(1)} m²`, A * P.roof);
  L('Walls, floor and roof', `Floor build-up, ${A.toFixed(1)} m²`, A * P.floorbuild);
  L('Walls, floor and roof', `Floor finish, ${S.spec.finish}`, A * {vinyl:P.fin_vinyl, lino:P.fin_lino, ply:P.fin_ply}[S.spec.finish]);
  L('Walls, floor and roof', 'Ceiling board', A * P.ceiling);
  // openings
  S.openings.forEach(o => L('Doors and windows', `${OPN[o.type].label} ${o.w} × ${o.h}`, opCost(o)));
  S.items.filter(i => i.type === 'skylight').forEach(i => L('Doors and windows', 'Roof window', itemCost(i)));
  // interior
  S.items.filter(i => i.type !== 'skylight').forEach(i => L('Fit-out and furniture', CAT[i.type].label + (i.type === 'kitchen' || i.type === 'partition' ? ` ${(i.w/1000).toFixed(1)} m` : ''), itemCost(i)));
  // systems
  const y = S.sys;
  if (y.pv > 0) L('Energy and water', `Solar ${y.pv} kWp`, y.pv * P.pv_kwp);
  if (y.batt > 0) L('Energy and water', `Battery ${y.batt} kWh`, y.batt * P.batt_kwh);
  if (y.pv > 0 || y.batt > 0) L('Energy and water', 'Inverter and charger', P.inverter);
  if (y.tank) L('Energy and water', `Water tank under bed, ${y.tankL} L`, y.tankL * P.tank_l);
  if (y.cisternL > 0) L('Energy and water', `Rain cistern, ${y.cisternL} L`, y.cisternL * P.cistern_l);
  L('Energy and water', 'Pump, filter and UV', P.pump);
  if (y.grey) L('Energy and water', 'Greywater planter', P.greywater);
  if (y.mvhr > 0) L('Energy and water', `${y.mvhr} fresh-air units`, y.mvhr * P.mvhr);
  if (y.heating === 'heatpump') L('Energy and water', 'Heat pump', P.heatpump);
  L('Energy and water', {el:'Water heater 50 L', inst:'Instant water heater', solar:'Solar water heater'}[y.heater], {el:P.heater_el, inst:P.heater_inst, solar:P.heater_solar}[y.heater]);
  // labour
  L('Factory labour and services', `Assembly and fit-out, ${A.toFixed(1)} m²`, A * P.labour_m2);
  L('Factory labour and services', 'Electrics and plumbing', A * P.mep_m2);
  // transport
  const tr = trucksFor(geo);
  L('Transport and install', `${tr.n} truck${tr.n > 1 ? 's' : ''}, ${S.site.km} km${tr.wide ? ', wide load' : ''}`, tr.n * (P.truck_base + P.truck_km * S.site.km) * (tr.wide ? 1.4 : 1));
  L('Transport and install', 'Crane, one day', P.crane);
  L('Transport and install', 'Site crew', P.crew);
  const sub = lines.reduce((s, l) => s + l.v, 0);
  L('Contingency', `Contingency ${P.contingency}%`, sub * P.contingency / 100);
  const total = lines.reduce((s, l) => s + l.v, 0);
  const groups = {}; lines.forEach(l => groups[l.g] = (groups[l.g] || 0) + l.v);
  return {lines, groups, total, steelKg, trucks:tr, piles};
}
/* cost-saving ideas */
function savers(geo, base) {
  const ideas = [];
  const tryIt = (label, fn) => { const snap = JSON.stringify(S); fn(); const g = buildGeo(S.shape); const c = costs(g).total; S = JSON.parse(snap); if (base - c > 30) ideas.push({label, save:base - c, fn}); };
  if (S.spec.glazing === 'triple') tryIt('Double instead of triple glazing (more heat loss)', () => S.spec.glazing = 'double');
  if (S.spec.frame === 'stack') tryIt('Single-storey frame instead of stackable', () => S.spec.frame = 'light');
  if (S.spec.cladding !== 'steel') tryIt('Steel sheet cladding', () => S.spec.cladding = 'steel');
  if (S.spec.finish !== 'ply') tryIt('Oiled plywood floor finish', () => S.spec.finish = 'ply');
  if (S.items.some(i => i.type === 'bath')) tryIt('Shower instead of bathtub, also saves water', () => S.items.forEach(i => { if (i.type === 'bath') { i.type = 'shower'; i.w = 800; i.d = 800; } }));
  if (S.items.some(i => i.type === 'toilet')) tryIt('Flush toilet instead of dry toilet (uses water)', () => S.items.forEach(i => { if (i.type === 'toilet') { i.type = 'wc'; i.w = 400; } }));
  if (S.sys.heater === 'solar') tryIt('Electric water heater', () => S.sys.heater = 'el');
  if (S.sys.mvhr > 1) tryIt('One fresh-air unit fewer', () => S.sys.mvhr -= 1);
  if (S.sys.batt > 5) tryIt('Smaller battery, 5 kWh less', () => S.sys.batt = Math.max(0, S.sys.batt - 5));
  const k = S.items.find(i => i.type === 'kitchen' && i.w > 1500); if (k) tryIt('Shorter kitchen, 0.6 m less', () => S.items.find(i => i.id === k.id).w -= 600);
  if (S.openings.some(o => o.type === 'slide')) tryIt('Picture window instead of sliding door', () => S.openings.forEach(o => { if (o.type === 'slide') { o.type = 'win_tall'; o.w = Math.min(o.w, 1600); } }));
  if (S.site.km > 60) tryIt('Build within 60 km of the factory', () => S.site.km = 60);
  return ideas.sort((a, b) => b.save - a.save).slice(0, 6);
}
/* off-grid balance */
function offgrid() {
  const y = S.sys, it = t => S.items.some(i => i.type === t);
  let kwh = 0.8; // lights, devices, controls
  if (it('kitchen')) kwh += 1.1 + (S.items.some(i => i.type === 'kitchen' && i.opt && i.opt.fridge) ? .5 : 0);
  if (it('fridge')) kwh += .6;
  if (it('washer')) kwh += .4;
  kwh += .25; // pump
  kwh += y.mvhr * .15;
  if (y.heater === 'el') kwh += 1.6 * y.people / 2; else if (y.heater === 'inst') kwh += 1.4 * y.people / 2; else kwh += .3;
  const winter = y.heating === 'heatpump' ? 3.2 : 0;
  const pv = y.pv * y.sun * .8;
  const days = (y.batt * .9) / Math.max(kwh, .1);
  const perPerson = it('bath') ? 85 : 55; const water = y.people * perPerson + 15 + (it('wc') ? y.people * 25 : 0);
  const geo = G.geo; const rainDay = geo.area * y.rain * .8 / 365; // litres/day from roof
  const store = (y.tank ? y.tankL : 0) + y.cisternL; const wdays = store / water;
  return {kwh, winter, pv, days, water, rainDay, store, wdays};
}
