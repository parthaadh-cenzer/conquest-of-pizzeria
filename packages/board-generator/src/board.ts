import { RESOURCES, type Board, type Size, type Resource } from '../../game-engine/src/types';
import { CONFIG, LAYOUT, NUMBER_COUNTS } from './config';
export type Shuffle = <T>(items: readonly T[]) => T[];
/** Geometry is deterministic. Randomness only enters via an explicit shuffle dependency. */
export function generateBoard(size: Size, shuffle: Shuffle): Board {
  const config = CONFIG[size];
  const board: Board = { hexes: {}, vertices: {}, edges: {}, ports: [] };
  const radius = LAYOUT[size].radius;
  let coordinates: [number, number][] = [];
  for (let q = -radius; q <= radius; q++) for (let r = -radius; r <= radius; r++) {
    if (Math.abs(q + r) <= radius) coordinates.push([q, r]);
  }
  // A compact 30-hex island, clipped at three coastal tips to keep graph distances short.
  if (LAYOUT[size].trim) coordinates = coordinates.filter(([q, r]) => r !== -3 && !(r === 3 && q === 0) && !(q === -3 && r === 0) && !(q === 3 && r === 0));
  const resources: (Resource | 'desert')[] = shuffle([...RESOURCES.flatMap(r => Array<Resource>(config.tiles[r]).fill(r)), ...Array<'desert'>(config.deserts).fill('desert')]);
  const numbers = shuffle(Object.entries(NUMBER_COUNTS[size]).flatMap(([n, amount]) => Array<number>(amount).fill(Number(n))));
  let ni = 0;
  coordinates.forEach(([q, r], index) => {
    const x = Math.sqrt(3) * (q + r / 2), y = 1.5 * r;
    const id = `h${index}`;
    const vertexIds: string[] = [];
    for (let c = 0; c < 6; c++) {
      const angle = (60 * c - 30) * Math.PI / 180;
      const vx = Math.round((x + Math.cos(angle)) * 10000) / 10000;
      const vy = Math.round((y + Math.sin(angle)) * 10000) / 10000;
      const vid = `v${Math.round(vx * 10000)}_${Math.round(vy * 10000)}`;
      board.vertices[vid] ??= { id: vid, x: vx, y: vy, hexes: [], edges: [] };
      board.vertices[vid].hexes.push(id); vertexIds.push(vid);
    }
    for (let c = 0; c < 6; c++) {
      const pair = [vertexIds[c], vertexIds[(c + 1) % 6]].sort() as [string, string];
      const eid = `e${pair.join(':')}`;
      board.edges[eid] ??= { id: eid, vertices: pair, hexes: [] };
      board.edges[eid].hexes.push(id);
      for (const v of pair) if (!board.vertices[v].edges.includes(eid)) board.vertices[v].edges.push(eid);
    }
    const resource = resources[index];
    if (!resource) throw new Error('Board resource configuration does not match geometry');
    board.hexes[id] = { id, q, r, x, y, resource, number: resource === 'desert' ? null : numbers[ni++], vertices: vertexIds };
  });
  // Place the red numbers in a shuffled independent set on the hex adjacency graph.
  // Counts remain exact; neighboring 6/8 tiles cannot create an overpowered opening.
  const productive = shuffle(Object.values(board.hexes).filter(h => h.resource !== 'desert'));
  const red = numbers.filter(n => n === 6 || n === 8), ordinary = numbers.filter(n => n !== 6 && n !== 8);
  const adjacent = (a: typeof productive[number], b: typeof a) => Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r)) === 1;
  const chosen: typeof productive = [];
  const placeRed = (start: number): boolean => {
    if (chosen.length === red.length) return true;
    for (let i = start; i <= productive.length - (red.length - chosen.length); i++) {
      if (chosen.some(h => adjacent(h, productive[i]))) continue;
      chosen.push(productive[i]); if (placeRed(i + 1)) return true; chosen.pop();
    }
    return false;
  };
  if (!placeRed(0)) throw new Error('Board cannot satisfy red-number spacing');
  const redIds = new Set(chosen.map(h => h.id)); let redIndex = 0, ordinaryIndex = 0;
  for (const h of productive) h.number = redIds.has(h.id) ? red[redIndex++] : ordinary[ordinaryIndex++];
  const coast = Object.values(board.edges).filter(e => e.hexes.length === 1).sort((a, b) => {
    const angle = (eid: typeof a) => { const [v, w] = eid.vertices.map(id => board.vertices[id]); return Math.atan2(v.y + w.y, v.x + w.x); };
    return angle(a) - angle(b);
  });
  const portTypes = shuffle([...RESOURCES, ...Array<'any'>(config.ports - 5).fill('any')]);
  const portOffset = shuffle(coast.map((_, i) => i))[0];
  for (let i = 0; i < config.ports; i++) {
    const edge = coast[(portOffset + Math.floor(i * coast.length / config.ports)) % coast.length];
    board.ports.push({ edge: edge.id, resource: portTypes[i], ratio: portTypes[i] === 'any' ? 3 : 2 });
  }
  return board;
}
