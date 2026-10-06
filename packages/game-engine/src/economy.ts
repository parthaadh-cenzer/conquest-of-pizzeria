import { RESOURCES, type Hand, type GameState, type Player, type Resource } from './types';
export const COST = {
  road: { wood: 1, brick: 1, grain: 0, wool: 0, ore: 0 },
  settlement: { wood: 1, brick: 1, grain: 1, wool: 1, ore: 0 },
  city: { wood: 0, brick: 0, grain: 2, wool: 0, ore: 3 },
  card: { wood: 0, brick: 0, grain: 1, wool: 1, ore: 1 },
} satisfies Record<string, Hand>;
export const canAfford = (hand: Hand, cost: Hand) => RESOURCES.every(r => hand[r] >= cost[r]);
export function validHand(hand: Hand) { return !!hand && RESOURCES.every(r => Number.isSafeInteger(hand[r]) && hand[r] >= 0 && hand[r] <= 1000); }
export function transfer(from: Hand, to: Hand, amount: Hand) { for (const r of RESOURCES) { from[r] -= amount[r]; to[r] += amount[r]; } }
export function pay(state: GameState, player: Player, cost: Hand) { if (!canAfford(player.resources, cost)) throw new Error('Not enough resources'); transfer(player.resources, state.bank, cost); }
export function bankRatio(state: Pick<GameState, 'board' | 'buildings'>, owner: string, resource: Resource) {
  let ratio = 4;
  for (const port of state.board.ports) if (state.board.edges[port.edge].vertices.some(v => state.buildings[v]?.owner === owner)) {
    if (port.resource === resource || port.resource === 'any') ratio = Math.min(ratio, port.ratio);
  }
  return ratio;
}
