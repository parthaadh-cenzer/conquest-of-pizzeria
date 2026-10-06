# Supplied asset audit

Source files remain unchanged in `assets/`. `node scripts/prepare-models.mjs` and `node scripts/prepare-robber.mjs` generate the smaller runtime GLBs in `apps/client/public/models/`.

| Source | Useful content and source complexity | Runtime use |
| --- | --- | --- |
| `the_landscape_is_a_forest_in_the_mountains.glb` (10 MB) | 546 meshes, about 19k triangles, 14 images. Two paired small tree variants and a boulder were selected; the rest is a placed landscape. | Instanced WOOD trees, ORE/forest rocks; 0.49 MB selected GLB. Procedural trees retain visible wind motion. |
| `hexlands_set1.glb` (28 MB) | 13 separate terrain meshes, about 7.5k triangles, 40 images. Clay, Pasture, Gold and Stone were useful; source is Z-up in roughly 100-unit tiles. | Normalized BRICK, GRAIN and WOOL foundations; 0.99 MB selected GLB. Pasture uses a muted game material to match the island palette. |
| `sheep-test_non-commercial.glb` (15 MB) | Four skinned mesh chunks, about 85k triangles, one texture, one rig, `idle` and `jump` clips. | Quantized 5.9 MB model on WOOL tiles, with staggered grazing/walking and jump response to the robber. Procedural sheep fill out the herd. **Development/reference use only:** the filename says non-commercial; no separate license or attribution file was supplied. Commercial use requires independent permission verification. |
| `caravel_ship.glb` (27 MB) | 102 meshes, about 76k triangles, 20 images, `Sail` clip. Hull, deck, mast, sail and flag-related parts are useful. | Selected 3.56 MB caravel is the in-match merchant vessel; its clip is retained, with small procedural sails for readability. Small ocean roamers remain lightweight. |
| `arena.glb` (5.7 MB) | Five meshes, about 27k triangles, five images. Source is Z-up and about 736 units wide. | Normalized 3 MB floating dice arena beyond the island; camera visits it on an authoritative roll. |
| Four robber FBX files (25–27 MB each) | Each has the same Mixamo 70-bone rig, six skinned mesh parts and one compatible 54-track clip. Source height is about 180 units. | One 4.75 MB styled character with resting, rising, nervous and jump clips. The animation state changes on movement; the initial desert placement rests. |
| `experience_the_tranquility_of_the_seaside.glb` (110 MB) | Five chunks of one animated plane, about 500k triangles, four images; no separately reusable beach, rock or shore meshes. | Inspected as a shore/water reference. The project keeps its efficient animated ocean and generated beach/foam skirt; shipping this plane would duplicate the ocean and add excessive geometry. |

The background music served at runtime is a 20-minute stream-copied excerpt of the supplied 3-hour `bg music.mp3`, whose source and license are unknown. Source models and the full-length music stay outside the Git repository (see `.gitignore`); the runtime GLBs and the excerpt are committed. Authors and licenses are in `CREDITS.md`.

The source bundle contains no other license or attribution documents. Keep source files and provenance with any redistributed build. The sheep is explicitly flagged non-commercial and must not be treated as cleared for commercial release.
