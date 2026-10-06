import type { Board, Port } from '../../../../../packages/game-engine/src/types';
import { coastLoop, coastalFrame } from './math';
export interface Point { x: number; z: number }
export function satelliteSites(board: Board) {
  const extent = Math.max(...Object.values(board.vertices).map(v => Math.hypot(v.x, v.y)));
  return board.ports.map((_, i) => { const angle = i / board.ports.length * Math.PI * 2 - .6, radius = extent + 2.8 + Math.sin(i * 2.4) * .25; return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, angle, index: i }; });
}
export function mainMooring(board: Board, port: Port): Point {
  const f = coastalFrame(board, port.edge), coast = coastLoop(board), sites = satelliteSites(board);
  // The expanded layout has a few recessed coves. Extend their landing to safe water.
  for (let out = 1.22; out < 3; out += .08) {
    const p = { x: f.x + f.nx * out + f.tx * .15, z: f.z + f.nz * out + f.tz * .15 };
    if (coast.every((a, i) => segmentDistance(p, a, coast[(i + 1) % coast.length]) > .88) && sites.every(s => Math.hypot(p.x - s.x, p.z - s.z) > .98)) return p;
  }
  throw new Error('Coastal dock cannot reach safe water');
}
export function outerMooring(site: Point): Point { const l = Math.hypot(site.x, site.z); return { x: site.x * (1 - 1.12 / l), z: site.z * (1 - 1.12 / l) }; }
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
function segmentDistance(p: Point, a: Point, b: Point) { const x = b.x - a.x, z = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.z - a.z) * z) / (x * x + z * z))); return Math.hypot(p.x - a.x - t * x, p.z - a.z - t * z); }
function segmentGap(a: Point, b: Point, c: Point, d: Point) {
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(segmentDistance(a, c, d), segmentDistance(b, c, d), segmentDistance(c, a, b), segmentDistance(d, a, b));
}
/** A cosmetic water navigation mesh. Main coast and satellite shores are inflated
 * by the boat hull radius; routes never depend on game/dice random values. */
export function maritimeNavigation(board: Board) {
  const coast = coastLoop(board), sites = satelliteSites(board), limit = Math.max(...sites.map(s => Math.hypot(s.x, s.z))) + 2;
  const step = .36, count = Math.ceil(limit * 2 / step), cells = new Uint8Array(count * count);
  const water = (p: Point) => {
    if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) return false;
    if (sites.some(s => distance(p, s) < .94)) return false;
    let inside = false;
    for (let i = 0, j = coast.length - 1; i < coast.length; j = i++) {
      const a = coast[i], b = coast[j];
      if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
      if (segmentDistance(p, a, b) < .84) return false;
    }
    return !inside;
  };
  const point = (index: number): Point => ({ x: (index % count) * step - limit, z: Math.floor(index / count) * step - limit });
  for (let i = 0; i < cells.length; i++) cells[i] = water(point(i)) ? 1 : 0;
  const clear = (a: Point, b: Point) => {
    if (distance(a, b) < .000001) return water(a);
    if (sites.some(s => segmentDistance(s, a, b) < .942)) return false;
    for (let i = 0; i < coast.length; i++) if (segmentGap(a, b, coast[i], coast[(i + 1) % coast.length]) < .842) return false;
    return true;
  };
  const nearest = (p: Point) => {
    const x = Math.round((p.x + limit) / step), z = Math.round((p.z + limit) / step);
    for (let r = 0; r < 8; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { const xx = x + dx, zz = z + dz, id = zz * count + xx; if (xx >= 0 && xx < count && zz >= 0 && zz < count && cells[id] && clear(p, point(id))) return id; }
    throw new Error('No safe mooring connection');
  };
  const route = (start: Point, end: Point) => {
    if (!water(start) || !water(end)) throw new Error('Ship endpoint is not navigable water');
    let raw: Point[] = [start, end];
    if (clear(start, end) && distance(start, end) > 1.2) {
      const length = distance(start, end), nx = -(end.z - start.z) / length, nz = (end.x - start.x) / length;
      for (const side of [1, -1]) {
        const bend = { x: (start.x + end.x) / 2 + nx * .42 * side, z: (start.z + end.z) / 2 + nz * .42 * side };
        if (water(bend) && clear(start, bend) && clear(bend, end)) { raw = [start, bend, end]; break; }
      }
    }
    if (!clear(start, end)) {
      const first = nearest(start), last = nearest(end), costs = new Float64Array(cells.length).fill(Infinity), previous = new Int32Array(cells.length).fill(-1), closed = new Uint8Array(cells.length);
      const heap: { id: number; rank: number }[] = [];
      const push = (id: number, rank: number) => { heap.push({ id, rank }); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].rank <= rank) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const first = heap[0], final = heap.pop()!; if (heap.length) { heap[0] = final; let i = 0; while (i * 2 + 1 < heap.length) { let c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1].rank < heap[c].rank) c++; if (heap[i].rank <= heap[c].rank) break; [heap[i], heap[c]] = [heap[c], heap[i]]; i = c; } } return first.id; };
      costs[first] = 0; push(first, 0);
      while (heap.length) {
        const id = pop(); if (id === last) break; if (closed[id]) continue; closed[id] = 1;
        const x = id % count, z = Math.floor(id / count);
        for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
          if ((!dx && !dz) || x + dx < 0 || x + dx >= count || z + dz < 0 || z + dz >= count) continue;
          const next = id + dx + dz * count; if (!cells[next] || closed[next] || (dx && dz && (!cells[id + dx] || !cells[id + dz * count])) || !clear(point(id), point(next))) continue;
          const cost = costs[id] + Math.hypot(dx, dz); if (cost >= costs[next]) continue;
          costs[next] = cost; previous[next] = id; push(next, cost + distance(point(next), point(last)) / step);
        }
      }
      if (!Number.isFinite(costs[last])) throw new Error('No safe maritime route');
      const reverse = [end]; let id = last; while (id !== first) { reverse.push(point(id)); id = previous[id]; } reverse.push(point(first), start); raw = reverse.reverse();
    }
    // Line-of-sight simplification followed by checked corner rounding.
    const directCurve = raw.length === 3 && clear(start, end);
    const simple = directCurve ? raw : [raw[0]]; let from = directCurve ? raw.length - 1 : 0;
    while (from < raw.length - 1) { let next = raw.length - 1; while (next > from + 1 && !clear(raw[from], raw[next])) next--; simple.push(raw[next]); from = next; }
    let points = simple;
    for (let pass = 0; pass < 3; pass++) {
      const rounded = [points[0]];
      for (let i = 1; i < points.length - 1; i++) {
        const a = points[i - 1], b = points[i], c = points[i + 1], left = { x: b.x * .75 + a.x * .25, z: b.z * .75 + a.z * .25 }, right = { x: b.x * .75 + c.x * .25, z: b.z * .75 + c.z * .25 };
        if (clear(rounded[rounded.length - 1], left) && clear(left, right) && clear(right, c)) rounded.push(left, right); else rounded.push(b);
      }
      rounded.push(points[points.length - 1]); points = rounded;
    }
    const lengths = [0]; for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
    const length = lengths[lengths.length - 1];
    const sample = (travel: number): Point => { const d = Math.max(0, Math.min(length, travel)); let i = 1; while (i < lengths.length - 1 && lengths[i] < d) i++; const t = (d - lengths[i - 1]) / Math.max(.00001, lengths[i] - lengths[i - 1]); return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, z: points[i - 1].z + (points[i].z - points[i - 1].z) * t }; };
    return { points, length, sample };
  };
  return { route, water, sites };
}
export type Navigation = ReturnType<typeof maritimeNavigation>;
