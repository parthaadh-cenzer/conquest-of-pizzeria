import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { makeServer } from '../apps/server/src/server';
import { RoomManager } from '../apps/server/src/rooms';
import type { ClientEvents, ServerEvents, Reply, RoomView } from '../packages/protocol/src/index';
import { actionSchema } from '../packages/protocol/src/index';
import { chooseAction } from '../packages/ai/src/strategy';
import { applyAction } from '../packages/game-engine/src/engine';
import { projectView } from '../packages/game-engine/src/view';
import { createGame } from '../packages/game-engine/src/state';
import { profiles, identity, entropy } from './helpers';
import { rollDice, randomIndex, shufflePortEdges, secureShuffle } from '../apps/server/src/random';
import { readFileSync } from 'node:fs';
const profile = (name: string) => ({ name, avatar: 'avatar:0', color: '#d97c57' });
describe('session authority', () => {
  it('restores the same private hand and seat with a scoped secret, invalidates old socket', () => {
    const manager = new RoomManager(), created = manager.create('one', profile('Host'), 'Table', 'classic');
    expect(created.reply.ok).toBe(true); if (!created.reply.ok) return;
    const { room } = created; manager.join(room.code, 'two', profile('Friend')); manager.join(room.code, 'three', profile('Friend 2'));
    manager.lobby('one', { requestId: 'start-0001', revision: room.revision, action: { type: 'START' } });
    room.game!.players[0].resources.ore = 7;
    manager.disconnect('one'); expect(room.game!.players[0].connected).toBe(false);
    const resumed = manager.resume(room.code, created.reply.token!, 'new-one'); expect(resumed.reply.ok).toBe(true);
    expect(room.profiles).toHaveLength(3); expect(manager.view(room, room.host).game!.self.resources.ore).toBe(7); expect(room.game!.players[0].connected).toBe(true);
    expect(manager.findSocket('one')).toBeNull(); expect(() => manager.resume(room.code, 'bad-secret', 'intruder')).toThrow();
    const other = manager.create('other', profile('Other'), 'Other table', 'classic'); expect(() => manager.resume(other.room.code, created.reply.ok ? created.reply.token! : '', 'intruder')).toThrow();
    expect(JSON.stringify(manager.view(room, room.host))).not.toContain(created.reply.token);
  });
  it('deduplicates commands and rejects stale revisions, invalid actor and untrusted dice', () => {
    const m = new RoomManager(), { room } = m.create('host', profile('Host'), 'Table', 'classic'); m.join(room.code, 'two', profile('Two')); m.join(room.code, 'three', profile('Three'));
    const denied = m.lobby('two', { requestId: 'forged-start', revision: room.revision, action: { type: 'START' } }); expect(denied.reply.ok).toBe(false);
    m.lobby('host', { requestId: 'real-start', revision: room.revision, action: { type: 'START' } });
    const msg = { version: 1, requestId: 'place-0001', revision: 0, action: { type: 'BUILD_SETTLEMENT', vertex: projectView(room.game!, room.host).legal.settlements[0] } };
    expect(m.intent('host', msg).reply.ok).toBe(true); expect(m.intent('host', msg).reply.ok).toBe(true); expect(Object.keys(room.game!.buildings)).toHaveLength(1);
    expect(m.intent('host', { ...msg, requestId: 'place-0002' }).reply.ok).toBe(false);
    expect(actionSchema.safeParse({ type: 'ROLL_DICE', dice: [6, 6] }).success).toBe(false);
    expect(actionSchema.safeParse({ type: 'FORCE_DICE', dice: [6, 6] }).success).toBe(false);
  });
  it('supports mixed 6- and 8-seat lobbies, rejects overflow and invalid shrink', () => {
    for (const [size, seats] of [['expanded', 6], ['grand', 8]] as const) {
      const m = new RoomManager(), { room } = m.create('host', profile('Host'), 'Table', size);
      for (let i = 1; i < seats; i++) expect(m.lobby('host', { requestId: `add-ai-000${i}`, revision: room.revision, action: { type: 'ADD_AI', difficulty: 'hard', personality: 'trader' } }).reply.ok).toBe(true);
      expect(m.lobby('host', { requestId: 'add-overflow', revision: room.revision, action: { type: 'ADD_AI', difficulty: 'hard', personality: 'trader' } }).reply.ok).toBe(false);
      expect(m.lobby('host', { requestId: 'shrink-0000', revision: room.revision, action: { type: 'CONFIGURE', size: 'classic', name: 'Tiny', target: 10 } }).reply.ok).toBe(false);
      expect(m.lobby('host', { requestId: 'start-game0', revision: room.revision, action: { type: 'START' } }).reply.ok).toBe(true);
    }
  });
});
describe('AI legal and private constraints', () => {
  it('has no random/server/state authority dependency', () => { const src = readFileSync('packages/ai/src/strategy.ts', 'utf8'); expect(src).not.toMatch(/Math\.random|node:crypto|server\/|GameState|rollDice\(/); });
  it('all four difficulties choose legal actions across setup and complete turns', () => {
    for (const difficulty of ['easy', 'normal', 'hard', 'expert'] as const) {
      let s = createGame(profiles(3).map(p => ({ ...p, ai: true, difficulty })), 'classic', identity);
      for (let i = 0; i < 150; i++) {
        const candidates = s.players.filter(p => s.discards[p.id] || (s.trade && s.trade.owner !== p.id && !s.trade.responses.some(r => r.player === p.id))); candidates.push(s.players[s.active]);
        const p = candidates.find(p => chooseAction(projectView(s, p.id)))!; expect(p).toBeTruthy();
        const action = chooseAction(projectView(s, p.id))!; const next = applyAction(s, p.id, action, entropy); expect(next.ok, JSON.stringify(action)).toBe(true); if (next.ok) s = next.state;
      }
      expect(s.turn).toBeGreaterThan(5);
    }
  });
});
describe('real socket clients', () => {
  let server: ReturnType<typeof makeServer> | undefined; const sockets: Socket<ServerEvents, ClientEvents>[] = [];
  afterEach(async () => { sockets.forEach(s => s.disconnect()); sockets.length = 0; await server?.close(); });
  it('three human clients share a board but receive individually filtered hands, reconnect without a duplicate', async () => {
    server = makeServer(0); await new Promise<void>(resolve => server!.http.listen(0, '127.0.0.1', resolve)); const port = (server.http.address() as { port: number }).port;
    const connect = async () => { const s: Socket<ServerEvents, ClientEvents> = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true }); sockets.push(s); await new Promise<void>(resolve => s.on('connect', resolve)); return s; };
    const one = await connect(), two = await connect(), three = await connect();
    const create = await new Promise<Reply>(resolve => one.emit('create', { version: 1, profile: profile('One'), name: 'Friends', size: 'classic' }, resolve)); expect(create.ok).toBe(true); if (!create.ok) return;
    const joins = await Promise.all([two, three].map((s, i) => new Promise<Reply>(resolve => s.emit('join', { version: 1, code: create.code!, profile: profile(`Player ${i + 2}`) }, resolve)))); expect(joins.every(r => r.ok)).toBe(true);
    const room = server.manager.getRoom(create.code!);
    const views = new Map<string, RoomView>(); for (const s of sockets) s.on('state', view => views.set(s.id!, view));
    const started = await new Promise<Reply>(resolve => one.emit('lobby', { requestId: 'start-unique', revision: room.revision, action: { type: 'START' } }, resolve)); expect(started.ok).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 30)); expect(views.size).toBe(3);
    for (const v of views.values()) { expect(v.game!.self.id).toBe(v.self); expect(v.game!.players[1]).not.toHaveProperty('resources'); expect(v.game!.players[1]).not.toHaveProperty('cards'); }
    one.disconnect(); await new Promise(resolve => setTimeout(resolve, 20)); const again = await connect();
    const resumed = await new Promise<Reply>(resolve => again.emit('resume', { version: 1, code: create.code!, token: create.token! }, resolve)); expect(resumed.ok).toBe(true); expect(room.profiles).toHaveLength(3); expect(room.game!.players[0].connected).toBe(true);
  });
});
describe('cross-origin hosting', () => {
  const connects = async (allowed: string[], origin: string) => {
    const server = makeServer(0, allowed); await new Promise<void>(r => server.http.listen(0, '127.0.0.1', r));
    const port = (server.http.address() as { port: number }).port;
    const client = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], extraHeaders: { origin }, reconnection: false });
    const ok = await new Promise<boolean>(r => { client.on('connect', () => r(true)); client.on('connect_error', () => r(false)); });
    client.close(); await server.close(); server.http.close(); return ok;
  };
  it('rejects foreign origins unless explicitly allowed', async () => {
    expect(await connects([], 'https://play.games.staige.world')).toBe(false);
    expect(await connects(['https://play.games.staige.world'], 'https://play.games.staige.world')).toBe(true);
    expect(await connects(['https://play.games.staige.world'], 'https://evil.example')).toBe(false);
  });
});
