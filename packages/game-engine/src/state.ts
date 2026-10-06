import { CONFIG } from '../../board-generator/src/config';
import { generateBoard, type Shuffle } from '../../board-generator/src/board';
import { emptyHand, RESOURCES, type GameState, type Size, type Profile, type CardKind, type GameSettings } from './types';
export function createGame(profiles: Profile[], size: Size, shuffle: Shuffle, target = 10, settings: GameSettings = { shiftingPorts: true }): GameState {
  const config = CONFIG[size];
  if (profiles.length < config.min || profiles.length > config.max) throw new Error(`This island needs ${config.min}–${config.max} players`);
  if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw new Error('Duplicate player identity');
  if (!Number.isInteger(target) || target < 8 || target > 15) throw new Error('Victory target must be 8–15');
  if (typeof settings.shiftingPorts !== 'boolean') throw new Error('Shifting Ports must be on or off');
  const board = generateBoard(size, shuffle);
  return {
    version: 1, revision: 0, size, target, board, players: profiles.map(p => ({ ...p, resources: emptyHand(), cards: [], guards: 0, playedCard: false })),
    settings: { shiftingPorts: settings.shiftingPorts }, portShiftPending: false, portRevision: 0,
    bank: Object.fromEntries(RESOURCES.map(r => [r, config.bank])) as GameState['bank'],
    deck: shuffle(Object.entries(config.deck).flatMap(([c, n]) => Array<CardKind>(n).fill(c as CardKind))),
    buildings: {}, roads: {}, phase: 'setup-settlement', active: 0, turn: 0, setupIndex: 0, setupVertex: null,
    robber: Object.values(board.hexes).find(h => h.resource === 'desert')!.id, robberReturn: 'main', discards: {}, freeRoads: 0,
    dice: null, history: [], trade: null, longestRoad: null, largestGuard: null, winner: null, events: [], nextEvent: 0,
  };
}
export function event(state: GameState, type: string, text: string, players: string[] = [], hexes?: string[]) {
  state.events.push({ id: state.nextEvent++, type, text, players, ...(hexes ? { hexes } : {}) });
  if (state.events.length > 60) state.events.shift();
}
export function setupOrder(count: number): number[] { return [...Array(count).keys(), ...[...Array(count).keys()].reverse()]; }
