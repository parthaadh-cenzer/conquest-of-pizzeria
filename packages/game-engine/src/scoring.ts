import type { GameState } from './types';
/** Longest edge-simple trail, with opposing buildings cutting through-routes. */
export function roadLength(state: Pick<GameState, 'board' | 'roads' | 'buildings'>, owner: string): number {
  const edges = Object.keys(state.roads).filter(e => state.roads[e] === owner);
  const walk = (vertex: string, used: Set<string>): number => {
    if (used.size && state.buildings[vertex] && state.buildings[vertex].owner !== owner) return 0;
    let best = 0;
    for (const edge of state.board.vertices[vertex].edges) {
      if (state.roads[edge] !== owner || used.has(edge)) continue;
      used.add(edge);
      const next = state.board.edges[edge].vertices.find(v => v !== vertex)!;
      best = Math.max(best, 1 + walk(next, used)); used.delete(edge);
    }
    return best;
  };
  return Math.max(0, ...[...new Set(edges.flatMap(e => state.board.edges[e].vertices))].map(v => walk(v, new Set())));
}
function holder(counts: { id: string; n: number }[], current: string | null, threshold: number) {
  const maximum = Math.max(threshold, ...counts.map(c => c.n));
  const leaders = counts.filter(c => c.n === maximum);
  if (leaders.some(c => c.id === current)) return current;
  return leaders.length === 1 ? leaders[0].id : null;
}
export function updateAwards(state: GameState) {
  state.longestRoad = holder(state.players.map(p => ({ id: p.id, n: roadLength(state, p.id) })), state.longestRoad, 5);
  state.largestGuard = holder(state.players.map(p => ({ id: p.id, n: p.guards })), state.largestGuard, 3);
}
export function score(state: GameState, owner: string, includeHidden = false): number {
  return Object.values(state.buildings).filter(b => b.owner === owner).reduce((n, b) => n + (b.kind === 'city' ? 2 : 1), 0)
    + (state.longestRoad === owner ? 2 : 0) + (state.largestGuard === owner ? 2 : 0)
    + (includeHidden ? state.players.find(p => p.id === owner)!.cards.filter(c => c.kind === 'charter').length : 0);
}
