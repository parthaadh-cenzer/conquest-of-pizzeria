import { CONFIG } from '../../board-generator/src/config';
import { canAfford, COST } from './economy';
import type { GameState, Player } from './types';
type Position = Pick<GameState, 'board' | 'buildings' | 'roads'>;
export function distanceClear(state: Position, vertex: string): boolean {
  const v = state.board.vertices[vertex];
  return !!v && !state.buildings[vertex] && v.edges.every(e => state.board.edges[e].vertices.every(n => !state.buildings[n]));
}
export function connectedRoad(state: Position, owner: string, edgeId: string): boolean {
  const edge = state.board.edges[edgeId];
  return !!edge && !state.roads[edgeId] && edge.vertices.some(v => {
    if (state.buildings[v]) return state.buildings[v].owner === owner;
    return state.board.vertices[v].edges.some(e => state.roads[e] === owner);
  });
}
export function settlements(state: GameState, player: Player): string[] {
  if (state.players[state.active].id !== player.id || !['setup-settlement', 'main'].includes(state.phase)) return [];
  const setup = state.phase === 'setup-settlement';
  if (Object.values(state.buildings).filter(b => b.owner === player.id && b.kind === 'settlement').length >= CONFIG[state.size].settlements) return [];
  if (!setup && !canAfford(player.resources, COST.settlement)) return [];
  return Object.keys(state.board.vertices).filter(v => distanceClear(state, v) && (setup || state.board.vertices[v].edges.some(e => state.roads[e] === player.id)));
}
export function roads(state: GameState, player: Player): string[] {
  if (state.players[state.active].id !== player.id || !['setup-road', 'main', 'free-roads'].includes(state.phase)) return [];
  if (Object.values(state.roads).filter(p => p === player.id).length >= CONFIG[state.size].roads) return [];
  if (state.phase === 'main' && !canAfford(player.resources, COST.road)) return [];
  return Object.keys(state.board.edges).filter(e => !state.roads[e] && (state.phase === 'setup-road'
    ? state.board.edges[e].vertices.includes(state.setupVertex!) : connectedRoad(state, player.id, e)));
}
export function cities(state: GameState, player: Player): string[] {
  if (state.phase !== 'main' || state.players[state.active].id !== player.id || !canAfford(player.resources, COST.city)) return [];
  if (Object.values(state.buildings).filter(b => b.owner === player.id && b.kind === 'city').length >= CONFIG[state.size].cities) return [];
  return Object.keys(state.buildings).filter(v => state.buildings[v].owner === player.id && state.buildings[v].kind === 'settlement');
}
