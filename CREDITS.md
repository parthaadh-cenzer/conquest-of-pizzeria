# Credits and asset provenance

Conquest of Pizzeria is published free of charge. This file records what is known about every third-party asset shipped in the runtime build (`apps/client/public/`). License information below is taken only from metadata embedded in the files themselves or from their source filenames. Nothing here has been independently confirmed with the authors.

## 3D models

| Runtime file | Title / author | Source | License (as embedded) | Status |
| --- | --- | --- | --- | --- |
| `models/caravel-selected.glb` | "Caravel Ship" by Ginny Sutton ([suttonj94](https://sketchfab.com/suttonj94)) | [Sketchfab](https://sketchfab.com/3d-models/caravel-ship-c9819a0e8a57429f888b74978219fb7a) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Attribution required (this file). Modified: parts selected and reduced. |
| `models/dice-arena.glb` | "Arena" by [filthycent](https://sketchfab.com/filthycent) | [Sketchfab](https://sketchfab.com/3d-models/arena-fcd68db308a349ec8cb42641376262c8) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Attribution required (this file). Modified: normalized and reduced. |
| `models/hexlands-selected.glb` | "Hexlands Set1" by [POLYTRICITY](https://sketchfab.com/PolytricityLtd) | [Sketchfab](https://sketchfab.com/3d-models/hexlands-set1-d27663ff776543cda26f66365816e51f) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Attribution required (this file). Modified: tiles selected, normalized, recolored. |
| `models/forest-selected.glb` | "The landscape is a forest in the mountains" by [dasy444](https://sketchfab.com/dasy444) | [Sketchfab](https://sketchfab.com/3d-models/the-landscape-is-a-forest-in-the-mountains-27b7e06431f244ef84e28bada7560c98) | Sketchfab Standard ([terms](https://sketchfab.com/licenses)) | ⚠ Review: a store/purchase license, not an open license. Confirm that the license was obtained and that embedding in a game served from a public website is permitted. |
| `models/sheep-development-only.glb` | "Sheep-Test (Non-Commercial)" by [Nyilonelycompany](https://sketchfab.com/Nyilonelycompany) | [Sketchfab](https://sketchfab.com/3d-models/sheep-test-non-commercial-196bb78e6e6343888d09f468a6a9dbc7) | [CC BY-NC 4.0](http://creativecommons.org/licenses/by-nc/4.0/) | ⚠ **Non-commercial only.** Acceptable only while the game is free with no ads, paid tiers or other commercial use. Must be replaced or licensed before any commercial release. |
| `models/robber.glb` | Character with four animation clips ("Laying Idle", "Getting Up", "Nervously Look Around", "Jumping Down"), combined in this project | Exported from [Mixamo](https://www.mixamo.com) (FBX metadata: "Mixamo, Inc." / mixamo.com) | No license embedded | ⚠ Review: Mixamo characters and animations are offered under Adobe's terms. Confirm the character is a Mixamo stock character (not a third-party upload) and that Adobe's terms cover this use. |

Not shipped: the source `experience_the_tranquility_of_the_seaside.glb` was inspected but is not used at runtime. All original source models stay outside the repository; see `docs/ASSET_AUDIT.md`.

## Music

| Runtime file | Source | License | Status |
| --- | --- | --- | --- |
| `audio/background.mp3` | First 20 minutes (stream copy, not re-encoded) of the supplied 3-hour `bg music.mp3` | **Unknown.** The file has no title, artist or license tags. | ⚠ **Blocker for public release until resolved:** identify the composer or source and confirm the right to redistribute. Otherwise replace it with a track under a known license. |

## Sound effects, fonts and other assets

- **Sound effects:** synthesized at runtime with the Web Audio API (original code). No sample files.
- **Fonts:** none bundled. The UI uses system font stacks (Inter if installed, otherwise system sans-serif; Georgia/Times serif).
- **Textures, terrain, ocean, vegetation, clouds, icons and avatars:** procedural geometry, shaders and inline SVG authored for this project. The only textures are those embedded in the models above.

## Software

Open-source npm dependencies (React, three.js, React Three Fiber, drei, Socket.IO, Express, zod, qrcode and others) keep their own licenses, listed in `package-lock.json` and each package's `LICENSE`.
