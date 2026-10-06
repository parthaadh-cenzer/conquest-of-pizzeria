import { RESOURCES, type GameState, type Player, type Action, type CardKind } from './types';
import { beginRobber } from './production';
import { roads } from './placement';
import { event } from './state';
export const CARD_NAMES: Record<CardKind, string> = { guard: 'Island Guard', charter: 'Charter', roads: 'Trailblazers', harvest: 'Bountiful Harvest', monopoly: 'Market Claim' };
export function playableCards(state: GameState, player: Player): CardKind[] {
  if (state.players[state.active].id !== player.id || !['roll', 'main'].includes(state.phase) || player.playedCard) return [];
  return [...new Set(player.cards.filter(c => c.kind !== 'charter' && c.boughtTurn < state.turn).map(c => c.kind))];
}
export function playCard(state: GameState, player: Player, action: Extract<Action, { type: 'PLAY_CARD' }>) {
  if (!playableCards(state, player).includes(action.kind)) throw new Error('That card cannot be played now');
  const resourceList = action.resources ?? [];
  if (resourceList.some(r => !RESOURCES.includes(r))) throw new Error('Unknown resource');
  if (action.kind === 'harvest') {
    if (resourceList.length !== 2) throw new Error('Choose two resources');
    const amounts = RESOURCES.map(r => [r, resourceList.filter(x => x === r).length] as const);
    if (amounts.some(([r, n]) => state.bank[r] < n)) throw new Error('Bank does not have those cards');
    for (const [r, n] of amounts) { state.bank[r] -= n; player.resources[r] += n; }
  }
  if (action.kind === 'monopoly') {
    if (resourceList.length !== 1) throw new Error('Choose one resource');
    const r = resourceList[0];
    for (const other of state.players) if (other.id !== player.id) { player.resources[r] += other.resources[r]; other.resources[r] = 0; }
  }
  if (action.kind === 'guard') {
    player.guards++; state.robberReturn = state.phase as 'roll' | 'main'; beginRobber(state, false);
  }
  if (action.kind === 'roads') {
    state.robberReturn = state.phase as 'roll' | 'main'; state.freeRoads = 2; state.phase = 'free-roads';
    if (!roads(state, player).length) throw new Error('No roads available to place');
  }
  player.cards.splice(player.cards.findIndex(c => c.kind === action.kind && c.boughtTurn < state.turn), 1);
  player.playedCard = true;
  event(state, 'card', `${player.name} played ${CARD_NAMES[action.kind]}.`, [player.id]);
}
