import { describe, it, expect } from 'vitest';
import { createGame } from '../packages/game-engine/src/state';
import { applyAction } from '../packages/game-engine/src/engine';
import { projectView } from '../packages/game-engine/src/view';
import { produce, victims } from '../packages/game-engine/src/production';
import { roadLength, updateAwards, score } from '../packages/game-engine/src/scoring';
import { bankRatio } from '../packages/game-engine/src/economy';
import { emptyHand, countHand, RESOURCES } from '../packages/game-engine/src/types';
import { command, setup, grant, profiles, identity, entropy } from './helpers';
describe('setup and turn machine', () => {
  it('gives two free settlements and roads in snake order; only second settlement produces starting cards', () => {
    let s = createGame(profiles(), 'classic', identity); const seen: number[] = [];
    while (s.phase.startsWith('setup')) {
      const view = projectView(s, s.players[s.active].id);
      if (s.phase === 'setup-settlement') { seen.push(s.active); s = command(s, { type: 'BUILD_SETTLEMENT', vertex: view.legal.settlements[0] }); if (s.setupIndex < 3) expect(countHand(s.players[s.active].resources)).toBe(0); }
      else s = command(s, { type: 'BUILD_ROAD', edge: view.legal.roads[0] });
    }
    expect(seen).toEqual([0, 1, 2, 2, 1, 0]); expect(s.phase).toBe('roll'); expect(s.turn).toBe(1);
    for (const p of s.players) { expect(Object.values(s.buildings).filter(b => b.owner === p.id)).toHaveLength(2); expect(Object.values(s.roads).filter(id => id === p.id)).toHaveLength(2); }
  });
  it('rejects wrong actor, wrong phase, repeated roll, and preserves input', () => {
    const s = setup(), original = structuredClone(s);
    expect(applyAction(s, 'p1', { type: 'ROLL_DICE' }, entropy).ok).toBe(false);
    expect(applyAction(s, 'p0', { type: 'END_TURN' }, entropy).ok).toBe(false); expect(s).toEqual(original);
    const rolled = command(s, { type: 'ROLL_DICE' }); expect(rolled.phase).toBe('main'); expect(rolled.history).toEqual([[3, 5]]);
    expect(applyAction(rolled, 'p0', { type: 'ROLL_DICE' }, entropy).ok).toBe(false);
    const next = command(rolled, { type: 'END_TURN' }); expect(next.active).toBe(1); expect(next.phase).toBe('roll');
  });
  it('supports 4, 6 and 8 seat setup', () => { for (const [n, size] of [[4, 'classic'], [6, 'expanded'], [8, 'grand']] as const) { const s = setup(n, size); expect(Object.keys(s.buildings)).toHaveLength(n * 2); expect(s.phase).toBe('roll'); } });
});
describe('production and Wanderer', () => {
  it('produces one per settlement, two per city; blocked production never takes held cards', () => {
    const s = createGame(profiles(), 'classic', identity); const tile = Object.values(s.board.hexes).find(h => h.resource === 'wood')!;
    s.buildings[tile.vertices[0]] = { owner: 'p0', kind: 'settlement' }; s.buildings[tile.vertices[2]] = { owner: 'p1', kind: 'city' };
    produce(s, tile.number!); expect(s.players[0].resources.wood).toBe(1); expect(s.players[1].resources.wood).toBe(2);
    s.robber = tile.id; const before = s.players.map(p => structuredClone(p.resources)); produce(s, tile.number!); expect(s.players.map(p => p.resources)).toEqual(before); expect(s.events.at(-1)?.type).toBe('blocked');
  });
  it('withholds a resource when bank cannot fulfill all production', () => { const s = createGame(profiles(), 'classic', identity); const h = Object.values(s.board.hexes).find(h => h.resource === 'wood')!; s.buildings[h.vertices[0]] = { owner: 'p0', kind: 'city' }; s.bank.wood = 1; produce(s, h.number!); expect(s.players[0].resources.wood).toBe(0); expect(s.bank.wood).toBe(1); });
  it('resolves all discards before movement, excludes self and empty victims, steals by card-weighted index', () => {
    let s = setup(); grant(s, 'p0', 2); s = command(s, { type: 'ROLL_DICE' }, 'p0', { ...entropy, rollDice: () => [1, 6] });
    expect(s.phase).toBe('discard'); expect(s.discards.p0).toBe(5);
    expect(applyAction(s, 'p0', { type: 'DISCARD', cards: emptyHand() }, entropy).ok).toBe(false);
    s = command(s, { type: 'DISCARD', cards: { wood: 2, brick: 2, grain: 1, wool: 0, ore: 0 } }); expect(s.phase).toBe('robber');
    const h = Object.values(s.board.hexes).find(h => h.id !== s.robber)!;
    s.buildings[h.vertices[0]] = { owner: 'p1', kind: 'settlement' }; s.players[1].resources = { wood: 1, brick: 2, grain: 0, wool: 0, ore: 0 };
    s = command(s, { type: 'MOVE_ROBBER', hex: h.id }); expect(s.phase).toBe('victim'); expect(victims(s, 'p0')).toContain('p1'); expect(victims(s, 'p0')).not.toContain('p0');
    const original = countHand(s.players[0].resources); s = command(s, { type: 'STEAL', victim: 'p1' }, 'p0', { ...entropy, randomIndex: () => 2 }); expect(s.players[0].resources.brick).toBe(1); expect(countHand(s.players[0].resources)).toBe(original + 1); expect(s.phase).toBe('main');
    expect(JSON.stringify(s.events.at(-1))).not.toContain('brick');
  });
});
describe('building, bank, ports, victory', () => {
  it('requires costs, respects legal hints and conserves all resource cards', () => {
    let s = setup(); s.phase = 'main'; grant(s, 'p0'); const v = projectView(s, 'p0');
    const e = v.legal.roads[0]; expect(e).toBeTruthy(); s = command(s, { type: 'BUILD_ROAD', edge: e }); expect(s.players[0].resources.wood).toBe(4);
    s = command(s, { type: 'BUILD_CITY', vertex: projectView(s, 'p0').legal.cities[0] }); expect(score(s, 'p0')).toBe(3);
    for (const r of RESOURCES) expect(s.bank[r] + s.players.reduce((n, p) => n + p.resources[r], 0)).toBe(19);
    s.players[0].resources = emptyHand(); expect(projectView(s, 'p0').legal.roads).toEqual([]); expect(applyAction(s, 'p0', { type: 'BUY_CARD' }, entropy).ok).toBe(false);
  });
  it('bank and owned ports charge the correct ratios', () => {
    let s = setup(); s.phase = 'main'; grant(s, 'p0'); s.buildings = {};
    expect(bankRatio(s, 'p0', 'wood')).toBe(4); s = command(s, { type: 'BANK_TRADE', give: 'wood', want: 'ore' }); expect(s.players[0].resources.wood).toBe(1);
    const port = s.board.ports.find(p => p.resource === 'wood')!; s.buildings[s.board.edges[port.edge].vertices[0]] = { owner: 'p0', kind: 'settlement' }; expect(bankRatio(s, 'p0', 'wood')).toBe(2); expect(bankRatio(s, 'p1', 'wood')).toBe(4);
    const any = s.board.ports.find(p => p.resource === 'any')!; s.buildings[s.board.edges[any.edge].vertices[0]] = { owner: 'p0', kind: 'settlement' }; expect(bankRatio(s, 'p0', 'ore')).toBe(3);
  });
  it('counts hidden charters only privately and wins only on owners turn', () => {
    let s = setup(); s.phase = 'main'; s.target = 8;
    s.players[1].cards = Array.from({ length: 6 }, (_, i) => ({ id: String(i), kind: 'charter', boughtTurn: 0 }));
    expect(score(s, 'p1')).toBe(2); expect(projectView(s, 'p1').self.score).toBe(8);
    s = command(s, { type: 'END_TURN' }); expect(s.winner).toBe('p1'); expect(s.phase).toBe('over'); expect(projectView(s, 'p0').players[1].score).toBe(8);
  });
});
describe('private information', () => {
  it('exposes own hand, opponent counts, no deck order, no hidden opponent cards', () => {
    const s = setup(); s.players[1].cards.push({ id: 'secret-card-id', kind: 'monopoly', boughtTurn: 0 }); s.players[1].resources.ore = 12;
    const v = projectView(s, 'p0'); expect(v.self.resources).toEqual(s.players[0].resources); expect(v.players[1].developmentCount).toBe(1);
    expect(v.players[1]).not.toHaveProperty('resources'); expect(v.players[1]).not.toHaveProperty('cards'); expect(v).not.toHaveProperty('deck'); expect(JSON.stringify(v)).not.toContain('secret-card-id');
    v.self.resources.wood = 999; expect(s.players[0].resources.wood).not.toBe(999); expect(() => projectView(s, 'intruder')).toThrow();
  });
});
describe('atomic social trading', () => {
  it('accept waits for active-player confirmation and swaps atomically', () => {
    let s = setup(); s.phase = 'main'; grant(s, 'p0'); grant(s, 'p1'); const give = { ...emptyHand(), wool: 2 }, want = { ...emptyHand(), ore: 1 };
    s = command(s, { type: 'PROPOSE_TRADE', give, want }); const id = s.trade!.id;
    s = command(s, { type: 'RESPOND_TRADE', tradeId: id, response: 'accept', give: emptyHand(), want: emptyHand() }, 'p1'); expect(s.players[0].resources.wool).toBe(5);
    s = command(s, { type: 'CONFIRM_TRADE', tradeId: id, player: 'p1' }); expect(s.players[0].resources.wool).toBe(3); expect(s.players[0].resources.ore).toBe(6); expect(s.players[1].resources.wool).toBe(7); expect(s.trade).toBeNull(); expect(s.events.at(-1)?.players).toEqual(['p0', 'p1']);
    expect(applyAction(s, 'p0', { type: 'CONFIRM_TRADE', tradeId: id, player: 'p1' }, entropy).ok).toBe(false);
  });
  it('supports counters, rejects stale/insufficient/disconnected trades with no partial mutation', () => {
    let s = setup(); s.phase = 'main'; grant(s, 'p0'); grant(s, 'p1');
    s = command(s, { type: 'PROPOSE_TRADE', give: { ...emptyHand(), wool: 2 }, want: { ...emptyHand(), ore: 1 } });
    s = command(s, { type: 'RESPOND_TRADE', tradeId: s.trade!.id, response: 'counter', give: { ...emptyHand(), ore: 1 }, want: { ...emptyHand(), wool: 1, brick: 1 } }, 'p1');
    s.players[0].resources.brick = 0; const before = structuredClone(s); expect(applyAction(s, 'p0', { type: 'CONFIRM_TRADE', tradeId: s.trade!.id, player: 'p1' }, entropy).ok).toBe(false); expect(s).toEqual(before);
    s.players[0].resources.brick = 1; s.players[1].connected = false; expect(applyAction(s, 'p0', { type: 'CONFIRM_TRADE', tradeId: s.trade!.id, player: 'p1' }, entropy).ok).toBe(false);
  });
  it('rejects negative quantities', () => { const s = setup(); s.phase = 'main'; expect(applyAction(s, 'p0', { type: 'PROPOSE_TRADE', give: { ...emptyHand(), wood: -1 }, want: { ...emptyHand(), ore: 1 } }, entropy).ok).toBe(false); });
});
describe('discovery cards', () => {
  it('charges, draws secretly, prevents immediate use and playing two cards', () => {
    let s = setup(); s.phase = 'main'; grant(s, 'p0'); const length = s.deck.length; s = command(s, { type: 'BUY_CARD' }); expect(s.deck).toHaveLength(length - 1); expect(s.players[0].cards[0].kind).toBe('guard');
    expect(applyAction(s, 'p0', { type: 'PLAY_CARD', kind: 'guard' }, entropy).ok).toBe(false);
    s.turn++; s = command(s, { type: 'PLAY_CARD', kind: 'guard' }); expect(s.phase).toBe('robber'); expect(s.players[0].guards).toBe(1);
    s.phase = 'main'; s.players[0].cards.push({ id: 'old', kind: 'harvest', boughtTurn: 0 }); expect(applyAction(s, 'p0', { type: 'PLAY_CARD', kind: 'harvest', resources: ['ore', 'ore'] }, entropy).ok).toBe(false);
  });
  it('harvest requires bank supply and monopoly transfers all matching cards', () => {
    let s = setup(); s.phase = 'main'; s.players[0].cards = [{ id: 'h', kind: 'harvest', boughtTurn: 0 }]; const before = s.players[0].resources.ore; s = command(s, { type: 'PLAY_CARD', kind: 'harvest', resources: ['ore', 'ore'] }); expect(s.players[0].resources.ore).toBe(before + 2);
    s.players[0].playedCard = false; s.players[0].cards = [{ id: 'm', kind: 'monopoly', boughtTurn: 0 }]; s.players[1].resources.wood = 4; s.players[2].resources.wood = 2; const wood = s.players[0].resources.wood; s = command(s, { type: 'PLAY_CARD', kind: 'monopoly', resources: ['wood'] }); expect(s.players[0].resources.wood).toBe(wood + 6); expect(s.players[1].resources.wood).toBe(0);
  });
  it('free roads return to pre-roll phase without bypassing dice', () => { let s = setup(); s.players[0].cards = [{ id: 'r', kind: 'roads', boughtTurn: 0 }]; s = command(s, { type: 'PLAY_CARD', kind: 'roads' }); for (let i = 0; i < 2; i++) s = command(s, { type: 'BUILD_ROAD', edge: projectView(s, 'p0').legal.roads[0] }); expect(s.phase).toBe('roll'); });
});
describe('longest trail topology', () => {
  it('counts a cycle once per edge and splits at opponent buildings', () => {
    const s = createGame(profiles(), 'classic', identity), hex = Object.values(s.board.hexes)[8];
    for (const e of Object.values(s.board.edges).filter(e => e.hexes.includes(hex.id))) s.roads[e.id] = 'p0';
    expect(roadLength(s, 'p0')).toBe(6); updateAwards(s); expect(s.longestRoad).toBe('p0');
    s.buildings[hex.vertices[0]] = { owner: 'p1', kind: 'settlement' }; s.buildings[hex.vertices[3]] = { owner: 'p1', kind: 'settlement' }; expect(roadLength(s, 'p0')).toBe(3); updateAwards(s); expect(s.longestRoad).toBeNull();
  });
  it('does not sum all three branches of a fork', () => { const s = createGame(profiles(), 'classic', identity); const v = Object.values(s.board.vertices).find(v => v.edges.length === 3)!; v.edges.forEach(e => s.roads[e] = 'p0'); expect(roadLength(s, 'p0')).toBe(2); });
  it('retains tied army holder, transfers to strictly larger army', () => { const s = setup(); s.players[0].guards = 3; updateAwards(s); expect(s.largestGuard).toBe('p0'); s.players[1].guards = 3; updateAwards(s); expect(s.largestGuard).toBe('p0'); s.players[1].guards = 4; updateAwards(s); expect(s.largestGuard).toBe('p1'); });
});
