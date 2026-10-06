import { createGame } from '../packages/game-engine/src/state';
import { projectView } from '../packages/game-engine/src/view';
import { applyAction } from '../packages/game-engine/src/engine';
import { chooseAction } from '../packages/ai/src/strategy';
import { rollDice, randomIndex, shufflePortEdges, secureShuffle } from '../apps/server/src/random';
import type { Profile, Size } from '../packages/game-engine/src/types';
import { mkdirSync, writeFileSync } from 'node:fs';
const games = Number(process.argv[2] ?? 3), seats = Number(process.argv[3] ?? 3);
if (!Number.isInteger(seats) || seats < 3 || seats > 8 || !Number.isInteger(games) || games < 1) throw new Error('Usage: npm run simulate -- <games> <3-8 seats>');
const size: Size = seats <= 4 ? 'classic' : seats <= 6 ? 'expanded' : 'grand';
const results = [];
for (let n = 0; n < games; n++) {
  const profiles: Profile[] = Array.from({ length: seats }, (_, i) => ({ id: `ai${i}`, name: `AI ${i}`, color: '#000000', avatar: `avatar:${i}`, ai: true, difficulty: i % 2 ? 'expert' : 'hard', personality: ['balanced', 'builder', 'trader'][i % 3] as Profile['personality'], connected: true }));
  let s = createGame(profiles, size, secureShuffle), steps = 0; const started = performance.now();
  while (s.phase !== 'over' && steps < 15000) {
    const candidates = s.players.filter(p => s.discards[p.id] || (s.trade && s.trade.owner !== p.id && !s.trade.responses.some(r => r.player === p.id)));
    candidates.push(s.players[s.active]); let acted = false;
    for (const p of candidates) { const action = chooseAction(projectView(s, p.id)); if (!action) continue; const result = applyAction(s, p.id, action, { rollDice, randomIndex, shufflePortEdges }); if (!result.ok) throw new Error(`Illegal AI action ${JSON.stringify(action)}: ${result.error}`); s = result.state; acted = true; break; }
    if (!acted) throw new Error(`Deadlock in ${s.phase}`); steps++;
  }
  const metric = { game: n + 1, seats, turns: s.turn, steps, winner: s.winner, ms: Math.round(performance.now() - started) }; results.push(metric); console.log(JSON.stringify(metric));
}
const summary = { games, seats, finished: results.filter(r => r.winner).length, averageTurns: Math.round(results.reduce((n, r) => n + r.turns, 0) / games) };
mkdirSync('artifacts/simulations', { recursive: true });
const path = `artifacts/simulations/${new Date().toISOString().replace(/[:.]/g, '-')}-${seats}-seats.json`;
writeFileSync(path, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify({ ...summary, metrics: path }));
