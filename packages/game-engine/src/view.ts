import { RESOURCES, countHand, type GameState, type GameView } from './types';
import { settlements, roads, cities } from './placement';
import { victims } from './production';
import { bankRatio, canAfford, COST } from './economy';
import { score, roadLength } from './scoring';
import { playableCards } from './development';
/** Explicit allowlist. Opponent hands, deck order and card kinds never cross this boundary. */
export function projectView(state: GameState, playerId: string): GameView {
  const me = state.players.find(p => p.id === playerId);
  if (!me) throw new Error('No seat for this session');
  const active = state.players[state.active].id === playerId;
  return structuredClone({
    version: 1, revision: state.revision, size: state.size, target: state.target, board: state.board,
    settings: state.settings, portShiftPending: state.portShiftPending, portRevision: state.portRevision,
    players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, avatar: p.avatar, ai: p.ai, difficulty: p.difficulty, personality: p.personality, connected: p.connected,
      resourceCount: countHand(p.resources), developmentCount: p.cards.length, guards: p.guards, score: score(state, p.id, state.phase === 'over'), roadLength: roadLength(state, p.id) })),
    bank: state.bank, deckCount: state.deck.length, buildings: state.buildings, roads: state.roads, phase: state.phase, active: state.active,
    turn: state.turn, robber: state.robber, discards: state.discards, dice: state.dice, history: state.history, trade: state.trade,
    longestRoad: state.longestRoad, largestGuard: state.largestGuard, winner: state.winner, events: state.events,
    self: { id: playerId, resources: me.resources, cards: me.cards, score: score(state, playerId, true) },
    legal: { settlements: settlements(state, me), roads: roads(state, me), cities: cities(state, me),
      robberHexes: active && state.phase === 'robber' ? Object.keys(state.board.hexes).filter(h => h !== state.robber) : [],
      victims: active && state.phase === 'victim' ? victims(state, playerId) : [], playableCards: playableCards(state, me),
      bankRatios: Object.fromEntries(RESOURCES.map(r => [r, bankRatio(state, playerId, r)])) as GameView['legal']['bankRatios'],
      canBuyCard: active && state.phase === 'main' && !!state.deck.length && canAfford(me.resources, COST.card) },
  } satisfies GameView);
}
