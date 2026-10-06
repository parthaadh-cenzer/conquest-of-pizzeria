import { RESOURCES, countHand, emptyHand, type GameState, type Entropy } from './types';
import { event } from './state';
export function produce(state: GameState, sum: number) {
  const claims = state.players.map(() => emptyHand());
  const producing: string[] = [], blocked: string[] = [];
  for (const tile of Object.values(state.board.hexes)) {
    if (tile.number !== sum || tile.resource === 'desert') continue;
    if (tile.id === state.robber) { blocked.push(tile.id); continue; }
    producing.push(tile.id);
    for (const vertex of tile.vertices) {
      const b = state.buildings[vertex];
      if (b) claims[state.players.findIndex(p => p.id === b.owner)][tile.resource] += b.kind === 'city' ? 2 : 1;
    }
  }
  const received = new Set<string>();
  for (const r of RESOURCES) {
    const total = claims.reduce((n, h) => n + h[r], 0);
    if (state.bank[r] < total) { event(state, 'shortage', `The bank cannot supply ${r} this roll.`); continue; }
    state.bank[r] -= total;
    state.players.forEach((p, i) => { p.resources[r] += claims[i][r]; if (claims[i][r]) received.add(p.id); });
  }
  event(state, 'production', 'The island shares its harvest.', [...received], producing);
  if (blocked.length) event(state, 'blocked', 'The Wanderer blocked production. No held cards were taken.', [], blocked);
}
export function beginRobber(state: GameState, discard: boolean) {
  state.trade = null; state.discards = {};
  if (discard) for (const p of state.players) if (countHand(p.resources) > 7) state.discards[p.id] = Math.floor(countHand(p.resources) / 2);
  state.phase = Object.keys(state.discards).length ? 'discard' : 'robber';
}
export function victims(state: GameState, actor: string): string[] {
  return [...new Set(state.board.hexes[state.robber].vertices.map(v => state.buildings[v]?.owner).filter((id): id is string => !!id && id !== actor))]
    .filter(id => countHand(state.players.find(p => p.id === id)!.resources) > 0);
}
export function steal(state: GameState, actor: string, victim: string, entropy: Entropy) {
  if (!victims(state, actor).includes(victim)) throw new Error('Choose an eligible neighbor');
  const from = state.players.find(p => p.id === victim)!, to = state.players.find(p => p.id === actor)!;
  let index = entropy.randomIndex(countHand(from.resources));
  if (!Number.isInteger(index) || index < 0 || index >= countHand(from.resources)) throw new Error('Invalid entropy');
  for (const r of RESOURCES) { if (index < from.resources[r]) { from.resources[r]--; to.resources[r]++; break; } index -= from.resources[r]; }
  event(state, 'steal', `${to.name} took one hidden card from ${from.name}.`, [actor, victim]);
  state.phase = state.robberReturn;
}
