import { describe, it, expect } from 'vitest';
import { generateBoard, type Shuffle } from '../packages/board-generator/src/board';
import { NUMBER_COUNTS, CONFIG } from '../packages/board-generator/src/config';
import { boatRoute, coastalFrame, coastLoop, inHex, outsideToken, propPosition, revealSchedule, INTRO_DURATION } from '../apps/client/src/board/world/math';
import { maritimeNavigation, mainMooring, outerMooring } from '../apps/client/src/board/world/navigation';

function seeded(seed: number): Shuffle {
  return items => { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const j = seed % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
}
describe('living island geometry and presentation invariants', () => {
  for (const size of ['classic', 'expanded', 'grand'] as const) {
    it(`${size}: one fixed satellite per port with safe curved routes before and after swaps`, () => {
      const board = generateBoard(size, seeded(63)), nav = maritimeNavigation(board);
      expect(nav.sites).toHaveLength(board.ports.length);
      const sites = JSON.stringify(nav.sites);
      for (const ports of [board.ports, [...board.ports].reverse()]) for (let i = 0; i < ports.length; i++) {
        const route = nav.route(outerMooring(nav.sites[i]), mainMooring(board, ports[i]));
        for (let d = 0; d <= route.length; d += .05) expect(nav.water(route.sample(d)), `Ship ${i} at ${d}`).toBe(true);
        const redirected = nav.route(route.sample(route.length * .5), mainMooring(board, ports[(i + 2) % ports.length]));
        for (let d = 0; d <= redirected.length; d += .1) expect(nav.water(redirected.sample(d))).toBe(true);
      }
      expect(JSON.stringify(nav.sites)).toBe(sites);
    });
    it(`${size}: randomized worlds preserve counts, red spacing and unshared port vertices`, () => {
      const signatures = new Set<string>(), positions = new Set<string>();
      for (let seed = 1; seed <= 100; seed++) {
        const b = generateBoard(size, seeded(seed)), hexes = Object.values(b.hexes);
        for (const [n, count] of Object.entries(NUMBER_COUNTS[size])) expect(hexes.filter(h => h.number === +n)).toHaveLength(count);
        for (const [resource, count] of Object.entries(CONFIG[size].tiles)) expect(hexes.filter(h => h.resource === resource)).toHaveLength(count);
        expect(hexes.filter(h => h.number === null)).toHaveLength(CONFIG[size].deserts);
        for (const edge of Object.values(b.edges).filter(e => e.hexes.length === 2)) expect(edge.hexes.every(id => [6, 8].includes(b.hexes[id].number!))).toBe(false);
        expect(new Set(b.ports.flatMap(p => b.edges[p.edge].vertices)).size).toBe(b.ports.length * 2);
        signatures.add(JSON.stringify(hexes.map(h => [h.resource, h.number]))); positions.add(b.ports.map(p => p.edge).join(','));
      }
      expect(signatures.size).toBeGreaterThan(90); expect(positions.size).toBeGreaterThan(10);
    });
    it(`${size}: every harbor points into water and attaches exactly to its coastal pair`, () => {
      const b = generateBoard(size, seeded(107));
      for (const port of b.ports) {
        const f = coastalFrame(b, port.edge), edge = b.edges[port.edge], h = b.hexes[edge.hexes[0]], [a, c] = edge.vertices.map(id => b.vertices[id]);
        expect(f.x).toBeCloseTo((a.x + c.x) / 2); expect(f.z).toBeCloseTo((a.y + c.y) / 2);
        expect(f.nx * (f.x - h.x) + f.nz * (f.z - h.y)).toBeGreaterThan(.85);
        expect(f.nx * f.tx + f.nz * f.tz).toBeCloseTo(0);
        expect(Math.sin(f.rotation)).toBeCloseTo(f.nx); expect(Math.cos(f.rotation)).toBeCloseTo(f.nz);
        for (const v of [a, c]) expect(Math.abs((v.x - f.x) * f.tx + (v.y - f.z) * f.tz)).toBeCloseTo(.5, 3);
      }
      const loop = coastLoop(b); expect(loop).toHaveLength(Object.values(b.edges).filter(e => e.hexes.length === 1).length);
    });
    it(`${size}: all roaming routes keep the whole boat clear of land and docks`, () => {
      const b = generateBoard(size, seeded(81));
      for (let boat = 0; boat < 5; boat++) for (let t = 0; t < 800; t += 4) {
        const p = boatRoute(b, boat, t), next = boatRoute(b, boat, t + .01);
        // Half hull length .55; maximum dock projection .95, with independent route margin.
        expect(Math.hypot(p.x, p.z) - .55).toBeGreaterThan(p.extent + .89);
        expect(Math.sin(p.rotation) * (next.x - p.x) + Math.cos(p.rotation) * (next.z - p.z)).toBeGreaterThan(0);
      }
    });
  }
  it('vegetation anchors and sheep clearings stay within the playable hex', () => {
    for (let seed = 0; seed < 37; seed++) for (let i = 0; i < 200; i++) { const p = propPosition(seed, i, .27); expect(inHex(p.x, p.z, .26)).toBe(true); expect(outsideToken(p.x, p.z)).toBe(true); }
  });
  it('cosmetic reveal order varies, completes before arrival ends and leaves board data untouched', () => {
    const b = generateBoard('grand', seeded(7)), before = JSON.stringify(b), ids = Object.keys(b.hexes), a = revealSchedule(ids, 17), c = revealSchedule(ids, 33);
    expect(a).not.toEqual(c); expect(a).toEqual(revealSchedule(ids, 17)); expect(Object.keys(a).sort()).toEqual([...ids].sort());
    expect(Math.max(...Object.values(a)) + 1.4).toBeLessThan(INTRO_DURATION); expect(JSON.stringify(b)).toBe(before);
  });
});
