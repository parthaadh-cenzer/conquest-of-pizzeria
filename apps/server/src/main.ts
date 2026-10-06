import { resolve } from 'node:path';
import express from 'express';
import { makeServer } from './server';
const port = Number(process.env.PORT ?? 3210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535');
const { app, http, urls, close } = makeServer(port);
if (process.argv.includes('--production')) {
  const root = resolve('dist/client'); app.use(express.static(root)); app.use((_req, res) => res.sendFile(resolve(root, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true, hmr: { server: http } }, appType: 'spa' }); app.use(vite.middlewares);
}
http.listen(port, '0.0.0.0', () => console.log(`\nConquest of Pizzeria is ready\n  Local: http://localhost:${port}\n${urls.map(u => `  LAN:   ${u}`).join('\n')}\nKeep this host running while friends play.\n`));
// Hosts such as Render send SIGTERM before replacing the instance; close sockets, then exit.
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
  setTimeout(() => process.exit(0), 5000).unref();
  void close().then(() => http.close(() => process.exit(0)));
});
