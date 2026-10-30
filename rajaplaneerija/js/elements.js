'use strict';
/* Rajaelementide kataloog ja nende 3D-kujud.
   Allikas: Catalog of UAV Tracks with Price-2026.pdf (hinnad USD/tk, EXW).
   Mõõdud meetrites. Elemendi kohalikud teljed: x – paremale, y – läbilennu suund, z – üles.
   Alguspunkt on elemendi keskel põrandal. */

const COL = {
  red: '#e5484d', white: '#f8fafc', blue: '#2563eb', navy: '#1e3a8a', orange: '#f97316',
  yellow: '#facc15', black: '#1f2937', pole: '#71717a', base: '#3f3f46',
  camo: ['rgba(77,107,60,0.92)', 'rgba(123,140,78,0.92)'],
  tunnel: ['rgba(96,165,250,0.55)', 'rgba(224,242,254,0.55)'],
  soft: ['rgba(239,68,68,0.82)', 'rgba(249,115,22,0.82)'],
};

function Geo() { this.prims = []; }
Geo.prototype.line = function (a, b, c, w) { this.prims.push({ k: 'l', a, b, c, w: w || 0.025 }); };
Geo.prototype.poly = function (pts, f, s) { this.prims.push({ k: 'p', pts, f, s: s || null }); };
// Murdjoon, mille värv vahetub iga `run` lõigu järel
Geo.prototype.strip = function (pts, colors, w, run) {
  run = run || 1;
  for (let i = 0; i < pts.length - 1; i++) this.line(pts[i], pts[i + 1], colors[Math.floor(i / run) % colors.length], w);
};

function arc(c, ru, rv, plane, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n, u = Math.cos(a) * ru, v = Math.sin(a) * rv;
    if (plane === 'xz') out.push([c[0] + u, c[1], c[2] + v]);
    else if (plane === 'yz') out.push([c[0], c[1] + u, c[2] + v]);
    else out.push([c[0] + u, c[1] + v, c[2]]);
  }
  return out;
}
const circle = (c, r, plane, n) => arc(c, r, r, plane, 0, Math.PI * 2, n || 40);

function pole(g, x, y, z0, z1) { g.line([x, y, z0], [x, y, z1], COL.pole, 0.03); }
function crossBase(g, x, y, s) {
  s = s || 0.25;
  g.line([x - s, y - s, 0], [x + s, y + s, 0], COL.base, 0.035);
  g.line([x - s, y + s, 0], [x + s, y - s, 0], COL.base, 0.035);
}
function tripod(g, x, y) {
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 0.5;
    g.line([x, y, 0.35], [x + Math.cos(a) * 0.3, y + Math.sin(a) * 0.3, 0], COL.base, 0.025);
  }
}
function stand(g, x, y, top, kind) { pole(g, x, y, 0, top); kind === 'tripod' ? tripod(g, x, y) : crossBase(g, x, y); }
function rectXZ(g, x0, x1, z0, z1, f) { g.poly([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], f, 'rgba(0,0,0,0.3)'); }
function disc(g, c, r, f) { g.poly(circle(c, r, 'xy', 32), f); }
// Silinder telje 'y' (rõhtne) või 'z' (püstine) suunas; tagastab otsaringide punktid
function cylinder(g, c, r, len, axis, fills, n) {
  n = n || 16;
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, u = Math.cos(a) * r, v = Math.sin(a) * r;
    ring.push(axis === 'y'
      ? [[c[0] + u, c[1] - len / 2, c[2] + v], [c[0] + u, c[1] + len / 2, c[2] + v]]
      : [[c[0] + u, c[1] + v, c[2] - len / 2], [c[0] + u, c[1] + v, c[2] + len / 2]]);
  }
  for (let i = 0; i < n; i++) g.poly([ring[i][0], ring[i + 1][0], ring[i + 1][1], ring[i][1]], fills[i % fills.length]);
  return ring;
}
const RING_COLORS = [COL.red, COL.white, COL.blue, COL.white];

function triLayout(v) {
  const r = v.d / 2, s = v.d * 1.08, low = r + 0.35;
  return [[-s, low], [0, low + v.d * 0.85], [s, low]];
}

/* Iga tüübi kirjeldus:
   name/en: eestikeelne nimi ja kataloogi nimi; nameEn: ingliskeelne nimi, kui see erineb kataloogi nimest
   kind: 'gate' (läbitav ava), 'pylon' (lipp, millest lennatakse mööda), 'pad' (start/maandumine)
   variants: kataloogi suurused ja hinnad (price: null = müüakse ainult komplektis; labelEn: silt inglise keeles)
   adjustable: keskpunkti kõrgust saab muuta (zRange piires)
   fp(v): põrandajälje poollaius ja poolsügavus
   geom(v, z): joonistusprimitiivid kohalikes koordinaatides
   openings(v, z): avad { name, c, dir, size, depth, zMin, zMax } */
const TYPES = {
  flag: {
    name: 'Lipp', en: 'Blade flag', group: 'Märgid', icon: 'flag.svg', kind: 'pylon', defaultV: 1,
    variants: [
      { label: '125 cm, väike alus', labelEn: '125 cm, small base', h: 1.25, price: 11.5 },
      { label: '200 cm, ristalus', labelEn: '200 cm, cross base', h: 2.0, price: 12.8 },
      { label: '200 cm, ristalus + veekott', labelEn: '200 cm, cross base + water bag', h: 2.0, price: 15.5 },
      { label: '270 cm, ristalus + veekott (komplektis)', labelEn: '270 cm, cross base + water bag (in set)', h: 2.7, price: null },
    ],
    fp: () => [0.28, 0.28],
    geom(v) {
      const g = new Geo(), h = v.h;
      crossBase(g, 0, 0);
      g.line([0, 0, 0], [0, 0, h], COL.pole, 0.025);
      g.poly([[0, 0, h], [0.22, 0, h - 0.05], [0.34, 0, h - 0.4], [0.3, 0, h * 0.45], [0, 0, h * 0.32]], COL.blue, COL.navy);
      return g.prims;
    },
    openings: () => [],
  },
  pad: {
    name: 'Maandumisplats', en: 'Landing pad', group: 'Märgid', icon: 'pad.svg', kind: 'pad', defaultV: 1,
    variants: [
      { label: 'Ø 60 cm (komplektis)', labelEn: 'Ø 60 cm (in set)', d: 0.6, price: null },
      { label: 'Ø 80 cm', d: 0.8, price: 10.5 },
      { label: 'Ø 100 cm', d: 1.0, price: 12.5 },
    ],
    fp: v => [v.d / 2, v.d / 2],
    geom(v) {
      const g = new Geo(), r = v.d / 2, h = r * 0.3, z = 0.01, w = r * 0.1;
      disc(g, [0, 0, 0.004], r, COL.navy);
      disc(g, [0, 0, 0.006], r * 0.8, COL.white);
      disc(g, [0, 0, 0.008], r * 0.62, COL.orange);
      g.line([-h, -h, z], [-h, h, z], COL.white, w);
      g.line([h, -h, z], [h, h, z], COL.white, w);
      g.line([-h, 0, z], [h, 0, z], COL.white, w);
      return g.prims;
    },
    openings: () => [],
  },
  ring: {
    name: 'Rõngas', en: 'Circular ring', group: 'Rõngad', icon: 'ring.svg', kind: 'gate', defaultV: 2, adjustable: true,
    variants: [
      { label: 'Ø 40 cm, kolmjalg', labelEn: 'Ø 40 cm, tripod', d: 0.4, z: 0.8, tripod: true, price: 38.5 },
      { label: 'Ø 60 cm, kolmjalg (komplektis)', labelEn: 'Ø 60 cm, tripod (in set)', d: 0.6, z: 0.9, tripod: true, price: null },
      { label: 'Ø 80 cm, ristalus', labelEn: 'Ø 80 cm, cross base', d: 0.8, z: 1.0, price: 43.5 },
      { label: 'Ø 90 cm, ristalus', labelEn: 'Ø 90 cm, cross base', d: 0.9, z: 1.0, price: 47.5 },
      { label: 'Ø 100 cm, ristalus', labelEn: 'Ø 100 cm, cross base', d: 1.0, z: 1.1, price: 45.5 },
      { label: 'Ø 150 cm, ristalus', labelEn: 'Ø 150 cm, cross base', d: 1.5, z: 1.2, price: 59.5 },
    ],
    zRange: v => [v.d / 2 + 0.15, 2.5],
    fp: v => [v.tripod ? 0.32 : v.d / 2 + 0.25, 0.28],
    geom(v, z) {
      const g = new Geo(), r = v.d / 2;
      if (v.tripod) stand(g, 0, 0, z - r, 'tripod');
      else { stand(g, -r - 0.03, 0, z, 'cross'); stand(g, r + 0.03, 0, z, 'cross'); }
      g.strip(circle([0, 0, z], r, 'xz', 48), RING_COLORS, 0.06, 3);
      return g.prims;
    },
    openings: (v, z) => [{ name: 'Rõngas', nameEn: 'Ring', c: [0, 0, z], dir: [0, 1, 0], size: v.d, depth: 0.1, zMin: z - v.d / 2, zMax: z + v.d / 2 }],
  },
  stacked: {
    name: 'Topeltrõngas', en: 'Stacked loop', group: 'Rõngad', icon: 'stacked.svg', kind: 'gate',
    variants: [{ label: 'Ø 60 cm, kolmjalg + veekott', labelEn: 'Ø 60 cm, tripod + water bag', d: 0.6, price: 93.5 }],
    fp: () => [0.32, 0.32],
    geom(v) {
      const g = new Geo(), r = v.d / 2, z1 = 0.45 + r, z2 = z1 + v.d + 0.04;
      stand(g, 0, 0, 0.45, 'tripod');
      g.line([0, 0, z1 + r], [0, 0, z2 - r], COL.pole, 0.03);
      g.strip(circle([0, 0, z1], r, 'xz', 40), [COL.red, COL.white], 0.05, 2);
      g.strip(circle([0, 0, z2], r, 'xz', 40), [COL.blue, COL.white], 0.05, 2);
      return g.prims;
    },
    openings(v) {
      const r = v.d / 2, z1 = 0.45 + r, z2 = z1 + v.d + 0.04;
      return [
        { name: 'Alumine', nameEn: 'Lower', c: [0, 0, z1], dir: [0, 1, 0], size: v.d, depth: 0.1, zMin: z1 - r, zMax: z1 + r },
        { name: 'Ülemine', nameEn: 'Upper', c: [0, 0, z2], dir: [0, 1, 0], size: v.d, depth: 0.1, zMin: z2 - r, zMax: z2 + r },
      ];
    },
  },
  tri: {
    name: 'Kolmikrõngas', en: 'Tri-gates', group: 'Rõngad', icon: 'tri.svg', kind: 'gate',
    variants: [
      { label: 'Ø 60 cm, ristalused', labelEn: 'Ø 60 cm, cross bases', d: 0.6, price: 86.5 },
      { label: 'Ø 120 cm, suured ristalused + veekotid', labelEn: 'Ø 120 cm, large cross bases + water bags', d: 1.2, price: 127.5 },
    ],
    fp: v => [v.d * 1.6 + 0.05, 0.28],
    geom(v) {
      const g = new Geo(), r = v.d / 2;
      triLayout(v).forEach(([x, z], i) => {
        stand(g, x, 0, z - r, 'cross');
        g.strip(circle([x, 0, z], r, 'xz', 40), i === 1 ? [COL.red, COL.white] : [COL.blue, COL.white], 0.05, 2);
      });
      return g.prims;
    },
    openings(v) {
      const r = v.d / 2, names = ['Vasak', 'Keskmine', 'Parem'], namesEn = ['Left', 'Middle', 'Right'];
      return triLayout(v).map(([x, z], i) => ({ name: names[i], nameEn: namesEn[i], c: [x, 0, z], dir: [0, 1, 0], size: v.d, depth: 0.1, zMin: z - r, zMax: z + r }));
    },
  },
  hround: {
    name: 'Rõhtrõngas', en: 'Horizontal round gate', group: 'Rõngad', icon: 'hround.svg', kind: 'gate', adjustable: true,
    variants: [{ label: 'Ø 120 cm, ristalused + veekotid', labelEn: 'Ø 120 cm, cross bases + water bags', d: 1.2, z: 1.2, price: 92.5 }],
    zRange: () => [0.6, 2.4],
    fp: v => [v.d / 2 + 0.3, v.d / 2 + 0.02],
    geom(v, z) {
      const g = new Geo(), r = v.d / 2;
      stand(g, -r - 0.03, 0, z, 'cross');
      stand(g, r + 0.03, 0, z, 'cross');
      g.strip(circle([0, 0, z], r, 'xy', 48), [COL.yellow, COL.black], 0.06, 3);
      return g.prims;
    },
    openings: (v, z) => [{ name: 'Ülalt alla', nameEn: 'From above', c: [0, 0, z], dir: [0, 0, -1], size: v.d, depth: 0.1 }],
  },
  hgates: {
    name: 'Rõhtväravad', en: 'Horizontal gates', group: 'Rõngad', icon: 'hgates.svg', kind: 'gate',
    variants: [
      { label: 'Ø 60 cm, kõrgused 2,2 / 1,2 m', labelEn: 'Ø 60 cm, heights 2.2 / 1.2 m', d: 0.6, price: 112.5 },
      { label: 'Ø 80 cm, kõrgused 2,2 / 1,2 m', labelEn: 'Ø 80 cm, heights 2.2 / 1.2 m', d: 0.8, price: 122.5 },
    ],
    fp: v => [v.d + 0.4, v.d / 2 + 0.02],
    geom(v) {
      const g = new Geo(), r = v.d / 2, x = r + 0.12;
      stand(g, -x - r - 0.03, 0, 2.2, 'cross');
      stand(g, x + r + 0.03, 0, 1.2, 'cross');
      g.strip(circle([-x, 0, 2.2], r, 'xy', 40), [COL.red, COL.white], 0.05, 2);
      g.strip(circle([x, 0, 1.2], r, 'xy', 40), [COL.blue, COL.white], 0.05, 2);
      return g.prims;
    },
    openings(v) {
      const x = v.d / 2 + 0.12;
      return [
        { name: 'Kõrge (2,2 m)', nameEn: 'High (2.2 m)', c: [-x, 0, 2.2], dir: [0, 0, -1], size: v.d, depth: 0.1 },
        { name: 'Madal (1,2 m)', nameEn: 'Low (1.2 m)', c: [x, 0, 1.2], dir: [0, 0, -1], size: v.d, depth: 0.1 },
      ];
    },
  },
  arch: {
    name: 'Kaarvärav', en: 'Arch gate', group: 'Väravad', icon: 'arch.svg', kind: 'gate',
    variants: [
      { label: 'Ø 100 cm, ristalused', labelEn: 'Ø 100 cm, cross bases', w: 1.0, h: 1.0, price: 27.8 },
      { label: 'Ø 100 cm, ristalused + veekotid', labelEn: 'Ø 100 cm, cross bases + water bags', w: 1.0, h: 1.0, price: 31.5 },
      { label: 'Ø 120 cm, ristalused + veekotid', labelEn: 'Ø 120 cm, cross bases + water bags', w: 1.2, h: 1.2, price: 33.5 },
    ],
    fp: v => [v.w / 2 + 0.35, 0.28],
    geom(v) {
      const g = new Geo(), a = v.w / 2 + 0.09;
      crossBase(g, -a, 0);
      crossBase(g, a, 0);
      const pts = arc([0, 0, 0], a, v.h + 0.09, 'xz', 0, Math.PI, 32);
      g.strip(pts.slice(0, 17), [COL.orange], 0.17);
      g.strip(pts.slice(16), [COL.blue], 0.17);
      return g.prims;
    },
    openings: v => [{ name: 'Kaar', nameEn: 'Arch', c: [0, 0, v.h * 0.5], dir: [0, 1, 0], size: Math.min(v.w, v.h), depth: 0.2, zMin: 0, zMax: v.h }],
  },
  square: {
    name: 'Ruutvärav', en: 'Square gate', group: 'Väravad', icon: 'square.svg', kind: 'gate',
    variants: [{ label: '120 × 120 cm, ristalus + veekott', labelEn: '120 × 120 cm, cross base + water bag', w: 1.2, h: 1.2, price: 50.5 }],
    fp: v => [v.w / 2 + 0.4, 0.28],
    geom(v) {
      const g = new Geo(), a = v.w / 2, b = 0.14;
      crossBase(g, -a - b / 2, 0);
      crossBase(g, a + b / 2, 0);
      rectXZ(g, -a - b, -a, 0, v.h + b, COL.camo[0]);
      rectXZ(g, a, a + b, 0, v.h + b, COL.camo[0]);
      rectXZ(g, -a, a, v.h, v.h + b, COL.camo[1]);
      return g.prims;
    },
    openings: v => [{ name: 'Värav', nameEn: 'Gate', c: [0, 0, v.h / 2], dir: [0, 1, 0], size: v.w, depth: 0.2, zMin: 0, zMax: v.h }],
  },
  offset: {
    name: 'Kõrgvärav', en: 'Offset gate', group: 'Väravad', icon: 'offset.svg', kind: 'gate',
    variants: [{ label: 'Ava 120 cm, kõrgus 230 cm', labelEn: 'Opening 120 cm, height 230 cm', w: 1.2, top: 2.3, bar: 1.1, price: 73.5 }],
    fp: v => [v.w / 2 + 0.4, 0.28],
    geom(v) {
      const g = new Geo(), a = v.w / 2, b = 0.14;
      crossBase(g, -a - b / 2, 0);
      crossBase(g, a + b / 2, 0);
      rectXZ(g, -a - b, -a, 0, v.top + b, COL.camo[0]);
      rectXZ(g, a, a + b, 0, v.top + b, COL.camo[0]);
      rectXZ(g, -a, a, v.top, v.top + b, COL.camo[1]);
      rectXZ(g, -a, a, v.bar, v.bar + b, COL.camo[1]);
      return g.prims;
    },
    openings(v) {
      const lo = v.bar + 0.14;
      return [{ name: 'Ülemine ava', nameEn: 'Upper opening', c: [0, 0, (lo + v.top) / 2], dir: [0, 1, 0], size: Math.min(v.w, v.top - lo), depth: 0.2, zMin: lo, zMax: v.top }];
    },
  },
  gravity: {
    name: 'Gravitatsioonivärav', en: 'Gravity gate', group: 'Väravad', icon: 'gravity.svg', kind: 'gate',
    variants: [{ label: '120 × 120 cm, kõrgus 230 cm', labelEn: '120 × 120 cm, height 230 cm', w: 1.2, top: 2.3, price: 101.5 }],
    fp: v => [v.w / 2 + 0.3, v.w / 2 + 0.3],
    geom(v) {
      const g = new Geo(), a = v.w / 2 + 0.05, t = v.top, b = t - 0.25;
      const sq = [[-a, -a], [a, -a], [a, a], [-a, a]];
      for (const [x, y] of sq) stand(g, x, y, t, 'cross');
      for (let i = 0; i < 4; i++) {
        const p = sq[i], q = sq[(i + 1) % 4];
        g.poly([[p[0], p[1], b], [q[0], q[1], b], [q[0], q[1], t], [p[0], p[1], t]], COL.camo[i % 2], 'rgba(0,0,0,0.3)');
      }
      return g.prims;
    },
    openings: v => [{ name: 'Ülalt alla', nameEn: 'From above', c: [0, 0, v.top - 0.12], dir: [0, 0, -1], size: v.w, depth: 0.4 }],
  },
  cube: {
    name: 'Kuubikvärav', en: 'Cube gate', group: 'Väravad', icon: 'cube.svg', kind: 'gate',
    variants: [
      { label: 'Ava 80 cm, kõrgus 120 cm', labelEn: 'Opening 80 cm, height 120 cm', w: 0.8, h: 1.2, price: 98.0 },
      { label: 'Ava 120 cm, kõrgus 140 cm', labelEn: 'Opening 120 cm, height 140 cm', w: 1.2, h: 1.4, price: 105.5 },
    ],
    fp: v => { const a = (v.w + 0.1) / 2 + 0.15; return [a, a]; },
    geom(v) {
      const g = new Geo(), s = v.w + 0.1, a = s / 2, zb = Math.max(0.3, v.h - s), zt = zb + s, zc = zb + a, r = v.w * 0.42;
      const sq = [[-a, -a], [a, -a], [a, a], [-a, a]];
      for (const [x, y] of sq) { pole(g, x, y, 0, zb); crossBase(g, x, y, 0.15); }
      for (let i = 0; i < 4; i++) {
        const p = sq[i], q = sq[(i + 1) % 4];
        g.line([p[0], p[1], zb], [q[0], q[1], zb], COL.black, 0.03);
        g.line([p[0], p[1], zt], [q[0], q[1], zt], COL.black, 0.03);
        g.line([p[0], p[1], zb], [p[0], p[1], zt], COL.black, 0.03);
      }
      g.strip(circle([0, -a, zc], r, 'xz', 36), [COL.red, COL.white], 0.05, 2);
      g.strip(circle([0, a, zc], r, 'xz', 36), [COL.red, COL.white], 0.05, 2);
      g.strip(circle([-a, 0, zc], r, 'yz', 36), [COL.blue, COL.white], 0.05, 2);
      g.strip(circle([a, 0, zc], r, 'yz', 36), [COL.blue, COL.white], 0.05, 2);
      g.strip(circle([0, 0, zt], r, 'xy', 36), [COL.blue, COL.white], 0.05, 2);
      return g.prims;
    },
    openings(v) {
      const s = v.w + 0.1, zb = Math.max(0.3, v.h - s), zc = zb + s / 2, r = v.w * 0.42;
      return [
        { name: 'Esikülg', nameEn: 'Front', c: [0, 0, zc], dir: [0, 1, 0], size: 2 * r, depth: s, zMin: zc - r, zMax: zc + r },
        { name: 'Külg', nameEn: 'Side', c: [0, 0, zc], dir: [1, 0, 0], size: 2 * r, depth: s, zMin: zc - r, zMax: zc + r },
      ];
    },
  },
  tunnel: {
    name: 'Tunnel', en: 'Tunnel', group: 'Tunnelid', icon: 'tunnel.svg', kind: 'gate', adjustable: true,
    variants: [
      { label: 'Ø 60 × 100 cm, kolmjalad', labelEn: 'Ø 60 × 100 cm, tripods', d: 0.6, len: 1.0, z: 0.9, price: 40.5 },
      { label: 'Ø 60 × 200 cm, suured ristalused', labelEn: 'Ø 60 × 200 cm, large cross bases', d: 0.6, len: 2.0, z: 0.9, price: 122.0 },
      { label: 'Ø 120 × 120 cm, 4 posti + veekotid', labelEn: 'Ø 120 × 120 cm, 4 posts + water bags', d: 1.2, len: 1.2, z: 1.1, price: 126.5 },
    ],
    zRange: v => [v.d / 2 + 0.2, 2.2],
    fp: v => [Math.max(v.d / 2, 0.3) + 0.05, v.len / 2 + 0.1],
    geom(v, z) {
      const g = new Geo(), r = v.d / 2, ey = v.len / 2 - 0.12;
      if (v.d > 1) { for (const sx of [-r, r]) for (const sy of [-ey, ey]) stand(g, sx, sy, z, 'cross'); }
      else for (const sy of [-ey, ey]) stand(g, 0, sy, z - r, v.len > 1.5 ? 'cross' : 'tripod');
      const ring = cylinder(g, [0, 0, z], r, v.len, 'y', COL.tunnel, 16);
      g.strip(ring.map(q => q[0]), [COL.navy], 0.035);
      g.strip(ring.map(q => q[1]), [COL.navy], 0.035);
      return g.prims;
    },
    openings: (v, z) => [{ name: 'Tunnel', nameEn: 'Tunnel', c: [0, 0, z], dir: [0, 1, 0], size: v.d, depth: v.len, zMin: z - v.d / 2, zMax: z + v.d / 2 }],
  },
  groundTunnel: {
    name: 'Maatunnel', en: 'Ground tunnel', group: 'Tunnelid', icon: 'ground-tunnel.svg', kind: 'gate',
    variants: [{ label: 'Kõrgus 90 cm, pikkus 130 cm, veekott', labelEn: 'Height 90 cm, length 130 cm, water bag', w: 1.2, h: 0.9, len: 1.3, price: 44.5 }],
    fp: v => [v.w / 2 + 0.05, v.len / 2],
    geom(v) {
      const g = new Geo(), n = 12, L = v.len / 2;
      const a = arc([0, 0, 0], v.w / 2, v.h, 'xz', 0, Math.PI, n);
      for (let i = 0; i < n; i++) {
        const p = a[i], q = a[i + 1];
        g.poly([[p[0], -L, p[2]], [q[0], -L, q[2]], [q[0], L, q[2]], [p[0], L, p[2]]], COL.soft[i % 2]);
      }
      g.strip(a.map(p => [p[0], -L, p[2]]), [COL.red], 0.03);
      g.strip(a.map(p => [p[0], L, p[2]]), [COL.red], 0.03);
      return g.prims;
    },
    openings: v => [{ name: 'Tunnel', nameEn: 'Tunnel', c: [0, 0, v.h * 0.45], dir: [0, 1, 0], size: v.h, depth: v.len, zMin: 0, zMax: v.h }],
  },
  shaft: {
    name: 'Šaht', en: 'Shaft', group: 'Tunnelid', icon: 'shaft.svg', kind: 'gate',
    variants: [
      { label: 'Ø 60 × 80 cm, kolmjalad + veekott', labelEn: 'Ø 60 × 80 cm, tripods + water bag', d: 0.6, len: 0.8, top: 1.8, price: 61.5 },
      { label: 'Ø 120 cm, kõrgus 250 cm, suured ristalused', labelEn: 'Ø 120 cm, height 250 cm, large cross bases', d: 1.2, len: 1.0, top: 2.5, price: 115.5 },
    ],
    fp: v => [v.d / 2 + 0.3, v.d / 2 + 0.05],
    geom(v) {
      const g = new Geo(), r = v.d / 2, kind = v.d > 1 ? 'cross' : 'tripod';
      stand(g, -r - 0.04, 0, v.top, kind);
      stand(g, r + 0.04, 0, v.top, kind);
      const ring = cylinder(g, [0, 0, v.top - v.len / 2], r, v.len, 'z', COL.camo, 16);
      g.strip(ring.map(q => q[0]), [COL.base], 0.03);
      g.strip(ring.map(q => q[1]), [COL.base], 0.03);
      return g.prims;
    },
    openings: v => [{ name: 'Ülalt alla', nameEn: 'From above', c: [0, 0, v.top - v.len / 2], dir: [0, 0, -1], size: v.d, depth: v.len }],
  },
  net: {
    name: 'Võrktunnel', en: 'Net-001', nameEn: 'Net tunnel', group: 'Tunnelid', icon: 'net.svg', kind: 'gate',
    variants: [{ label: '18 m, 16 kaart, Ø 1,3 m', labelEn: '18 m, 16 arches, Ø 1.3 m', len: 18, d: 1.3, z: 1.0, price: 900.0 }],
    fp: v => [v.d / 2 + 0.1, v.len / 2 + 0.1],
    geom(v) {
      const g = new Geo(), r = v.d / 2, n = 16, z = v.z, ys = [];
      for (let i = 0; i < n; i++) ys.push(-v.len / 2 + i * v.len / (n - 1));
      for (const y of ys) {
        g.strip(circle([0, y, z], r, 'xz', 24), [COL.white], 0.03);
        pole(g, -r - 0.03, y, 0, z);
        pole(g, r + 0.03, y, 0, z);
      }
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2, x = Math.cos(a) * r, zz = z + Math.sin(a) * r;
        for (let i = 0; i < n - 1; i++) g.line([x, ys[i], zz], [x, ys[i + 1], zz], 'rgba(100,116,139,0.55)', 0.012);
      }
      return g.prims;
    },
    openings: v => [{ name: 'Tunnel', nameEn: 'Tunnel', c: [0, 0, v.z], dir: [0, 1, 0], size: v.d - 0.1, depth: v.len, zMin: v.z - v.d / 2, zMax: v.z + v.d / 2 }],
  },
};

const GROUPS = ['Märgid', 'Rõngad', 'Väravad', 'Tunnelid'];
const GROUPS_EN = { Märgid: 'Markers', Rõngad: 'Rings', Väravad: 'Gates', Tunnelid: 'Tunnels' };

/* Kataloogi rajakomplektid. items: [tüüp, variandi indeks, x, y, pööre°]
   path: [elemendi indeks, lennupunkti seaded]. Pööre -90 = lend +x suunas, 90 = -x suunas. */
const TEMPLATES = [
  {
    name: 'DK-Track-01', price: 335, hall: { w: 20, l: 10 },
    items: [
      ['pad', 1, 2, 6], ['ring', 1, 5, 6, -90], ['tunnel', 0, 9, 6, -90], ['stacked', 0, 13, 6, -90],
      ['flag', 1, 17, 6], ['ring', 1, 13, 3, 90], ['arch', 0, 9.5, 3, 90],
      ['flag', 1, 7, 3], ['flag', 1, 5.5, 3], ['flag', 1, 4, 3],
    ],
    path: [[0], [1], [2], [3, { opening: 1 }], [4, { side: 'right', turn: 'uturn' }], [5], [6],
      [7, { side: 'right' }], [8, { side: 'left' }], [9, { side: 'right' }], [0]],
  },
  {
    name: 'DK-Track-02', price: 425, hall: { w: 20, l: 10 },
    items: [
      ['pad', 1, 2, 2], ['ring', 5, 5, 2, -90], ['ring', 3, 9, 2, -90], ['ring', 0, 13, 2, -90],
      ['flag', 1, 17, 2], ['shaft', 0, 17.5, 6], ['stacked', 0, 13, 8, 90], ['tunnel', 0, 9, 8, 90],
      ['arch', 0, 5, 8, 90], ['flag', 1, 2.5, 8], ['flag', 1, 10, 5],
    ],
    path: [[0], [1], [2], [3], [4, { side: 'left' }], [5, { dir: 'fwd' }], [6, { opening: 1 }], [7], [8],
      [9, { side: 'left' }], [0]],
  },
  {
    name: 'DK-Track-03', price: 842, hall: { w: 24, l: 14 },
    items: [
      ['pad', 2, 2, 3], ['arch', 2, 5, 3, -90], ['ring', 4, 8, 3, -90], ['offset', 0, 11, 3, -90],
      ['tunnel', 2, 14.5, 3, -90], ['ring', 4, 18, 3, -90], ['flag', 3, 22, 3],
      ['gravity', 0, 19, 7], ['square', 0, 15.5, 7, 90], ['arch', 2, 12, 7, 90], ['shaft', 1, 8.5, 7],
      ['offset', 0, 5, 7, 90], ['flag', 3, 2, 7],
      ['ring', 4, 6, 11, -90], ['arch', 2, 10, 11, -90], ['flag', 3, 14, 11], ['flag', 3, 17, 11], ['pad', 2, 21, 11],
    ],
    path: [[0], [1], [2], [3], [4], [5], [6, { side: 'left', turn: 'uturn' }], [7, { dir: 'fwd' }], [8], [9],
      [10, { dir: 'fwd' }], [11], [12, { side: 'right', turn: 'uturn' }], [13], [14], [15, { side: 'left' }],
      [16, { side: 'right' }], [17]],
  },
  {
    name: 'DK-Track-04', price: 399, hall: { w: 21, l: 12 },
    items: [
      ['pad', 2, 2, 2], ['arch', 1, 5, 2, -90], ['ring', 2, 8.5, 2, -90], ['flag', 2, 12, 2], ['arch', 1, 15, 2, -90],
      ['flag', 2, 18.5, 2.5], ['ring', 2, 15, 6, 90], ['groundTunnel', 0, 11.5, 6, 90], ['pad', 2, 8, 6],
      ['ring', 2, 5, 6, 90], ['flag', 2, 2, 6], ['arch', 1, 5, 10, -90], ['flag', 2, 8, 10], ['flag', 2, 10.5, 10],
      ['ring', 2, 13, 10, -90], ['arch', 1, 16, 10, -90], ['pad', 2, 19, 10],
    ],
    path: [[0], [1], [2], [3, { side: 'left' }], [4], [5, { side: 'left', turn: 'uturn' }], [6], [7], [8], [9],
      [10, { side: 'right', turn: 'uturn' }], [11], [12, { side: 'left' }], [13, { side: 'right' }], [14], [15], [16]],
  },
  {
    name: 'DK-Track-05-Tello', price: 172, hall: { w: 10, l: 7 },
    items: [
      ['pad', 0, 1.5, 2.5], ['ring', 1, 3.5, 2.5, -90], ['tunnel', 0, 6, 2.5, -90], ['flag', 1, 8.6, 3.6],
      ['arch', 0, 5.5, 5, 90], ['pad', 0, 1.5, 5],
    ],
    path: [[0], [1], [2], [3, { side: 'left', turn: 'uturn' }], [4], [5]],
  },
];
