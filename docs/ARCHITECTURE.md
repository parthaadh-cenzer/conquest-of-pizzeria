# Conquest of Pizzeria — engineering decisions

Original miniature-island identity; all geometry, UI, characters and synthesized sounds are created in this repository. No external game artwork or accounts.

## A–J: implementation contract

1. **Architecture:** TypeScript throughout. A headless engine applies validated commands to cloned state, returning either a whole new revision or an error. Node/Socket.IO is authoritative. React/Vite and Three.js render projections. One host process serves both browser and socket connections, without cloud infrastructure.
2. **Folders:** `packages/{game-engine,board-generator,protocol,ai}/src`, `apps/{server,client}/src`, `tests`, `scripts`, `docs`.
3. **Authority:** inventories, deck, bought-card timestamps, bank, buildings, roads, turn/phase, discard debts, trades, dice history and achievement holders reside on the server. Sessions live separately from game state.
4. **Client view:** explicit public-field allowlist plus the requesting seat's resources, cards, actual score and legal positions. No state spreads across the privacy boundary. AI receives exactly this projection.
5. **State machine:** lobby → setup settlement → setup road (snake order) → roll → main or discard → robber move → victim → main → next roll; game over is terminal. A played guard returns to its previous roll/main phase. Free-road cards use a dedicated phase.
6. **Messages:** Zod-validated versioned envelopes; session-bound actor, unique request ID and expected revision. Responses acknowledge errors. Per-session request cache prevents double execution; stale revisions require a fresh intent. Trade confirmation swaps on one synchronous engine transition.
7. **RNG:** production-only `node:crypto.randomInt(1,7)` called independently twice with zero parameters to the dice function. No strategy/state/history parameter, seeds, correction, weighting or forced-roll network API. Fisher–Yates uses unbiased crypto integers. Deterministic fixtures inject results in tests, never via production clients.
8. **Board:** axial hex centers; quantized shared corner coordinates produce stable vertex IDs, canonical edges, adjacent hex/edge lists and ordered coastal ports. Rules refer only to graph IDs. Renderer coordinates have no rule authority.
9. **Tests:** graph invariants; timing, costs, conservation, privacy, dice isolation, road topology, setup snake order; full-turn/AI simulations; socket identity and browser flows. Failed intents must leave their input unchanged.
10. **Milestones:** foundation and tests → full core rules → authoritative LAN rooms → playable client → negotiation → heuristic AI → living 3D board → landscape layouts → expanded/grand validation → sound, accessibility and verification.

## Balance assumptions

Classic uses 19 hexes (4 wood/grain/wool, 3 brick/ore, 1 desert), 9 ports, 19 of each bank card and a 25-card deck. Expanded uses 30 hexes, 11 ports, 24 of each resource and 34 cards. Grand is explicitly a custom extension with 37 hexes, 13 ports, 30 of each resource and 43 cards. All use sequential turns, 15 roads, 5 settlements, 4 cities per player, threshold 7 and default 10 victory points. No special between-turn building. Tables are tunable; expanded/grand are experimental until human playtesting.

Production shortages: if the bank cannot fulfill all claims for one resource, nobody receives that resource that roll. Hidden charter points count for their owner, but are only revealed to everyone at game end. Achievement ties retain the existing holder when tied at the maximum; otherwise the award is vacant until uniquely won. Victory is checked for the active player only, including at turn start.

In-memory rooms survive reconnects, not host shutdown. LAN HTTP supports image file selection and fullscreen when the browser permits; it does not depend on camera APIs or a screen-orientation lock. Session secrets travel over the trusted local network; Internet exposure requires TLS and additional operational hardening.
