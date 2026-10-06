import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function model(name: string) {
  const path = resolve('apps/client/public/models', name);
  const bytes = readFileSync(path);
  expect(bytes.toString('utf8', 0, 4)).toBe('glTF');
  return { json: JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as { meshes?: unknown[]; skins?: unknown[]; animations?: { name: string }[] }, size: statSync(path).size };
}

describe('curated source assets', () => {
  it('keeps the terrain and arena geometry compact', () => {
    for (const name of ['forest-selected.glb', 'hexlands-selected.glb', 'dice-arena.glb']) {
      const { json, size } = model(name);
      expect(json.meshes?.length).toBeGreaterThan(0);
      expect(size).toBeLessThan(4_000_000);
    }
  });
  it('retains sheep, sail, and robber animation clips after extraction', () => {
    expect(model('sheep-development-only.glb').json.animations?.map(a => a.name)).toEqual(['idle', 'jump']);
    expect(model('sheep-development-only.glb').json.skins?.length).toBeGreaterThan(0);
    expect(model('caravel-selected.glb').json.animations?.map(a => a.name)).toContain('Sail');
    expect(model('robber.glb').json.animations?.map(a => a.name)).toEqual(['rest', 'rise', 'nervous', 'jump']);
  });
});
