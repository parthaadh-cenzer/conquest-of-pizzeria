import type { Board } from '../../../../../packages/game-engine/src/types';
/** Stable cosmetic variation only. Never a source of game/dice entropy. */
export function variation(seed: number) { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
export const WORLD_QUALITY = {
  low: { trees: 11, crops: 74, grass: 65, sheep: 3, boats: 3, shadow: 0, waterDetail: 1 },
  medium: { trees: 19, crops: 132, grass: 125, sheep: 5, boats: 4, shadow: 1024, waterDetail: 2 },
  high: { trees: 27, crops: 190, grass: 190, sheep: 7, boats: 5, shadow: 2048, waterDetail: 3 },
};
export type WorldQuality = keyof typeof WORLD_QUALITY;
export function coastalFrame(board: Board, edgeId: string) {
  const edge = board.edges[edgeId];
  if (!edge || edge.hexes.length !== 1) throw new Error('A harbor must belong to a coastal edge');
  const [a, b] = edge.vertices.map(id => board.vertices[id]), h = board.hexes[edge.hexes[0]];
  const x = (a.x + b.x) / 2, z = (a.y + b.y) / 2;
  const length = Math.hypot(x - h.x, z - h.y), nx = (x - h.x) / length, nz = (z - h.y) / length;
  return { x, z, nx, nz, tx: nz, tz: -nx, rotation: Math.atan2(nx, nz), vertices: edge.vertices };
}
export function coastLoop(board: Board) {
  const edges = Object.values(board.edges).filter(e => e.hexes.length === 1), neighbors = new Map<string, string[]>();
  for (const e of edges) for (const id of e.vertices) neighbors.set(id, [...(neighbors.get(id) ?? []), e.vertices.find(v => v !== id)!]);
  const first = edges[0].vertices[0], loop = [first]; let previous = '', current = first;
  do { const next = neighbors.get(current)!.find(v => v !== previous)!; previous = current; current = next; if (current !== first) loop.push(current); } while (current !== first && loop.length <= edges.length);
  const points = loop.map(id => ({ x: board.vertices[id].x, z: board.vertices[id].y }));
  const area = points.reduce((n, a, i) => { const b = points[(i + 1) % points.length]; return n + a.x * b.z - b.x * a.z; }, 0);
  return area < 0 ? points.reverse() : points;
}
export function inHex(x: number, z: number, margin = .1) { return Math.abs(x) < .866 - margin && Math.abs(z) < 1 - margin && Math.sqrt(3) * Math.abs(z) + Math.abs(x) < Math.sqrt(3) * (1 - margin); }
export function outsideToken(x: number, z: number, radius = .42) { return Math.hypot(x, z - .32) >= radius; }
/** Leave the token's clearing and every road/settlement corridor unobstructed. */
export function propPosition(seed: number, index: number, margin = .16) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = (variation(seed + index * 53 + attempt * 2) - .5) * 1.7;
    const z = (variation(seed + index * 53 + attempt * 2 + 1) - .5) * 1.85;
    if (inHex(x, z, margin) && outsideToken(x, z)) return { x, z };
  }
  return { x: .3, z: -.3 };
}
export function boatRoute(board: Board, index: number, time: number) {
  // The circumscribed radius includes rocks, beaches and the longest dock. Routes cannot cross land.
  const extent = Math.max(...Object.values(board.vertices).map(v => Math.hypot(v.x, v.y)));
  const a = index * 2.39996 + time * (index % 2 ? -.020 : .016);
  const radius = extent + 1.65 + (index % 3) * .57 + .20 * Math.sin(a * 3 + index);
  const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
  const speed = index % 2 ? -1 : 1;
  return { x, z, rotation: -a + (speed < 0 ? Math.PI : 0), radius, extent };
}
export const INTRO_DURATION = 8.4;
export function revealSchedule(ids: string[], seed: number) {
  const order = [...ids].sort((a, b) => variation(seed + ids.indexOf(a) * 37) - variation(seed + ids.indexOf(b) * 37));
  return Object.fromEntries(order.map((id, i) => [id, 2.0 + i / Math.max(1, ids.length - 1) * 3.55 + variation(seed + i) * .18]));
}
