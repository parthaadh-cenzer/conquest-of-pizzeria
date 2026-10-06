import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { networkInterfaces } from 'node:os';
import { z } from 'zod';
import { RoomManager, type Room } from './rooms';
import { profileSchema, type ClientEvents, type ServerEvents, type Reply } from '../../../packages/protocol/src/index';
// Comma-separated browser origins allowed besides the host's own page, e.g. https://play.games.staige.world.
const parseOrigins = (value = '') => value.split(',').map(o => o.trim().replace(/\/+$/, '')).filter(Boolean);
// ADVERTISE_LAN=false hides the host's network addresses, e.g. on a cloud host where they are internal.
export function makeServer(port: number, allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS), advertiseLan = process.env.ADVERTISE_LAN !== 'false') {
  const app = express(), http = createServer(app);
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
  const addresses = [...new Set(Object.values(networkInterfaces()).flatMap(items => (items ?? []).filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address)))];
  const urls = advertiseLan ? addresses.map(ip => `http://${ip}:${port}`) : [];
  const manager = new RoomManager(urls.length ? urls : [`http://localhost:${port}`]);
  const io = new Server<ClientEvents, ServerEvents>(http, { maxHttpBufferSize: 150000, cors: allowedOrigins.length ? { origin: allowedOrigins } : undefined, allowRequest: (req, done) => {
    const origin = req.headers.origin;
    try { done(null, !origin || new URL(origin).host === req.headers.host || allowedOrigins.includes(origin)); } catch { done(null, false); }
  } });
  const broadcast = (room: Room) => { for (const session of room.sessions) if (session.socketId) io.to(session.socketId).emit('state', manager.view(room, session.playerId)); };
  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Conquest of Pizzeria', protocol: 1 }));
  app.get('/api/host', (_req, res) => res.json({ urls: manager.urls }));
  io.on('connection', socket => {
    let window = Date.now(), messages = 0;
    const safe = (ack: (r: Reply) => void, fn: () => { room: Room; reply: Reply }) => {
      if (typeof ack !== 'function') return;
      if (Date.now() - window > 1000) { window = Date.now(); messages = 0; }
      if (++messages > 20) { ack({ ok: false, error: 'Please slow down.' }); return; }
      try { const { room, reply } = fn(); ack(reply); broadcast(room); }
      catch (e) { ack({ ok: false, error: e instanceof z.ZodError ? 'Invalid request format' : e instanceof Error ? e.message : 'Request failed' }); }
    };
    socket.on('create', (input, ack) => safe(ack, () => {
      const data = z.strictObject({ version: z.literal(1), profile: profileSchema, name: z.string().max(40), size: z.enum(['classic', 'expanded', 'grand']) }).parse(input);
      return manager.create(socket.id, data.profile, data.name, data.size);
    }));
    socket.on('join', (input, ack) => safe(ack, () => { const data = z.strictObject({ version: z.literal(1), code: z.string().min(5).max(5), profile: profileSchema }).parse(input); return manager.join(data.code, socket.id, data.profile); }));
    socket.on('resume', (input, ack) => safe(ack, () => {
      const data = z.strictObject({ version: z.literal(1), code: z.string().length(5), token: z.string().min(40).max(64) }).parse(input);
      const result = manager.resume(data.code, data.token, socket.id);
      if (result.replaced && result.replaced !== socket.id) { io.to(result.replaced).emit('replaced'); io.sockets.sockets.get(result.replaced)?.disconnect(); }
      return result;
    }));
    socket.on('lobby', (input, ack) => safe(ack, () => manager.lobby(socket.id, input)));
    socket.on('intent', (input, ack) => safe(ack, () => manager.intent(socket.id, input)));
    socket.on('disconnect', () => { const room = manager.disconnect(socket.id); if (room) broadcast(room); });
  });
  const timer = setInterval(() => { for (const room of manager.rooms.values()) {
    // Keep disconnected games in memory for one day, never reclaim a connected match.
    if (Date.now() - room.changed > 86400000 && !room.sessions.some(s => s.socketId)) { manager.rooms.delete(room.code); continue; }
    if (room.sessions.some(s => s.socketId) && manager.tick(room)) broadcast(room);
  } }, 700);
  timer.unref();
  return { app, http, io, manager, urls, close: async () => { clearInterval(timer); await new Promise<void>(resolve => io.close(() => resolve())); } };
}
