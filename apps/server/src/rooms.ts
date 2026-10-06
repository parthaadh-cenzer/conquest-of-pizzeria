import { randomBytes, randomUUID, createHash, randomInt } from 'node:crypto';
import { z } from 'zod';
import { CONFIG } from '../../../packages/board-generator/src/config';
import { createGame } from '../../../packages/game-engine/src/state';
import { applyAction } from '../../../packages/game-engine/src/engine';
import { projectView } from '../../../packages/game-engine/src/view';
import { chooseAction } from '../../../packages/ai/src/strategy';
import { intentSchema, lobbyActionSchema, profileSchema, type Reply, type RoomView, type ProfileInput } from '../../../packages/protocol/src/index';
import type { GameState, Profile, Size, GameSettings } from '../../../packages/game-engine/src/types';
import { rollDice, randomIndex, secureShuffle, shufflePortEdges } from './random';
export const COLORS = ['#d97c57', '#69a5a0', '#d1aa52', '#9c83bc', '#77a968', '#cb819f', '#718dbb', '#bdaf90'];
interface Session { hash: string; playerId: string; socketId: string; requests: Map<string, Reply> }
export interface Room { code: string; name: string; host: string; size: Size; target: number; settings: GameSettings; profiles: Profile[]; revision: number; game: GameState | null; sessions: Session[]; changed: number; aiWaitTrade: string | null; aiWaitUntil: number }
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const lobbyEnvelope = z.strictObject({ requestId: z.string().min(8).max(80), revision: z.number().int().nonnegative(), action: lobbyActionSchema });
export class RoomManager {
  rooms = new Map<string, Room>();
  constructor(readonly urls: string[] = []) {}
  create(socketId: string, profile: ProfileInput, name: string, size: Size) {
    if (this.findSocket(socketId)) throw new Error('This connection already has a seat');
    profileSchema.parse(profile);
    if (!(size in CONFIG)) throw new Error('Unknown island size');
    if (this.rooms.size >= 40) throw new Error('Host has reached the room limit');
    let code: string; do { code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join(''); } while (this.rooms.has(code));
    const p = this.profile(profile, 0), room: Room = { code, name: name.trim().slice(0, 40) || 'An evening in Conquest of Pizzeria', host: p.id, size, target: 10, settings: { shiftingPorts: true }, profiles: [p], revision: 0, game: null, sessions: [], changed: Date.now(), aiWaitTrade: null, aiWaitUntil: 0 };
    this.rooms.set(code, room); return this.addSession(room, p.id, socketId);
  }
  join(code: string, socketId: string, profile: ProfileInput) {
    if (this.findSocket(socketId)) throw new Error('This connection already has a seat');
    const room = this.getRoom(code); profileSchema.parse(profile);
    if (room.game) throw new Error('This match has started. Reconnect using your original browser.');
    if (room.profiles.length >= CONFIG[room.size].max) throw new Error('This island is full');
    const p = this.profile(profile, room.profiles.length);
    if (room.profiles.some(x => x.color === p.color)) p.color = COLORS.find(c => !room.profiles.some(x => x.color === c))!;
    room.profiles.push(p); room.revision++; return this.addSession(room, p.id, socketId);
  }
  resume(code: string, token: string, socketId: string) {
    const room = this.getRoom(code), session = room.sessions.find(s => s.hash === hashToken(token));
    if (!session) throw new Error('This session is no longer available');
    const existing = this.findSocket(socketId);
    if (existing && existing.session !== session) throw new Error('This connection already has another seat');
    const replaced = session.socketId; session.socketId = socketId;
    room.profiles.find(p => p.id === session.playerId)!.connected = true;
    if (room.game) { room.game.players.find(p => p.id === session.playerId)!.connected = true; room.game.revision++; }
    room.revision++; room.changed = Date.now();
    return { room, replaced, reply: { ok: true, code: room.code, playerId: session.playerId } as Reply };
  }
  disconnect(socketId: string) {
    const found = this.findSocket(socketId); if (!found) return;
    const { room, session } = found; session.socketId = '';
    room.profiles.find(p => p.id === session.playerId)!.connected = false;
    if (room.game) { room.game.players.find(p => p.id === session.playerId)!.connected = false; room.game.revision++; }
    room.revision++; room.changed = Date.now(); return room;
  }
  lobby(socketId: string, raw: unknown): { room: Room; reply: Reply } {
    const { room, session } = this.requireSocket(socketId), msg = lobbyEnvelope.parse(raw);
    const cached = session.requests.get(msg.requestId); if (cached) return { room, reply: cached };
    let reply: Reply;
    try {
      if (session.playerId !== room.host) throw new Error('Only the host can manage the lobby');
      if (room.game) throw new Error('The match has already started');
      if (msg.revision !== room.revision) throw new Error('The lobby changed. Please try again.');
      const a = msg.action;
      if (a.type === 'SET_RULES') room.settings = { shiftingPorts: a.shiftingPorts };
      if (a.type === 'CONFIGURE') {
        if (room.profiles.length > CONFIG[a.size].max) throw new Error('Remove extra seats before shrinking the island');
        room.name = a.name; room.size = a.size; room.target = a.target;
      }
      if (a.type === 'ADD_AI') {
        if (room.profiles.length >= CONFIG[room.size].max) throw new Error('This island is full');
        const names = ['Fern', 'Otto', 'Clover', 'Moss', 'Pip', 'Juniper', 'Sol', 'Wren'];
        const index = names.findIndex(n => !room.profiles.some(p => p.name === n));
        const color = COLORS.find(c => !room.profiles.some(p => p.color === c))!;
        room.profiles.push({ ...this.profile({ name: names[index], avatar: `avatar:${index}`, color }, room.profiles.length), ai: true, difficulty: a.difficulty, personality: a.personality });
      }
      if (a.type === 'REMOVE_SEAT') {
        if (a.player === room.host) throw new Error('The host seat cannot be removed');
        const seat = room.profiles.find(p => p.id === a.player);
        if (!seat) throw new Error('Seat no longer exists');
        if (!seat.ai && seat.connected) throw new Error('Only AI or disconnected seats can be removed');
        room.profiles = room.profiles.filter(p => p.id !== a.player); room.sessions = room.sessions.filter(s => s.playerId !== a.player);
      }
      if (a.type === 'START') {
        if (room.profiles.some(p => !p.ai && !p.connected)) throw new Error('Wait for disconnected players or remove their seats');
        room.game = createGame(room.profiles, room.size, secureShuffle, room.target, room.settings);
      }
      room.revision++; room.changed = Date.now(); reply = { ok: true };
    } catch (e) { reply = { ok: false, error: e instanceof Error ? e.message : 'Lobby action failed' }; }
    this.cache(session, msg.requestId, reply); return { room, reply };
  }
  intent(socketId: string, raw: unknown): { room: Room; reply: Reply } {
    const { room, session } = this.requireSocket(socketId), msg = intentSchema.parse(raw);
    const cached = session.requests.get(msg.requestId); if (cached) return { room, reply: cached };
    let reply: Reply;
    if (!room.game) reply = { ok: false, error: 'The match has not started' };
    else if (msg.revision !== room.game.revision) reply = { ok: false, error: 'The board changed. Please try again.' };
    else {
      const result = applyAction(room.game, session.playerId, msg.action, { rollDice, randomIndex, shufflePortEdges });
      if (!result.ok) reply = result;
      else { room.game = result.state; room.changed = Date.now(); reply = { ok: true }; }
    }
    this.cache(session, msg.requestId, reply); return { room, reply };
  }
  tick(room: Room, now = Date.now()): boolean {
    const game = room.game; if (!game || game.phase === 'over') return false;
    // Resolve pending AI discards/responses through exactly the same engine entrypoint.
    const candidates = game.players.filter(p => p.ai && (game.discards[p.id] || (game.trade && game.trade.owner !== p.id && !game.trade.responses.some(r => r.player === p.id))));
    if (game.players[game.active].ai && !candidates.some(p => p.id === game.players[game.active].id)) candidates.push(game.players[game.active]);
    for (const player of candidates) {
      if (game.trade?.owner === player.id && game.players.some(p => !p.ai && p.connected && !game.trade!.responses.some(r => r.player === p.id))) {
        if (room.aiWaitTrade !== game.trade.id) { room.aiWaitTrade = game.trade.id; room.aiWaitUntil = now + 8000; }
        if (now < room.aiWaitUntil) continue;
      }
      const action = chooseAction(projectView(game, player.id)); if (!action) continue;
      const outcome = applyAction(game, player.id, action, { rollDice, randomIndex, shufflePortEdges });
      if (!outcome.ok) { console.error('AI rejected', action.type, outcome.error); return false; }
      room.game = outcome.state; room.changed = now; return true;
    }
    return false;
  }
  view(room: Room, playerId: string): RoomView {
    return { lobby: { code: room.code, name: room.name, host: room.host, size: room.size, target: room.target, settings: { ...room.settings }, players: structuredClone(room.profiles), revision: room.revision, urls: this.urls.map(url => `${url}/?join=${room.code}`) }, game: room.game ? projectView(room.game, playerId) : null, self: playerId };
  }
  getRoom(code: string) { const room = this.rooms.get(code.toUpperCase()); if (!room) throw new Error('Island not found. Check the code and host.'); return room; }
  findSocket(socketId: string) { for (const room of this.rooms.values()) { const session = room.sessions.find(s => s.socketId === socketId && socketId); if (session) return { room, session }; } return null; }
  private requireSocket(socketId: string) { const found = this.findSocket(socketId); if (!found) throw new Error('Join an island first'); return found; }
  private profile(input: ProfileInput, seat: number): Profile { return { id: randomUUID(), name: input.name, avatar: input.avatar || `avatar:${seat % 8}`, color: input.color, ai: false, difficulty: 'normal', personality: 'balanced', connected: true }; }
  private addSession(room: Room, playerId: string, socketId: string) { const token = randomBytes(32).toString('base64url'); room.sessions.push({ hash: hashToken(token), playerId, socketId, requests: new Map() }); return { room, reply: { ok: true, token, code: room.code, playerId } as Reply }; }
  private cache(session: Session, key: string, reply: Reply) { session.requests.set(key, reply); if (session.requests.size > 256) session.requests.delete(session.requests.keys().next().value!); }
}
