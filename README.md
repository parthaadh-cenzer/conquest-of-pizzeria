# Conquest of Pizzeria

A playable LAN strategy game: a little living island for 3–8 friends and AI companions. Built with TypeScript, React, Vite, Three.js, React Three Fiber, Node and Socket.IO. No accounts, paid services or runtime AI API. The world combines original procedural rendering with the supplied local 3D assets.

## Run an island

Requires Node.js **22.18+** and npm. From this folder:

```sh
npm install
npm run dev
```

Open **http://localhost:3210**. Create an island, add friends or AI companions, and choose **Wake the island**. One human plus two AI is supported immediately.

The terminal and lobby show the host's LAN URL, such as `http://192.168.1.191:3210`. Friends must be on the same network. They scan the lobby QR or open that exact URL. If the host has multiple network interfaces, select the address reachable by your friends. Your firewall must permit inbound TCP **3210** for the Node host on your private network; guest Wi-Fi/client isolation can prevent peers connecting. No router port forwarding is needed.

Keep the host process running. Phone gameplay uses landscape; portrait displays a rotation screen. The top-right full-screen button is optional and falls back to normal browser layout if unavailable.

For the built client:

```sh
npm run build
npm start
```

Use the `PORT` environment variable to change the port. On PowerShell, set `$env:PORT = '3211'` before starting. Stop the host with Ctrl+C.

## STAIGE Production Build

Conquest of Pizzeria is a **browser client plus a Node.js game server** (Socket.IO). The server holds the authoritative rules, dice, AI seats and hidden hands, so every match, including one human against AI, needs it. STAIGE hosts the static client. The server must run separately.

| Setting | Value |
| --- | --- |
| Node.js | 22.18+ (npm 10) |
| Clean install | `npm ci --ignore-scripts` |
| Build | `npm run build` (= `tsc --noEmit && vite build`) |
| Output directory | `dist/client` |
| Entry | `dist/client/index.html` |
| Build-time secrets | None |
| Service worker / Web Workers / WASM | None |
| External backend | Required: the URL of a hosted game server (below) |

The client is subpath-safe (Vite `base: './'`). Every model, the music file and every JS/CSS chunk resolve relative to `index.html`, so it works from `https://play.games.staige.world/<job-or-version>/`. The game uses only query-string routing (`?join=CODE`), never path routes.

### Hosting the game server (External Backend URL)

1. Deploy this repository to any Node 22 host that supports WebSockets over HTTPS (for example Render, Railway or Fly.io), with:
   - install: `npm ci` (keep devDependencies: `npm start` runs the TypeScript server through `tsx`)
   - start: `npm start` (this also serves the client at `/` as a fallback)
   - environment: `PORT` (usually set by the host) and `ALLOWED_ORIGINS=https://games.staige.world,https://play.games.staige.world`
2. Check `https://<your-server>/api/health` returns `{"ok":true,...}`.
3. Set `VITE_GAME_SERVER_URL=https://<your-server>` (production: `https://conquest-of-pizzeria-server.onrender.com`, defined in `render.yaml`) in [`.env.production`](.env.production), commit, and push. The STAIGE build bakes it into the client.
4. Enter the same `https://<your-server>` as STAIGE's **External Backend URL**.

`ALLOWED_ORIGINS` is a comma-separated allow-list. Without it, the server accepts only clients served from its own origin, which is the LAN behavior. Rooms are in memory: a server restart ends matches in progress. Use a host that keeps a single instance running, with no scale-to-zero and no multiple replicas.

With `VITE_GAME_SERVER_URL` empty, the STAIGE-hosted client renders its welcome screen but shows "Cannot reach the host".

## Playing

Place a settlement and adjoining road, then repeat in reverse player order. Only legal sites are selectable. The second settlement grants initial resources. Roll, trade, build, buy/play discoveries, and end your turn. The in-game **?** panel explains costs, ports, the Wanderer, hidden victory points, and awards.

Resources: **WOOD, BRICK, GRAIN, WOOL, ORE**. Original discovery names: **Island Guard, Charter, Trailblazers, Bountiful Harvest, Market Claim**. Familiar core trading/building mechanics, with original geometry, character avatars, interface and synthesized sound, plus the supplied background music.

Player trades use offer → accept/counter/pass → active-player confirmation. The bank/port tab is separate. A trade commits both sides atomically. The two trading avatars glow. Exact opponent hands and discovery identities are never delivered to your browser.

Four heuristic AI levels and six personalities operate entirely offline through the same rules entrypoint and filtered information as human seats. Difficulty affects decision heuristics; it cannot alter dice. `Expert` is the strongest current heuristic tier, not a claim of tournament-level strength.

## Shifting Ports and music

**Shifting Ports defaults ON.** The host can switch it off under Game rules in the lobby. All guests see the choice. It is copied into authoritative game settings and locked when the match begins.

With the rule on, a rolled 7 first follows the normal discard, Wanderer move and eligible theft sequence. Only after the last required step does the server shuffle the existing port assignments among the existing legal coastal docks. Every port type, ratio and count is preserved. Bank trade rates use the new assignments immediately. Playing a Guard does not move ports.

With the rule off, every port stays fixed for the entire match. Cosmetic ships still travel, pause and dock. Reconnect restores the current setting and port assignments, including a robber sequence in progress.

The supplied music starts after a click or keypress and loops across lobby, arrival and gameplay. Settings includes Master, Music, Effects, Ambient and Mute. Volume choices stay in this browser. The serving copy, `apps/client/public/audio/background.mp3`, is the first 20 minutes of the supplied 3-hour track (stream-copied, not re-encoded, to stay under GitHub's 100 MB file limit) and is loaded only after interaction.

[World and port-rule implementation notes](docs/WORLD_UPDATE.md) include architecture and QA evidence. [Asset audit](docs/ASSET_AUDIT.md) records the selected models, extraction and licensing limits. [CREDITS.md](CREDITS.md) lists authors and licenses.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run simulate -- 5 8
```

Browser tests use installed **Google Chrome** through Playwright. Change `channel` in `playwright.config.ts` to `msedge` if using Edge. The browser suite serves the built client from an ephemeral test server, so run `npm run build` first. Test fixtures can set state only inside the test process; there are no forcing/debug network endpoints.

- Rules, graph, dice isolation, conservation, hidden-state filtering, scoring, atomic trades, card timing and road topology tests.
- Real socket clients verify per-seat state, session recovery, idempotency and stale-command rejection.
- Browser scenarios cover three humans, one human plus two AI, 4/6/8 seats, setup, real rolls, trade counters, robber victims, offline/reload recovery, and phone landscape/portrait.
- Simulation runs full secure-random games headlessly and records turn/step counts, winner and elapsed time under `artifacts/simulations/`.
- Browser screenshots and failure traces go to `artifacts/` and `test-results/`.

## Architecture

```text
apps/client/src/        React composition, 3D board, interface, audio
apps/server/src/        LAN host, sessions, room management, isolated crypto RNG
packages/game-engine/  Headless transactional rules and filtered projections
packages/board-generator/  Shared graph generation and balance tables
packages/protocol/     Typed messages and strict runtime validation
packages/ai/           Strategies accepting only a private/public seat view
tests/                 Unit, socket integration and browser scenarios
scripts/               Headless simulation runner
docs/                  Decisions, balance assumptions and verification notes
```

[Architecture decisions](docs/ARCHITECTURE.md) explain the state machine, authority boundary, geometry and networking. Dice are two independent zero-argument calls to OS-backed unbiased `crypto.randomInt`; the source is isolated from AI and game state. [Node's crypto reference](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback) documents the unbiased integer API.

## Current release boundary

This is a **playable local alpha**, with the complete core match loop and a 3D presentation combining original procedural work with the supplied models. Classic is 19 tiles; Expanded 30; Grand 37. **Grand is a custom extension**, with all large-board balance assumptions still needing human playtesting. No between-turn special building phase.

- Rooms, hands and photos are in memory. Refresh restores the seat using a per-room token saved in the same browser. Host shutdown loses the match; disk save/resume is not implemented. Clearing browser storage loses its identity. A second tab taking the same seat replaces the old connection.
- Photo uploads use normal file selection, adjustable square crop and a compressed 160-pixel avatar. No camera permission or account is required.
- Graphics include layered forests, weathered mountain ridges, animated grazing sheep, dense wind-driven grain, animated ocean and coastal foam, soft contact grounding, physical harbors, satellite islands, roaming boats, and merchant ships following water-only routes. An 8.4-second cloud descent and staggered tile reveal introduces each new match; Skip settles the same world immediately, and reconnects return directly to play. Dice roll on a separate arena during a camera visit and illustrate the server result; they are not a physics-based outcome. Further lighting and environmental polish remain possible.
- Auto graphics uses local hardware/viewport hints. Real-device frame-rate profiling and adaptive frame-time quality selection have not been completed. A flat-board fallback is available in settings.
- The automated browser suite uses desktop Chrome with phone viewport sizes. A physical phone-to-host Wi-Fi session still needs verification on your network.
- Intended for trusted LAN play. Internet hosting/TLS, persistent identity, remote account security, and host migration are outside this release.

Visual assets and effects combine procedural geometry, shaders and SVG with the user's supplied models. Background music is a 20-minute excerpt of the supplied `bg music.mp3` (source unknown; see [CREDITS.md](CREDITS.md)). The supplied sheep file explicitly says non-commercial; the included runtime copy is for development/reference use until commercial rights are independently verified. The seaside source remains out of the runtime because it is a large animated plane rather than reusable shore pieces.
