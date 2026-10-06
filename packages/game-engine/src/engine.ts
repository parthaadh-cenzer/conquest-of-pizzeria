import { RESOURCES, countHand, type GameState, type Action, type Entropy, type Outcome } from './types';
import { event, setupOrder } from './state';
import { settlements, roads, cities } from './placement';
import { bankRatio, pay, COST, validHand, canAfford, transfer } from './economy';
import { produce, beginRobber, victims, steal } from './production';
import { propose, respond, confirm } from './trading';
import { playCard } from './development';
import { score, updateAwards } from './scoring';
import { finishPortShift } from './ports';
function requireRule(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
/** Transactional rules entrypoint. The input state is never mutated, even on failure. */
export function applyAction(input: GameState, actor: string, action: Action, entropy: Entropy): Outcome {
  const state = structuredClone(input);
  try {
    requireRule(state.phase !== 'over', 'The game has ended');
    const player = state.players.find(p => p.id === actor);
    requireRule(player, 'Unknown player');
    const active = state.players[state.active].id === actor;
    if (!['DISCARD', 'RESPOND_TRADE'].includes(action.type)) requireRule(active, 'Wait for your turn');
    const main = () => requireRule(state.phase === 'main', 'This action requires the main phase');
    switch (action.type) {
      case 'BUILD_SETTLEMENT': {
        requireRule(settlements(state, player).includes(action.vertex), 'That settlement is not legal');
        const setup = state.phase === 'setup-settlement';
        if (!setup) pay(state, player, COST.settlement);
        state.buildings[action.vertex] = { owner: actor, kind: 'settlement' };
        if (setup) {
          state.setupVertex = action.vertex; state.phase = 'setup-road';
          if (state.setupIndex >= state.players.length) for (const hid of state.board.vertices[action.vertex].hexes) {
            const r = state.board.hexes[hid].resource;
            if (r !== 'desert' && state.bank[r] > 0) { state.bank[r]--; player.resources[r]++; }
          }
        }
        event(state, 'build', `${player.name} founded a settlement.`, [actor]); break;
      }
      case 'BUILD_ROAD': {
        requireRule(roads(state, player).includes(action.edge), 'That road is not legal');
        if (state.phase === 'main') pay(state, player, COST.road);
        state.roads[action.edge] = actor;
        if (state.phase === 'setup-road') {
          state.setupIndex++; state.setupVertex = null;
          if (state.setupIndex === state.players.length * 2) { state.phase = 'roll'; state.active = 0; state.turn = 1; }
          else { state.active = setupOrder(state.players.length)[state.setupIndex]; state.phase = 'setup-settlement'; }
        } else if (state.phase === 'free-roads') {
          state.freeRoads--; if (!state.freeRoads || !roads(state, player).length) { state.freeRoads = 0; state.phase = state.robberReturn; }
        }
        event(state, 'build', `${player.name} laid a road.`, [actor]); break;
      }
      case 'BUILD_CITY': main(); requireRule(cities(state, player).includes(action.vertex), 'That upgrade is not legal'); pay(state, player, COST.city); state.buildings[action.vertex].kind = 'city'; event(state, 'build', `${player.name} raised a city.`, [actor]); break;
      case 'ROLL_DICE': {
        requireRule(state.phase === 'roll', 'Dice can only be rolled once at turn start');
        const dice = entropy.rollDice(); requireRule(dice.length === 2 && dice.every(d => Number.isInteger(d) && d >= 1 && d <= 6), 'Invalid dice result');
        state.dice = dice; state.history.push(dice); const sum = dice[0] + dice[1];
        event(state, 'roll', `${player.name} rolled ${dice[0]} + ${dice[1]} = ${sum}.`, [actor]);
        if (sum === 7) { state.robberReturn = 'main'; state.portShiftPending = state.settings.shiftingPorts; beginRobber(state, true); if (state.portShiftPending) event(state, 'traders-return', 'The traders turn toward the island.'); }
        else { produce(state, sum); state.phase = 'main'; }
        break;
      }
      case 'DISCARD': {
        requireRule(state.phase === 'discard' && state.discards[actor], 'You do not need to discard');
        requireRule(validHand(action.cards) && countHand(action.cards) === state.discards[actor], 'Discard exactly the required number');
        requireRule(canAfford(player.resources, action.cards), 'You do not have those cards');
        transfer(player.resources, state.bank, action.cards); delete state.discards[actor];
        if (!Object.keys(state.discards).length) state.phase = 'robber';
        event(state, 'discard', `${player.name} discarded cards.`, [actor]); break;
      }
      case 'MOVE_ROBBER': requireRule(state.phase === 'robber', 'The Wanderer cannot move now'); requireRule(state.board.hexes[action.hex] && action.hex !== state.robber, 'Choose a different tile'); state.robber = action.hex; state.phase = victims(state, actor).length ? 'victim' : state.robberReturn; event(state, 'robber', `${player.name} moved the Wanderer.`, [actor], [action.hex]); if (state.phase !== 'victim') finishPortShift(state, entropy); break;
      case 'STEAL': requireRule(state.phase === 'victim', 'There is no theft to resolve'); steal(state, actor, action.victim, entropy); finishPortShift(state, entropy); break;
      case 'BANK_TRADE': {
        main(); requireRule(RESOURCES.includes(action.give) && RESOURCES.includes(action.want) && action.give !== action.want, 'Choose two different resources');
        const ratio = bankRatio(state, actor, action.give);
        requireRule(player.resources[action.give] >= ratio && state.bank[action.want] > 0, 'Not enough cards for this bank trade');
        player.resources[action.give] -= ratio; state.bank[action.give] += ratio; state.bank[action.want]--; player.resources[action.want]++;
        event(state, 'bank', `${player.name} exchanged ${ratio}:1 with the bank.`, [actor]); break;
      }
      case 'PROPOSE_TRADE': main(); propose(state, player, action.give, action.want); break;
      case 'RESPOND_TRADE': main(); respond(state, player, action); break;
      case 'CONFIRM_TRADE': main(); confirm(state, player, action.tradeId, action.player); break;
      case 'CANCEL_TRADE': main(); requireRule(state.trade?.owner === actor, 'No active offer'); state.trade = null; break;
      case 'BUY_CARD': {
        main(); requireRule(state.deck.length, 'The deck is empty'); pay(state, player, COST.card);
        player.cards.push({ id: `card-${state.revision}`, kind: state.deck.shift()!, boughtTurn: state.turn });
        event(state, 'card', `${player.name} acquired a discovery card.`, [actor]); break;
      }
      case 'PLAY_CARD': playCard(state, player, action); break;
      case 'END_TURN': main(); state.trade = null; state.active = (state.active + 1) % state.players.length; state.turn++; state.players[state.active].playedCard = false; state.phase = 'roll'; event(state, 'turn', `${state.players[state.active].name}'s turn.`, [state.players[state.active].id]); break;
      default: throw new Error('Unknown action');
    }
    const oldRoad = state.longestRoad, oldGuard = state.largestGuard;
    updateAwards(state);
    if (oldRoad !== state.longestRoad) event(state, 'award', 'The Longest Trail award changed.', state.longestRoad ? [state.longestRoad] : []);
    if (oldGuard !== state.largestGuard) event(state, 'award', 'The Island Watch award changed.', state.largestGuard ? [state.largestGuard] : []);
    const current = state.players[state.active];
    if (!state.phase.startsWith('setup') && score(state, current.id, true) >= state.target) {
      state.winner = current.id; state.phase = 'over'; state.trade = null; event(state, 'victory', `${current.name} has won Conquest of Pizzeria!`, [current.id]);
    }
    state.revision++;
    return { ok: true, state };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Invalid action' }; }
}
