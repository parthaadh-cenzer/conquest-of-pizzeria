export const RESOURCES = ['wood', 'brick', 'grain', 'wool', 'ore'] as const;
export type Resource = typeof RESOURCES[number];
export type Hand = Record<Resource, number>;
export const emptyHand = (): Hand => ({ wood: 0, brick: 0, grain: 0, wool: 0, ore: 0 });
export const countHand = (hand: Hand) => RESOURCES.reduce((n, r) => n + hand[r], 0);
export type Size = 'classic' | 'expanded' | 'grand';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';
export type Personality = 'balanced' | 'trader' | 'builder' | 'expansionist' | 'aggressive' | 'chaotic';
export type CardKind = 'guard' | 'charter' | 'roads' | 'harvest' | 'monopoly';
export interface Card { id: string; kind: CardKind; boughtTurn: number }
export interface Hex { id: string; q: number; r: number; x: number; y: number; resource: Resource | 'desert'; number: number | null; vertices: string[] }
export interface Vertex { id: string; x: number; y: number; hexes: string[]; edges: string[] }
export interface Edge { id: string; vertices: [string, string]; hexes: string[] }
export interface Port { edge: string; resource: Resource | 'any'; ratio: 2 | 3 }
export interface Board { hexes: Record<string, Hex>; vertices: Record<string, Vertex>; edges: Record<string, Edge>; ports: Port[] }
export interface Profile { id: string; name: string; color: string; avatar: string; ai: boolean; difficulty: Difficulty; personality: Personality; connected: boolean }
export interface Player extends Profile { resources: Hand; cards: Card[]; guards: number; playedCard: boolean }
export type Phase = 'setup-settlement' | 'setup-road' | 'roll' | 'discard' | 'robber' | 'victim' | 'main' | 'free-roads' | 'over';
export interface Building { owner: string; kind: 'settlement' | 'city' }
export interface TradeResponse { player: string; status: 'accept' | 'counter' | 'pass'; give: Hand; want: Hand }
export interface Trade { id: string; owner: string; give: Hand; want: Hand; responses: TradeResponse[] }
export interface GameEvent { id: number; type: string; text: string; players: string[]; hexes?: string[] }
export interface GameSettings { shiftingPorts: boolean }
export interface GameState {
  version: 1; revision: number; size: Size; target: number; board: Board; players: Player[];
  settings: GameSettings; portShiftPending: boolean; portRevision: number;
  bank: Hand; deck: CardKind[]; buildings: Record<string, Building>; roads: Record<string, string>;
  phase: Phase; active: number; turn: number; setupIndex: number; setupVertex: string | null;
  robber: string; robberReturn: 'roll' | 'main'; discards: Record<string, number>;
  freeRoads: number; dice: [number, number] | null; history: [number, number][];
  trade: Trade | null; longestRoad: string | null; largestGuard: string | null;
  winner: string | null; events: GameEvent[]; nextEvent: number;
}
export interface PublicPlayer extends Profile { resourceCount: number; developmentCount: number; guards: number; score: number; roadLength: number }
export interface LegalActions { settlements: string[]; roads: string[]; cities: string[]; robberHexes: string[]; victims: string[]; playableCards: CardKind[]; bankRatios: Record<Resource, number>; canBuyCard: boolean }
export interface GameView {
  version: 1; revision: number; size: Size; target: number; board: Board;
  settings: GameSettings; portShiftPending: boolean; portRevision: number;
  players: PublicPlayer[]; bank: Hand; deckCount: number; buildings: Record<string, Building>; roads: Record<string, string>;
  phase: Phase; active: number; turn: number; robber: string; discards: Record<string, number>;
  dice: [number, number] | null; history: [number, number][]; trade: Trade | null;
  longestRoad: string | null; largestGuard: string | null; winner: string | null; events: GameEvent[];
  self: { id: string; resources: Hand; cards: Card[]; score: number }; legal: LegalActions;
}
export type Action =
 | { type: 'BUILD_SETTLEMENT'; vertex: string }
 | { type: 'BUILD_ROAD'; edge: string }
 | { type: 'BUILD_CITY'; vertex: string }
 | { type: 'ROLL_DICE' }
 | { type: 'END_TURN' }
 | { type: 'DISCARD'; cards: Hand }
 | { type: 'MOVE_ROBBER'; hex: string }
 | { type: 'STEAL'; victim: string }
 | { type: 'BANK_TRADE'; give: Resource; want: Resource }
 | { type: 'PROPOSE_TRADE'; give: Hand; want: Hand }
 | { type: 'RESPOND_TRADE'; tradeId: string; response: 'accept' | 'counter' | 'pass'; give: Hand; want: Hand }
 | { type: 'CONFIRM_TRADE'; tradeId: string; player: string }
 | { type: 'CANCEL_TRADE' }
 | { type: 'BUY_CARD' }
 | { type: 'PLAY_CARD'; kind: Exclude<CardKind, 'charter'>; resources?: Resource[] };
/** Only the trusted host supplies entropy. Never serialized in a client message. */
export interface Entropy { rollDice(): [number, number]; randomIndex(length: number): number; shufflePortEdges(edges: readonly string[]): string[] }
export type Outcome = { ok: true; state: GameState } | { ok: false; error: string };
