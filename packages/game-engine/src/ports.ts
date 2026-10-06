import type { Entropy, GameState } from './types';
import { event } from './state';
/** Called only at the end of the robber transaction. Stable array identity binds each
 * merchant/type to its satellite island while the legal dock assignment changes. */
export function finishPortShift(state: GameState, entropy: Entropy) {
  if (!state.portShiftPending) return;
  state.portShiftPending = false;
  if (!state.settings.shiftingPorts) return;
  const before = state.board.ports.map(p => p.edge), next = entropy.shufflePortEdges(before);
  if (next.length !== before.length || new Set(next).size !== before.length || next.some(e => !before.includes(e))) throw new Error('Invalid port assignment');
  state.board.ports = state.board.ports.map((port, i) => ({ ...port, edge: next[i] }));
  state.portRevision++;
  event(state, 'ports-shifted', 'The trade bell rings. Merchants have exchanged docks.');
}
