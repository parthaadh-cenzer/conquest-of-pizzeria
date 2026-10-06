import { describe, expect, it } from 'vitest';
import { generateBoard } from '../packages/board-generator/src/board';
import { CONFIG } from '../packages/board-generator/src/config';
import { createGame, setupOrder } from '../packages/game-engine/src/state';
import { distanceClear, connectedRoad } from '../packages/game-engine/src/placement';
import { rollDice, secureShuffle } from '../apps/server/src/random';
import { readFileSync } from 'node:fs';
import type { Profile, Size } from '../packages/game-engine/src/types';
export const identity = <T>(values: readonly T[]) => [...values];
export const profiles = (n = 3): Profile[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, color: '#fff', avatar: '', ai: false, difficulty: 'normal', personality: 'balanced', connected: true }));
describe('board graph', () => {
  for (const [size, n] of [['classic', 19], ['expanded', 30], ['grand', 37]] as [Size, number][]) it(`${size}: connected, manifold, resource-balanced graph`, () => {
    const b = generateBoard(size, identity);
    expect(Object.keys(b.hexes)).toHaveLength(n);
    expect(Object.keys(b.vertices).length - Object.keys(b.edges).length + n).toBe(1);
    for (const h of Object.values(b.hexes)) { expect(h.vertices).toHaveLength(6); expect(new Set(h.vertices).size).toBe(6); }
    for (const e of Object.values(b.edges)) { expect(e.hexes.length).toBeGreaterThanOrEqual(1); expect(e.hexes.length).toBeLessThanOrEqual(2); for (const v of e.vertices) expect(b.vertices[v].edges).toContain(e.id); }
    for (const [r, amount] of Object.entries(CONFIG[size].tiles)) expect(Object.values(b.hexes).filter(h => h.resource === r)).toHaveLength(amount);
    expect(b.ports).toHaveLength(CONFIG[size].ports);
    expect(new Set(b.ports.flatMap(p => b.edges[p.edge].vertices)).size).toBe(b.ports.length * 2);
    const visited = new Set<string>(); const visit = (v: string) => { if (visited.has(v)) return; visited.add(v); b.vertices[v].edges.forEach(e => b.edges[e].vertices.forEach(visit)); }; visit(Object.keys(b.vertices)[0]); expect(visited.size).toBe(Object.keys(b.vertices).length);
  });
  it('classic has 54 vertices and 72 edges', () => { const b = generateBoard('classic', identity); expect(Object.keys(b.vertices)).toHaveLength(54); expect(Object.keys(b.edges)).toHaveLength(72); });
  it('rejects seats and duplicate identities', () => { expect(() => createGame(profiles(2), 'classic', identity)).toThrow(); expect(() => createGame([profiles()[0], ...profiles()], 'classic', identity)).toThrow(); });
  it('uses forward then reverse setup', () => expect(setupOrder(4)).toEqual([0, 1, 2, 3, 3, 2, 1, 0]));
  it('enforces distance and blocks roads through opponents', () => {
    const s = createGame(profiles(), 'classic', identity); const [v] = Object.keys(s.board.vertices); s.buildings[v] = { owner: 'p0', kind: 'settlement' };
    expect(distanceClear(s, v)).toBe(false);
    for (const e of s.board.vertices[v].edges) { for (const n of s.board.edges[e].vertices) expect(distanceClear(s, n)).toBe(false); expect(connectedRoad(s, 'p0', e)).toBe(true); expect(connectedRoad(s, 'p1', e)).toBe(false); }
  });
});
describe('unbiased independent dice boundary', () => {
  it('always emits two integer dice in range', () => { for (let i = 0; i < 10000; i++) { const dice = rollDice(); expect(dice).toHaveLength(2); for (const d of dice) { expect(Number.isInteger(d)).toBe(true); expect(d).toBeGreaterThanOrEqual(1); expect(d).toBeLessThanOrEqual(6); } } });
  it('accepts no state and depends only on node crypto', () => { expect(rollDice.length).toBe(0); const source = readFileSync('apps/server/src/random.ts', 'utf8'); expect(source).toContain("from 'node:crypto'"); expect(source).not.toMatch(/Math\.random|game-engine|ai\/|history|seed/); expect(source).toContain('[randomInt(1, 7), randomInt(1, 7)]'); });
  it('shuffle preserves every item without mutating input', () => { const input = [1, 2, 3, 4, 5]; expect(secureShuffle(input).sort()).toEqual(input); expect(input).toEqual([1, 2, 3, 4, 5]); });
});
