import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createGame } from '../packages/game-engine/src/state';
import { applyAction } from '../packages/game-engine/src/engine';
import { projectView } from '../packages/game-engine/src/view';
import { chooseAction } from '../packages/ai/src/strategy';
import { rollDice, randomIndex, shufflePortEdges, secureShuffle } from '../apps/server/src/random';
import { profiles } from './helpers';
import { RESOURCES } from '../packages/game-engine/src/types';
import { CONFIG } from '../packages/board-generator/src/config';
for (const [size, seats] of [['classic', 3], ['expanded', 6], ['grand', 8]] as const) it(`${seats} AI finish a complete ${size} game with conserved resources and no illegal intents`, () => {
  let state = createGame(profiles(seats).map(p => ({ ...p, ai: true, difficulty: 'expert' })), size, secureShuffle), steps = 0;
  const started = performance.now();
  while (state.phase !== 'over' && steps < 12000) {
    const candidates = state.players.filter(p => state.discards[p.id] || (state.trade && state.trade.owner !== p.id && !state.trade.responses.some(r => r.player === p.id))); candidates.push(state.players[state.active]);
    const decision = candidates.map(p => ({ player: p.id, action: chooseAction(projectView(state, p.id)) })).find(d => d.action);
    expect(decision, `Deadlock in ${state.phase}`).toBeTruthy();
    const result = applyAction(state, decision!.player, decision!.action!, { rollDice, randomIndex, shufflePortEdges });
    expect(result.ok, JSON.stringify(decision)).toBe(true); if (!result.ok) throw new Error(result.error); state = result.state; steps++;
    for (const r of RESOURCES) { expect(state.bank[r]).toBeGreaterThanOrEqual(0); expect(state.bank[r] + state.players.reduce((n, p) => n + p.resources[r], 0)).toBe(CONFIG[size].bank); }
  }
  expect(state.phase).toBe('over'); expect(state.winner).toBeTruthy();
  mkdirSync('artifacts/simulations', { recursive: true });
  writeFileSync(`artifacts/simulations/latest-${size}.json`, JSON.stringify({ size, seats, winner: state.winner, turns: state.turn, steps, ms: Math.round(performance.now() - started), rolls: state.history.length, date: new Date().toISOString() }, null, 2));
});
