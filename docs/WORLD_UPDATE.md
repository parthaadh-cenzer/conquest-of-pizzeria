# Conquest of Pizzeria — world and rules update

The existing React, LAN host, private seat views, trading, AI and dice architecture remain in place. The game is renamed in visible branding, page metadata, rules, victory messages and host status. Internal browser storage keys remain compatible with existing sessions.

## Shifting Ports

- `Room.settings.shiftingPorts` defaults to `true`. The strict `SET_RULES` lobby action accepts a boolean and passes the existing host, revision and match-start checks.
- `createGame` copies the setting into `GameState.settings`. It is explicitly projected into every `GameView`; there is no in-match action that changes it.
- A rolled 7 sets `portShiftPending` only when the setting is on. Discards and robber movement follow the existing rules. If there are eligible victims, the shift waits for the successful theft. With no eligible victim, movement itself completes the sequence.
- Completion shuffles the edge assignments of the existing port array through `shufflePortEdges`, a dedicated server crypto shuffle. It never creates types or changes ratios/counts, and its output is validated as a permutation of existing legal dock edges. Dock spacing and settlement relationships therefore remain valid.
- The transition increments `portRevision` and emits a trade-bell event. Updated port ratios are immediately authoritative. Cosmetic animation does not postpone the rules transaction.
- OFF does not invoke port entropy or emit merchant convergence/port-change events. Guard-card robber moves do not trigger shifts, even when the previous dice showed 7.
- Socket resumption returns the rule, current ports and any pending sequence from the room. Request deduplication and stale-revision rejection still apply. As before, rooms live in host memory; shutting down the host ends the match.

## World rendering

`apps/client/src/board/world/` contains the new terrain, vegetation, coast, ocean, atmosphere, miniatures and maritime systems.

Each biome has shared, vertex-painted meshes. Forests combine selected trees and boulders from the supplied forest with procedural crowns; grain and grass use instancing and a shared wind uniform. Wool fields use animated skinned sheep from the supplied GLB, with staggered idle/jump reactions when the Wanderer arrives. Selected supplied hexland geometry grounds brick, grain and wool tiles. Mountains use weathered ridges and strata. Clay has eroded formations and cracks. Desert dunes retain sparse plants and stones. Roads are wider stone paths with ownership trim; houses use neutral walls and colored roofs.

The main coastline is a continuous, irregular beach/rock skirt derived from the actual outer edge loop. The ocean uses a coast-distance texture, directional waves, shallow/deep color, small highlights and shoreline foam. Harbor orientation comes from each coastal edge midpoint, adjacent hex center and outward normal. A cross-shore landing identifies both served vertices; recessed expanded-board coves get longer landings to reach navigable water.

Every port has one fixed satellite island and one merchant ship using the supplied animated caravel hull. Island sites depend on the board geometry and port count, not current assignments. The stable merchant index retains its identity when its destination dock changes. Ships use a water navigation grid, analytic obstacle clearance, smoothed corners and curved direct passages; shores are inflated for hull clearance. Routes avoid the main island and satellite islands. Ships pause at moorings, converge during an enabled seven sequence, and resume routes after the exchange. Every route is cosmetic. Smaller boats roam open water independently.

The supplied dice arena sits beyond the island and receives a short camera visit for each authoritative roll. Dice remain visual representations of the server result. The Wanderer uses one optimized skinned export assembled from the four supplied FBX actions. The seaside asset was inspected but contains an animated sea plane rather than separate reusable coast pieces, so the runtime keeps its existing coast and ocean system. Curated GLBs and their source audit are documented in `ASSET_AUDIT.md`.

Medium/High use directional shadow maps; all modes retain inexpensive instanced soft grounding beneath larger objects. Low reduces vegetation, sheep, water detail and clouds while retaining the full island and all merchant connections. High adds vegetation density and larger shadows. Gameplay geometry and legal actions are identical across modes. Close gameplay views hide clouds; they return smoothly toward the far end of the zoom range.

## Arrival and music

An 8.4-second local timeline runs only on a connected lobby-to-match transition. The camera passes through procedural clouds, independently shuffled tiles flip, props rise, tokens appear after settlement, and ports/satellites reveal. Controls arrive when the camera settles. Skip finishes transforms and returns the normal camera without generating a new board. Refresh/resume does not restart the introduction. Reduced motion and Flat mode go directly to play.

The supplied music is served as `/audio/background.mp3`. One audio element lives above lobby/game transitions. Browser-authorized input starts playback; the track loops and uses Master × Music volume and Mute. UI changes and the introduction do not restart it. Muted sessions do not begin loading the track until unmuted interaction. The source and serving copy have matching SHA-256:

`7A3413C9B618A71FF6B5C6FA50389CF1D22E4AD43C2301251118DCED5B9B7E53`

The 111.7 MB original was not transcoded. The browser streams the static serving copy; initial page rendering does not preload it.

## Verification evidence

The unit/integration suite covers ON/OFF, multiplayer discards, no-victim completion, eligible/invalid theft, guard cards, malformed entropy, updated bank ratios, host-only selection, strict boolean validation, synchronized views, reconnects and locked rules. World tests cover 100 randomized boards at each size, exact counts, separated red numbers, legal harbor frames, fixed satellite counts and water clearance before/after route reassignment.

Playwright exercises three human clients, mixed human/AI setup, 4/6/8-seat lobbies, real rolls, private hands, trading, robber actions and reconnects. Dedicated cases cover lobby toggle synchronization, the locked OFF summary, full/skip arrival on separate clients, unchanged authoritative board during the intro, live seven/port-change events, and music playback/controls/continuity. Tests serve the built application from an ephemeral server; there are no state-forcing endpoints in the product.

Visual artifacts in `artifacts/` include arrival clouds/flips/completion, phone arrival, merchant convergence, port changes, desktop High, close zoom, laptop, tablet, phone landscape, dice arena, and normal/close/far views of 4/6/8-seat worlds. The reference guided depth, density, coast, grounding and readable harbors; the result remains an original realtime miniature world.

Physical-phone frame-rate profiling and phone-to-host Wi-Fi testing are not complete. Browser viewport checks do not establish real-device performance. Three.js still produces the existing large vendor-chunk build advisory.
