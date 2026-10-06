# Verification record

Validated on Windows, Node 22.18 and Chrome on September 10, 2026.

- Strict TypeScript check and production Vite build passed.
- **64 unit, socket, rules, world, AI and simulation tests passed.** Full classic, expanded and grand games retain resource conservation and legal actions.
- **5 Playwright scenarios passed** in the final full run (about 1.7 minutes). They cover three human contexts; a human with two AI; 4/6/8-seat lobbies; private hands; trading; rolled dice; robber interaction; reconnects; Shifting Ports selection and lock; enabled port changes; full/skip arrival; and continuous background music with working volume/mute controls.
- The Shifting Ports OFF browser test verifies the choice reaches guests, remains locked in the game rules summary, and survives reconnect. Unit tests verify that OFF never calls port entropy and leaves normal discard/move/theft behavior intact. ON preserves the exact port type/ratio multiset and waits for all required robber actions.
- World tests validate 100 generated boards per size, red-number spacing, harbor frames, fixed satellite counts, and analytically checked water routes before and after port reassignment. Recessed coves in the expanded layout were corrected to reach safe water.
- Rendered and inspected desktop 1440×900, laptop 1280×800, tablet 1024×768, phone landscape 844×390, portrait 390×844, High graphics and closer zoom. The cloud entrance was reframed after visual inspection. Arrival and seven-event captures are in artifacts/.
- The supplied MP3 and serving copy have identical SHA-256. The audio browser test verifies gesture gating, one playing element, loop, volume, mute and uninterrupted progress across lobby/game transitions.
- User-facing branding was checked for remaining Morrow Isle strings in apps/ and packages/; none remain. Internal storage keys remain compatible.
- Three.js retains the 704 KB / 181 KB gzip vendor chunk advisory. The build succeeds.

See [world and rule notes](WORLD_UPDATE.md) for implementation details. Physical-phone frame-rate profiling and actual phone-to-host Wi-Fi testing remain unverified; Chrome viewport checks do not substitute for physical devices. Host sessions remain in memory, as in the existing architecture.
