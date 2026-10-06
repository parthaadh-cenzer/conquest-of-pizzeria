import { RESOURCES, emptyHand, countHand, type GameView, type Action, type Hand, type Resource } from '../../game-engine/src/types';
import { COST, canAfford } from '../../game-engine/src/economy';
import { distanceClear } from '../../game-engine/src/placement';
const pip = (n: number | null) => n ? 6 - Math.abs(7 - n) : 0;
/** The strategy only accepts a filtered seat view. It has no RNG or authoritative state import. */
export function chooseAction(v: GameView): Action | null {
  const me = v.players.find(p => p.id === v.self.id)!, hand = v.self.resources;
  const advanced = me.difficulty === 'hard' || me.difficulty === 'expert';
  const expert = me.difficulty === 'expert';
  const income = Object.fromEntries(RESOURCES.map(r => [r, 0])) as Hand;
  for (const [id, b] of Object.entries(v.buildings)) if (b.owner === me.id) for (const h of v.board.vertices[id].hexes) {
    const tile = v.board.hexes[h]; if (tile.resource !== 'desert') income[tile.resource] += pip(tile.number) * (b.kind === 'city' ? 2 : 1);
  }
  const vertexValue = (id: string) => {
    const vertex = v.board.vertices[id], tiles = vertex.hexes.map(h => v.board.hexes[h]);
    if (me.difficulty === 'easy') return tiles.length + (vertex.x + 10) * 0.01;
    let value = tiles.reduce((n, t) => n + pip(t.number) * (t.resource === 'desert' ? 0 : (advanced ? 1 + 2 / (1 + income[t.resource]) : 1)), 0);
    value += new Set(tiles.map(t => t.resource)).size * 1.4;
    if (expert) value += v.board.ports.filter(p => v.board.edges[p.edge].vertices.includes(id)).reduce((n, p) => n + (p.resource === 'any' ? 2 : income[p.resource] / 3), 0);
    if (me.personality === 'builder') value += tiles.filter(t => t.resource === 'ore' || t.resource === 'grain').reduce((n, t) => n + pip(t.number), 0);
    if (me.personality === 'chaotic') value += ((Math.abs(vertex.x * 97 + vertex.y * 41) % 7) - 3);
    return value;
  };
  const bestVertex = (ids: string[]) => [...ids].sort((a, b) => vertexValue(b) - vertexValue(a))[0];
  if (v.discards[me.id]) {
    const cards = emptyHand(), copy = { ...hand };
    for (let i = 0; i < v.discards[me.id]; i++) { const r = [...RESOURCES].sort((a, b) => copy[b] - copy[a])[0]; copy[r]--; cards[r]++; }
    return { type: 'DISCARD', cards };
  }
  if (v.trade && v.trade.owner !== me.id && !v.trade.responses.some(r => r.player === me.id)) {
    const give = v.trade.want, want = v.trade.give;
    const value = (h: Hand) => RESOURCES.reduce((n, r) => n + h[r] * (advanced ? 1 + 2 / (1 + hand[r]) : 1), 0);
    const owner = v.players.find(p => p.id === v.trade!.owner)!;
    const acceptable = canAfford(hand, give) && value(want) >= value(give) * (me.personality === 'trader' ? 0.8 : 1) && (!expert || owner.score < v.target - 2);
    if (acceptable) return { type: 'RESPOND_TRADE', tradeId: v.trade.id, response: 'accept', give, want };
    const counterGive = { ...give };
    const max = [...RESOURCES].sort((a, b) => counterGive[b] - counterGive[a])[0];
    if (counterGive[max] > 1) { counterGive[max]--; if (canAfford(hand, counterGive) && value(want) >= value(counterGive)) return { type: 'RESPOND_TRADE', tradeId: v.trade.id, response: 'counter', give: counterGive, want }; }
    return { type: 'RESPOND_TRADE', tradeId: v.trade.id, response: 'pass', give: emptyHand(), want: emptyHand() };
  }
  if (v.players[v.active].id !== me.id || v.phase === 'over') return null;
  if (v.phase === 'setup-settlement') return { type: 'BUILD_SETTLEMENT', vertex: bestVertex(v.legal.settlements) };
  // Breadth-first road planning uses only public graph state. Prefer useful sites within reach.
  const roadValue = (edge: string) => {
    const queue = v.board.edges[edge].vertices.map(id => ({ id, d: 0 })), seen = new Set<string>(); let best = -100;
    for (let i = 0; i < queue.length; i++) {
      const { id, d } = queue[i]; if (seen.has(id) || d > 5) continue; seen.add(id);
      if (v.buildings[id] && v.buildings[id].owner !== me.id) continue;
      if (distanceClear(v, id)) best = Math.max(best, vertexValue(id) / (d + 1));
      for (const e of v.board.vertices[id].edges) if (!v.roads[e] || v.roads[e] === me.id) for (const next of v.board.edges[e].vertices) if (next !== id) queue.push({ id: next, d: d + (v.roads[e] === me.id ? 0 : 1) });
    }
    return best;
  };
  const bestRoad = () => [...v.legal.roads].sort((a, b) => roadValue(b) - roadValue(a))[0];
  if (v.phase === 'setup-road' || v.phase === 'free-roads') return { type: 'BUILD_ROAD', edge: bestRoad() };
  if (v.phase === 'robber') {
    const targetValue = (id: string) => v.board.hexes[id].vertices.reduce((n, vertex) => { const b = v.buildings[vertex]; if (!b) return n; const p = v.players.find(p => p.id === b.owner)!; return n + (b.owner === me.id ? -30 : (b.kind === 'city' ? 2 : 1) * (pip(v.board.hexes[id].number) + (advanced ? p.score * (me.personality === 'aggressive' ? 2 : 1) : 0)) + (p.resourceCount ? 1 : 0)); }, 0);
    return { type: 'MOVE_ROBBER', hex: [...v.legal.robberHexes].sort((a, b) => targetValue(b) - targetValue(a))[0] };
  }
  if (v.phase === 'victim') return { type: 'STEAL', victim: [...v.legal.victims].sort((a, b) => { const ap = v.players.find(p => p.id === a)!, bp = v.players.find(p => p.id === b)!; return advanced ? bp.score - ap.score : bp.resourceCount - ap.resourceCount; })[0] };
  if (v.phase === 'roll') {
    if (advanced && v.legal.playableCards.includes('guard') && v.board.hexes[v.robber].vertices.some(id => v.buildings[id]?.owner === me.id)) return { type: 'PLAY_CARD', kind: 'guard' };
    return { type: 'ROLL_DICE' };
  }
  if (v.phase !== 'main') return null;
  if (v.trade?.owner === me.id) {
    const response = v.trade.responses.find(r => r.status !== 'pass' && canAfford(hand, r.want));
    if (response) return { type: 'CONFIRM_TRADE', tradeId: v.trade.id, player: response.player };
    return { type: 'CANCEL_TRADE' };
  }
  if (me.personality === 'aggressive' && v.legal.canBuyCard && me.guards < 3 && hand.ore < 3) return { type: 'BUY_CARD' };
  if (v.legal.cities.length) return { type: 'BUILD_CITY', vertex: bestVertex(v.legal.cities) };
  if (v.legal.settlements.length) return { type: 'BUILD_SETTLEMENT', vertex: bestVertex(v.legal.settlements) };
  const personalCards = v.legal.playableCards;
  if (personalCards.includes('guard')) return { type: 'PLAY_CARD', kind: 'guard' };
  const desired: Resource[] = [...RESOURCES].sort((a, b) => hand[a] - hand[b]);
  if (personalCards.includes('harvest')) {
    const available = { ...v.bank }, picks: Resource[] = [];
    for (const r of [...desired, ...desired]) if (available[r] > 0 && picks.length < 2) { available[r]--; picks.push(r); }
    if (picks.length === 2) return { type: 'PLAY_CARD', kind: 'harvest', resources: picks };
  }
  if (personalCards.includes('monopoly') && v.players.reduce((n, p) => n + (p.id === me.id ? 0 : p.resourceCount), 0) > 6) return { type: 'PLAY_CARD', kind: 'monopoly', resources: [desired[0]] };
  if (personalCards.includes('roads') && Object.values(v.roads).filter(p => p === me.id).length < 15) {
    // A legal free-road position may exist even when paid-road hints are empty.
    const connected = Object.values(v.board.edges).some(e => !v.roads[e.id] && e.vertices.some(id => v.buildings[id] ? v.buildings[id].owner === me.id : v.board.vertices[id].edges.some(x => v.roads[x] === me.id)));
    if (connected) return { type: 'PLAY_CARD', kind: 'roads' };
  }
  const ownSettlements = Object.values(v.buildings).filter(b => b.owner === me.id && b.kind === 'settlement').length;
  // Limit speculative roads to avoid exhausting pieces in unproductive branches.
  if (v.legal.roads.length && ownSettlements < 5 && (me.personality === 'expansionist' || hand.wood > 1 || hand.brick > 1 || !v.legal.canBuyCard)) return { type: 'BUILD_ROAD', edge: bestRoad() };
  if (v.legal.canBuyCard) return { type: 'BUY_CARD' };
  const goals: Hand[] = ownSettlements ? [COST.city, COST.settlement, COST.card, COST.road] : [COST.settlement, COST.card, COST.road];
  if (me.personality === 'expansionist') goals.reverse();
  const deficit = (cost: Hand) => RESOURCES.reduce((n, r) => n + Math.max(0, cost[r] - hand[r]), 0);
  const goal = [...goals].sort((a, b) => deficit(a) - deficit(b))[0];
  for (const want of RESOURCES.filter(r => hand[r] < goal[r] && v.bank[r] > 0)) {
    const give = [...RESOURCES].sort((a, b) => hand[b] - hand[a]).find(r => r !== want && hand[r] - goal[r] >= v.legal.bankRatios[r]);
    if (give) return { type: 'BANK_TRADE', give, want };
  }
  const lastTurn = v.events.reduce((last, e, i) => e.type === 'turn' ? i : last, -1);
  const offered = v.events.slice(lastTurn < 0 ? 0 : lastTurn).some(e => e.type === 'offer' && e.players.includes(me.id));
  if (!offered && me.difficulty !== 'easy') {
    const want = RESOURCES.find(r => hand[r] < goal[r]); const give = [...RESOURCES].sort((a, b) => hand[b] - hand[a]).find(r => r !== want && hand[r] > Math.max(goal[r], 1));
    if (want && give) return { type: 'PROPOSE_TRADE', give: { ...emptyHand(), [give]: me.personality === 'trader' && hand[give] > 3 ? 2 : 1 }, want: { ...emptyHand(), [want]: 1 } };
  }
  // Convert abundant resources toward a scarce one even when the nearest goal has zero deficit.
  for (const want of desired) { const give = RESOURCES.find(r => r !== want && hand[r] >= v.legal.bankRatios[r] + Math.max(1, hand[want]) && v.bank[want] > 0); if (give) return { type: 'BANK_TRADE', give, want }; }
  return { type: 'END_TURN' };
}
