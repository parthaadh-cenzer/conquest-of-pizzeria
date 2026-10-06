import { it, expect } from 'vitest';
import { command, setup, grant, entropy, identity } from './helpers';
import { emptyHand, RESOURCES } from '../packages/game-engine/src/types';
import { applyAction } from '../packages/game-engine/src/engine';
import { generateBoard } from '../packages/board-generator/src/board';
import { NUMBER_COUNTS } from '../packages/board-generator/src/config';
import { projectView } from '../packages/game-engine/src/view';
import { chooseAction } from '../packages/ai/src/strategy';
it('every board has exactly the configured probability mix', () => { for (const size of ['classic', 'expanded', 'grand'] as const) { const board = generateBoard(size, identity); for (const [n, count] of Object.entries(NUMBER_COUNTS[size])) expect(Object.values(board.hexes).filter(h => h.number === Number(n))).toHaveLength(count); } });
it('executes resource-specific and generic port swaps and rejects empty bank', () => {
  let s = setup(); s.phase = 'main'; grant(s, 'p0');
  const wood = s.board.ports.find(p => p.resource === 'wood')!, any = s.board.ports.find(p => p.resource === 'any')!;
  s.buildings[s.board.edges[wood.edge].vertices[0]] = { owner: 'p0', kind: 'settlement' }; s.buildings[s.board.edges[any.edge].vertices[0]] = { owner: 'p0', kind: 'settlement' };
  s = command(s, { type: 'BANK_TRADE', give: 'wood', want: 'ore' }); expect(s.players[0].resources.wood).toBe(3);
  s = command(s, { type: 'BANK_TRADE', give: 'grain', want: 'ore' }); expect(s.players[0].resources.grain).toBe(2);
  s.bank.ore = 0; const before = structuredClone(s); expect(applyAction(s, 'p0', { type: 'BANK_TRADE', give: 'wood', want: 'ore' }, entropy).ok).toBe(false); expect(s).toEqual(before);
});
it('harvest rejects unavailable duplicate resources without consuming the card', () => {
  const s = setup(); s.phase = 'main'; s.bank.ore = 1; s.players[0].cards = [{ id: 'h', kind: 'harvest', boughtTurn: 0 }]; const before = structuredClone(s);
  expect(applyAction(s, 'p0', { type: 'PLAY_CARD', kind: 'harvest', resources: ['ore', 'ore'] }, entropy).ok).toBe(false); expect(s).toEqual(before);
});
it('every possible theft index maps to one held card, without choosing a resource uniformly', () => {
  let s = setup(); s.phase = 'victim'; s.robberReturn = 'main'; const tile = Object.values(s.board.hexes)[0]; s.robber = tile.id; s.buildings[tile.vertices[0]] = { owner: 'p1', kind: 'settlement' }; s.players[0].resources = emptyHand(); s.players[1].resources = { ...emptyHand(), wood: 1, ore: 3 };
  const received: string[] = [];
  for (let index = 0; index < 4; index++) { const next = command(s, { type: 'STEAL', victim: 'p1' }, 'p0', { ...entropy, randomIndex: () => index }); received.push(RESOURCES.find(r => next.players[0].resources[r] === 1)!); }
  expect(received).toEqual(['wood', 'ore', 'ore', 'ore']);
});
it('all six personalities use legal intents under real turn constraints', () => {
  for (const personality of ['balanced', 'trader', 'builder', 'expansionist', 'aggressive', 'chaotic'] as const) {
    let s = setup(); s.players[0].personality = personality; s.players[0].difficulty = 'expert'; s.phase = 'main'; grant(s, 'p0', 3);
    for (let i = 0; i < 15 && s.active === 0; i++) { const action = chooseAction(projectView(s, 'p0')); if (!action) break; const result = applyAction(s, 'p0', action, entropy); expect(result.ok, `${personality}: ${JSON.stringify(action)}`).toBe(true); if (result.ok) s = result.state; }
  }
});
