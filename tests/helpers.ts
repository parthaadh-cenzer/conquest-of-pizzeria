import { createGame } from '../packages/game-engine/src/state';
import { applyAction } from '../packages/game-engine/src/engine';
import { projectView } from '../packages/game-engine/src/view';
import { RESOURCES, type Action, type Entropy, type GameState, type Profile, type Size } from '../packages/game-engine/src/types';
export const identity = <T>(values: readonly T[]) => [...values];
export const profiles = (n = 3): Profile[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, color: '#fff', avatar: '', ai: false, difficulty: 'normal', personality: 'balanced', connected: true }));
export const entropy: Entropy = { rollDice: () => [3, 5], randomIndex: () => 0, shufflePortEdges: edges => [...edges].reverse() };
export function command(s: GameState, a: Action, actor = s.players[s.active].id, rng = entropy) { const result = applyAction(s, actor, a, rng); if (!result.ok) throw new Error(result.error); return result.state; }
export function setup(n = 3, size: Size = 'classic') {
  let s = createGame(profiles(n), size, identity);
  while (s.phase.startsWith('setup')) { const view = projectView(s, s.players[s.active].id); s = command(s, s.phase === 'setup-settlement' ? { type: 'BUILD_SETTLEMENT', vertex: view.legal.settlements[0] } : { type: 'BUILD_ROAD', edge: view.legal.roads[0] }); }
  return s;
}
export function grant(s: GameState, id: string, amount = 5) { const p = s.players.find(p => p.id === id)!; for (const r of RESOURCES) { s.bank[r] -= amount - p.resources[r]; p.resources[r] = amount; } }
