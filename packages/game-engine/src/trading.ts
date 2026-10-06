import { canAfford, transfer, validHand } from './economy';
import { countHand, RESOURCES, type GameState, type Hand, type Player, type Action } from './types';
import { event } from './state';
function terms(give: Hand, want: Hand) {
  if (!validHand(give) || !validHand(want) || countHand(give) === 0 || countHand(want) === 0) throw new Error('Choose positive amounts on both sides');
  if (RESOURCES.some(r => give[r] && want[r])) throw new Error('Do not put the same resource on both sides');
}
export function propose(state: GameState, player: Player, give: Hand, want: Hand) {
  terms(give, want);
  if (!canAfford(player.resources, give)) throw new Error('You cannot afford this offer');
  state.trade = { id: `trade-${state.revision + 1}`, owner: player.id, give, want, responses: [] };
  event(state, 'offer', `${player.name} opened a trade.`, [player.id]);
}
export function respond(state: GameState, player: Player, action: Extract<Action, { type: 'RESPOND_TRADE' }>) {
  const trade = state.trade;
  if (!trade || trade.id !== action.tradeId) throw new Error('This offer has expired');
  if (trade.owner === player.id) throw new Error('Cannot respond to your own trade');
  const give = action.response === 'accept' ? trade.want : action.give;
  const want = action.response === 'accept' ? trade.give : action.want;
  if (action.response !== 'pass') { terms(give, want); if (!canAfford(player.resources, give)) throw new Error('You cannot afford this response'); }
  trade.responses = trade.responses.filter(r => r.player !== player.id);
  trade.responses.push({ player: player.id, status: action.response, give, want });
  event(state, 'response', `${player.name} ${action.response === 'pass' ? 'passed' : action.response === 'counter' ? 'countered' : 'accepted the terms'}.`, [player.id]);
}
export function confirm(state: GameState, player: Player, tradeId: string, partnerId: string) {
  const trade = state.trade;
  if (!trade || trade.id !== tradeId || trade.owner !== player.id) throw new Error('This offer has expired');
  const response = trade.responses.find(r => r.player === partnerId && r.status !== 'pass');
  const partner = state.players.find(p => p.id === partnerId);
  if (!response || !partner) throw new Error('Choose a valid response');
  if (!partner.connected && !partner.ai) throw new Error('Trading partner is disconnected');
  if (!canAfford(player.resources, response.want) || !canAfford(partner.resources, response.give)) throw new Error('Inventories changed; please make a new offer');
  // All validation precedes either transfer. The engine commits the whole cloned state atomically.
  transfer(player.resources, partner.resources, response.want);
  transfer(partner.resources, player.resources, response.give);
  state.trade = null;
  event(state, 'trade', `${player.name} and ${partner.name} completed a trade.`, [player.id, partner.id]);
}
