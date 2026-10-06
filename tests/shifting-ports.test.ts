import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../packages/game-engine/src/state';
import { applyAction } from '../packages/game-engine/src/engine';
import { projectView } from '../packages/game-engine/src/view';
import { emptyHand, countHand } from '../packages/game-engine/src/types';
import { actionSchema, lobbyActionSchema } from '../packages/protocol/src/index';
import { RoomManager } from '../apps/server/src/rooms';
import { command, entropy, identity, profiles } from './helpers';

function fixture(on: boolean, victim = false) {
  const s = createGame(profiles(), 'classic', identity, 10, { shiftingPorts: on }); s.phase = 'roll'; s.turn = 1;
  const target = Object.values(s.board.hexes).find(h => h.id !== s.robber)!;
  if (victim) { s.buildings[target.vertices[0]] = { owner: 'p1', kind: 'settlement' }; s.players[1].resources.wood = 1; s.bank.wood--; }
  return { s, target };
}
describe('Shifting Ports authoritative rule', () => {
  for (const on of [true, false]) {
    it(`${on ? 'ON reshuffles' : 'OFF keeps docks'} only after a 7 with no eligible theft`, () => {
      let { s, target } = fixture(on); const before = structuredClone(s.board), shuffle = vi.fn((edges: readonly string[]) => [...edges].reverse());
      const rng = { ...entropy, rollDice: () => [3, 4] as [number, number], shufflePortEdges: shuffle };
      s = command(s, { type: 'ROLL_DICE' }, 'p0', rng); expect(s.phase).toBe('robber'); expect(s.board).toEqual(before);
      expect(s.portShiftPending).toBe(on); s = command(s, { type: 'MOVE_ROBBER', hex: target.id }, 'p0', rng);
      expect(s.phase).toBe('main'); expect(s.robber).toBe(target.id); expect(s.portShiftPending).toBe(false);
      expect(shuffle).toHaveBeenCalledTimes(on ? 1 : 0); expect(s.portRevision).toBe(on ? 1 : 0);
      expect(s.board.hexes).toEqual(before.hexes); expect(s.board.ports.map(p => [p.resource, p.ratio])).toEqual(before.ports.map(p => [p.resource, p.ratio]));
      expect(s.board.ports.map(p => p.edge).sort()).toEqual(before.ports.map(p => p.edge).sort());
      if (on) expect(s.board.ports).not.toEqual(before.ports); else expect(s.board).toEqual(before);
      s = command(s, { type: 'END_TURN' }); expect(shuffle).toHaveBeenCalledTimes(on ? 1 : 0);
    });
    it(`${on ? 'ON waits for' : 'OFF preserves'} multi-player discards, legal move and exactly one stolen card`, () => {
      let { s, target } = fixture(on, true); s.players[0].resources.wood = 9; s.bank.wood -= 9; s.players[2].resources.ore = 8; s.bank.ore -= 8;
      const before = structuredClone(s.board.ports), shuffle = vi.fn((e: readonly string[]) => [...e].reverse()), rng = { ...entropy, rollDice: () => [1, 6] as [number, number], shufflePortEdges: shuffle };
      s = command(s, { type: 'ROLL_DICE' }, 'p0', rng); expect(s.phase).toBe('discard');
      expect(applyAction(s, 'p0', { type: 'MOVE_ROBBER', hex: target.id }, rng).ok).toBe(false);
      s = command(s, { type: 'DISCARD', cards: { ...emptyHand(), wood: 4 } }, 'p0', rng); expect(s.phase).toBe('discard');
      s = command(s, { type: 'DISCARD', cards: { ...emptyHand(), ore: 4 } }, 'p2', rng); expect(s.phase).toBe('robber');
      s = command(s, { type: 'MOVE_ROBBER', hex: target.id }, 'p0', rng); expect(s.phase).toBe('victim'); expect(s.board.ports).toEqual(before); expect(shuffle).not.toHaveBeenCalled();
      expect(applyAction(s, 'p0', { type: 'STEAL', victim: 'p2' }, rng).ok).toBe(false); expect(shuffle).not.toHaveBeenCalled();
      s = command(s, { type: 'STEAL', victim: 'p1' }, 'p0', rng); expect(s.phase).toBe('main'); expect(countHand(s.players[0].resources)).toBe(6); expect(countHand(s.players[1].resources)).toBe(0);
      expect(shuffle).toHaveBeenCalledTimes(on ? 1 : 0); if (!on) expect(s.board.ports).toEqual(before);
      expect(applyAction(s, 'p0', { type: 'STEAL', victim: 'p1' }, rng).ok).toBe(false); expect(shuffle).toHaveBeenCalledTimes(on ? 1 : 0);
    });
  }
  it('guards and ordinary rolls never invoke port entropy, including guards after an earlier seven', () => {
    let { s, target } = fixture(true); const shuffle = vi.fn((e: readonly string[]) => [...e]), rng = { ...entropy, shufflePortEdges: shuffle };
    s = command(s, { type: 'ROLL_DICE' }, 'p0', rng); expect(s.phase).toBe('main');
    s.dice = [3, 4]; s.history.push([3, 4]); s.players[0].cards.push({ id: 'guard', kind: 'guard', boughtTurn: 0 });
    s = command(s, { type: 'PLAY_CARD', kind: 'guard' }, 'p0', rng); s = command(s, { type: 'MOVE_ROBBER', hex: target.id }, 'p0', rng);
    expect(shuffle).not.toHaveBeenCalled(); expect(s.portRevision).toBe(0);
  });
  it('new port ownership updates bank ratios and malformed entropy cannot mutate state', () => {
    let { s, target } = fixture(true); const wood = s.board.ports.find(p => p.resource === 'wood')!;
    s.buildings[s.board.edges[wood.edge].vertices[0]] = { owner: 'p0', kind: 'settlement' }; expect(projectView(s, 'p0').legal.bankRatios.wood).toBe(2);
    s = command(s, { type: 'ROLL_DICE' }, 'p0', { ...entropy, rollDice: () => [3, 4] }); const snapshot = structuredClone(s);
    expect(applyAction(s, 'p0', { type: 'MOVE_ROBBER', hex: target.id }, { ...entropy, shufflePortEdges: edges => edges.map(() => edges[0]) }).ok).toBe(false); expect(s).toEqual(snapshot);
    s = command(s, { type: 'MOVE_ROBBER', hex: target.id }); expect(projectView(s, 'p0').legal.bankRatios.wood).not.toBe(2);
  });
  it('defaults ON, host only, strict boolean, synchronizes, survives reconnect and locks at start', () => {
    const m = new RoomManager(), profile = (name: string) => ({ name, avatar: 'avatar:0', color: '#d97c57' });
    const created = m.create('host', profile('Host'), 'Table', 'classic'), { room } = created;
    m.join(room.code, 'friend', profile('Friend')); m.join(room.code, 'third', profile('Third'));
    expect(room.settings.shiftingPorts).toBe(true);
    const set = (socket: string, id: string, shiftingPorts: boolean) => m.lobby(socket, { requestId: id, revision: room.revision, action: { type: 'SET_RULES', shiftingPorts } }).reply;
    expect(set('friend', 'deny-rules', false).ok).toBe(false); expect(set('host', 'host-rules', false).ok).toBe(true);
    for (const p of room.profiles) expect(m.view(room, p.id).lobby.settings.shiftingPorts).toBe(false);
    m.disconnect('host'); if (!created.reply.ok) throw new Error('create failed'); m.resume(room.code, created.reply.token!, 'host-again');
    expect(m.view(room, room.host).lobby.settings.shiftingPorts).toBe(false);
    expect(m.lobby('host-again', { requestId: 'start-game', revision: room.revision, action: { type: 'START' } }).reply.ok).toBe(true);
    expect(room.game!.settings.shiftingPorts).toBe(false); expect(set('host-again', 'locked-rule', true).ok).toBe(false);
    m.disconnect('host-again'); m.resume(room.code, created.reply.token!, 'host-final');
    for (const p of room.profiles) expect(m.view(room, p.id).game!.settings.shiftingPorts).toBe(false);
    expect(lobbyActionSchema.safeParse({ type: 'SET_RULES', shiftingPorts: 'false' }).success).toBe(false);
    expect(actionSchema.safeParse({ type: 'SET_RULES', shiftingPorts: false }).success).toBe(false);
  });
});
