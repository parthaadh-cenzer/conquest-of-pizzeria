import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { variation } from './math';
type Triple = [number, number, number];
/** Each miniature is merged into a reusable, vertex-painted mesh before instancing. */
export class Sculpt {
  parts: T.BufferGeometry[] = [];
  add(geometry: T.BufferGeometry, color: string, position: Triple = [0, 0, 0], scale: Triple = [1, 1, 1], rotation: Triple = [0, 0, 0]) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
    const m = new T.Matrix4().compose(new T.Vector3(...position), new T.Quaternion().setFromEuler(new T.Euler(...rotation)), new T.Vector3(...scale)); g.applyMatrix4(m);
    g.deleteAttribute('uv'); const c = new T.Color(color), colors = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(colors, 3)); this.parts.push(g); return this;
  }
  box(c: string, p: Triple, s: Triple, r: Triple = [0, 0, 0]) { return this.add(new T.BoxGeometry(1, 1, 1), c, p, s, r); }
  ball(c: string, p: Triple, s: Triple, detail = 1) { return this.add(new T.IcosahedronGeometry(1, detail), c, p, s); }
  finish() { const merged = mergeGeometries(this.parts); this.parts.forEach(p => p.dispose()); merged.computeBoundingSphere(); return merged; }
}
function tree(seed: number, broad = false) {
  const s = new Sculpt();
  s.add(new T.CylinderGeometry(.018, .042, .86, 7), '#655443', [0, .43, 0]);
  if (broad) {
    for (let i = 0; i < 8; i++) { const a = i * 2.4, radius = .15 + variation(seed + i) * .13; s.ball(['#425f35', '#547540', '#718b49'][i % 3], [Math.cos(a) * radius, .65 + variation(seed + i + 12) * .27, Math.sin(a) * radius], [.21, .23, .19], 1); }
  } else {
    // Branch whorls and irregular flattened needle clusters, never stacked cones.
    for (let tier = 0; tier < 6; tier++) for (let branch = 0; branch < 6; branch++) {
      const a = branch * Math.PI / 3 + tier * .67 + seed, radius = (.30 - tier * .039) * (.82 + variation(seed + branch + tier * 6) * .32);
      const x = Math.cos(a) * radius * .55, z = Math.sin(a) * radius * .55, y = .28 + tier * .133;
      s.add(new T.IcosahedronGeometry(1, 0), ['#294b36', '#365b3c', '#426b43', '#587b49'][(branch + tier) % 4], [x, y, z], [radius * 1.03, .095 + tier * .004, radius * .48], [.1, -a, -.08]);
    }
    s.ball('#597d48', [0, 1.01, 0], [.045, .13, .047], 0);
  }
  return s.finish();
}
function alpine(seed: number) {
  const s = new Sculpt(), points: number[] = [], colors: number[] = [], triangles: number[] = [], side = 24;
  // A continuous weathered ridge: asymmetric peaks, gullies and exposed strata.
  for (let row = 0; row <= side; row++) for (let col = 0; col <= side; col++) {
    const x = (col / side - .5) * .82, z = (row / side - .5) * .71;
    const peak = (cx: number, cz: number, sx: number, sz: number, h: number) => Math.min(.86, Math.pow(Math.max(0, 1 - Math.hypot((x - cx) / sx, (z - cz) / sz)), .72)) * h;
    const edge = Math.max(0, 1 - Math.pow(Math.hypot(x / .43, z / .38), 4));
    const ridge = Math.max(peak(-.10, -.01, .34, .33, .93), peak(.12, -.10, .27, .24, .73), peak(.20, .13, .21, .22, .48));
    const fissure = Math.sin(x * 57 + seed + z * 13) * Math.sin(z * 31 + seed) * .020;
    const y = Math.max(.008, ridge + fissure * edge); points.push(x, y, z);
    const c = new T.Color(y > .53 ? '#a6a48e' : y > .25 ? '#898f82' : '#798377');
    const strata = .89 + .12 * Math.sin(y * 58 + z * 8 + seed) + variation(col + row * 47 + seed) * .09; c.multiplyScalar(strata); colors.push(c.r, c.g, c.b);
  }
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) { const a = y * (side + 1) + x, b = a + 1, c = a + side + 1, d = c + 1; triangles.push(a, c, b, b, c, d); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(points, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex(triangles); g.computeVertexNormals(); s.parts.push(g.toNonIndexed()); g.dispose();
  for (let i = 0; i < 11; i++) { const a = i * 2.4 + seed, r = .25 + variation(i + seed) * .08; s.ball(i % 3 ? '#969987' : '#b0ac93', [Math.cos(a) * r, .035, Math.sin(a) * r], [.058, .045 + variation(i) * .045, .06], 1); }
  for (let i = 0; i < 6; i++) s.ball(i % 2 ? '#b8b898' : '#b3bfb0', [-.06 + i * .025, .10 + i * .035, .16 - i * .021], [.016, .021, .012], 0);
  return s.finish();
}
function rock(seed: number, clay = false) {
  if (!clay) return alpine(seed);
  const s = new Sculpt();
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.4 + seed, height = i === 0 ? .85 : .24 + variation(seed + i) * .52;
    const g = new T.IcosahedronGeometry(1, 1); const positions = g.getAttribute('position');
    for (let n = 0; n < positions.count; n++) { const x = positions.getX(n), y = positions.getY(n), z = positions.getZ(n); const wobble = 1 + .13 * Math.sin(x * 9 + y * 7 + z * 13 + seed); positions.setXYZ(n, x * wobble, y * wobble, z * wobble); } g.computeVertexNormals();
    s.add(g, clay ? ['#af694c', '#c18a61', '#d0a071', '#9f6148', '#bd7851'][i] : ['#777b76', '#98998c', '#858b82', '#b4ac96', '#6c7977'][i], [i ? Math.cos(angle) * .26 : 0, height * .45, i ? Math.sin(angle) * .23 : 0], [.24 + height * .1, height * .63, .21 + height * .07], [0, angle, .1]);
    if (clay) for (let l = 0; l < 3; l++) s.add(new T.IcosahedronGeometry(1, 0), '#d5ac81', [Math.cos(angle) * .25, .07 + l * .11, Math.sin(angle) * .23], [.21, .016, .22]);
  }
  if (!clay) for (let i = 0; i < 8; i++) s.ball(i % 2 ? '#c1b17d' : '#a5b2ac', [(variation(seed + i + 75) - .5) * .5, .12 + variation(seed + i + 3) * .4, .23], [.024, .031, .018], 0);
  return s.finish();
}
function sheepBody(seed: number) {
  const s = new Sculpt();
  s.ball('#dfddca', [0, .145, 0], [.17, .11, .10], 2);
  for (let i = 0; i < 15; i++) { const a = i * 2.4, x = (variation(seed + i) - .5) * .22; s.ball(i % 3 ? '#eee9d6' : '#f8f1df', [x, .16 + Math.cos(a) * .069, Math.sin(a) * .075], [.060, .051, .049], 1); }
  for (const x of [-.10, .095]) for (const z of [-.06, .06]) s.add(new T.CapsuleGeometry(.012, .08, 2, 5), '#5e5a4c', [x, .052, z]);
  s.ball('#e9e4cf', [-.176, .157, 0], [.043, .025, .024]); return s.finish();
}
function sheepHead() {
  const s = new Sculpt(); s.ball('#656253', [0, 0, 0], [.068, .052, .041], 2); s.ball('#ebe5d2', [-.035, .027, 0], [.05, .035, .046], 1);
  for (const side of [-1, 1]) { s.ball('#706c59', [-.025, .007, side * .055], [.025, .012, .036], 1); s.ball('#252f28', [.025, .018, side * .034], [.005, .006, .004], 1); } return s.finish();
}
function wheat() { const s = new Sculpt(); s.add(new T.CylinderGeometry(.006, .009, .31, 4), '#b6a05d', [0, .155, 0]); for (let i = 0; i < 5; i++) for (const side of [-1, 1]) s.add(new T.SphereGeometry(1, 5, 3), i % 2 ? '#dec16e' : '#ebd082', [side * .012, .25 + i * .019, 0], [.012, .023, .008], [0, 0, side * -.4]); s.box('#bdab64', [.025, .16, 0], [.059, .008, .012], [0, 0, .5]); return s.finish(); }
function grass() { const s = new Sculpt(); for (let i = 0; i < 5; i++) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([-.01, 0, 0, .01, 0, 0, .025, .09 + i * .012, 0], 3)); g.computeVertexNormals(); s.add(g, ['#73824b', '#859153', '#a1a76a'][i % 3], [(i - 2) * .013, 0, 0], [1, 1, 1], [0, i * 1.4, 0]); } return s.finish(); }
function flower() { const s = new Sculpt(); s.add(new T.CylinderGeometry(.003, .004, .10, 3), '#647b45', [0, .05, 0]); for (let i = 0; i < 5; i++) s.ball('#eadbc1', [Math.cos(i * 1.256) * .015, .11, Math.sin(i * 1.256) * .015], [.012, .004, .009], 0); s.ball('#bc9b55', [0, .113, 0], [.006, .004, .006], 0); return s.finish(); }
function boat() {
  const s = new Sculpt(), shape = new T.Shape(); shape.moveTo(0, .52); shape.bezierCurveTo(-.12, .35, -.19, .2, -.16, -.31); shape.quadraticCurveTo(0, -.47, .16, -.31); shape.bezierCurveTo(.19, .2, .12, .35, 0, .52);
  s.add(new T.ExtrudeGeometry(shape, { depth: .14, bevelEnabled: true, bevelThickness: .035, bevelSize: .026, bevelSegments: 2, steps: 1, curveSegments: 12 }), '#70503a', [0, -.035, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 7; i++) s.box(i % 2 ? '#b19161' : '#a3845b', [0, .023, -.30 + i * .09], [.23 - Math.max(0, i - 3) * .035, .018, .078]);
  s.add(new T.CylinderGeometry(.010, .015, .83, 6), '#8e724b', [0, .44, .03]);
  s.box('#d5c5a1', [0, .63, .025], [.49, .012, .014], [0, 0, -.08]);
  s.box('#b29b70', [0, .18, .12], [.015, .014, .47]);
  return s.finish();
}
function sail() {
  const g = new T.PlaneGeometry(.43, .5, 8, 8); const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setXYZ(i, x * (.65 + (y + .25) * .7), y, Math.sin((x / .43 + .5) * Math.PI) * .09); } g.computeVertexNormals(); return g;
}
function cloak() { const s = new Sculpt(); const points = Array.from({ length: 12 }, (_, i) => { const y = i / 11 * .48; return new T.Vector2(.17 * Math.pow(1 - y / .65, 1.5) + .015, y); }); const g = new T.LatheGeometry(points, 20); const p = g.getAttribute('position'); for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), amount = 1 + .11 * Math.sin(a * 7 + p.getY(i) * 5); p.setX(i, p.getX(i) * amount); p.setZ(i, p.getZ(i) * amount); } g.computeVertexNormals(); s.add(g, '#595462'); s.ball('#67616d', [0, .49, 0], [.104, .127, .096], 2); s.ball('#2f3640', [0, .49, .068], [.064, .074, .035], 1); s.ball('#bcb095', [0, .46, .088], [.03, .026, .017], 1); s.add(new T.CylinderGeometry(.01, .014, .43, 6), '#7d7054', [.16, .2, .05], [1, 1, 1], [0, 0, -.16]); return s.finish(); }
let cached: ReturnType<typeof createAssets> | undefined;
function createAssets() { return { trees: [tree(1), tree(8), tree(17), tree(21, true)], rocks: [rock(2), rock(14), rock(29)], clay: [rock(8, true), rock(13, true)], sheep: sheepBody(5), head: sheepHead(), wheat: wheat(), grass: grass(), flower: flower(), boat: boat(), sail: sail(), cloak: cloak() }; }
export function assets() { return cached ??= createAssets(); }
