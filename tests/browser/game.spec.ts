import { test, expect, type Browser, type Page, type BrowserContext } from '@playwright/test';
import express from 'express';
import { resolve } from 'node:path';
import { makeServer } from '../../apps/server/src/server';
import { projectView } from '../../packages/game-engine/src/view';
import { chooseAction } from '../../packages/ai/src/strategy';
import { applyAction } from '../../packages/game-engine/src/engine';
import { rollDice, randomIndex, shufflePortEdges } from '../../apps/server/src/random';
import type { Room } from '../../apps/server/src/rooms';
let server: ReturnType<typeof makeServer>, base: string;
test.beforeAll(async () => { server = makeServer(0); server.app.use(express.static(resolve('dist/client'))); await new Promise<void>(r => server.http.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`; });
test.afterAll(async () => server.close());
async function client(browser: Browser, name: string, url = base, flat: boolean | 'low' = true) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (flat === 'low') await context.addInitScript(() => localStorage.setItem('morrow-settings', JSON.stringify({ quality: 'low', reduced: 'off', muted: true })));
  if (flat === true) await context.addInitScript(() => localStorage.setItem('morrow-settings', JSON.stringify({ quality: 'flat', reduced: 'on', muted: true })));
  const page = await context.newPage(); await page.goto(url); await page.getByLabel('Your name', { exact: true }).fill(name);
  return { page, context };
}
async function create(page: Page) { await page.getByRole('button', { name: 'Make room for adventure' }).click(); await expect(page.getByRole('heading', { name: /island/ })).toBeVisible(); return new URL(page.url()).searchParams.get('join')!; }
async function join(page: Page) { await page.getByRole('button', { name: 'Join the table' }).click(); await expect(page.getByText('Waiting for the host')).toBeVisible(); }
function publish(room: Room) { for (const s of room.sessions) if (s.socketId) server.io.to(s.socketId).emit('state', server.manager.view(room, s.playerId)); }
async function setupHumans(pages: Page[], room: Room) {
  for (let i = 0; i < pages.length * 2; i++) {
    const page = pages[room.game!.active]; await page.getByRole('button', { name: /Build settlement at/ }).first().click();
    await page.getByRole('button', { name: /Build road at/ }).first().click();
    await expect.poll(() => room.game!.setupIndex).toBe(i + 1);
  }
}
test('three human browsers: setup, private hands, counteroffer confirmation, robber and reconnection', async ({ browser }) => {
  const one = await client(browser, 'Harbor'), code = await create(one.page);
  const two = await client(browser, 'River', `${base}/?join=${code}`), three = await client(browser, 'Grove', `${base}/?join=${code}`);
  await join(two.page); await join(three.page); const room = server.manager.getRoom(code);
  await expect(one.page.getByRole('switch', { name: 'Shifting Ports' })).toBeChecked();
  await expect(two.page.getByRole('switch', { name: 'Shifting Ports' })).toBeDisabled();
  await one.page.getByRole('switch', { name: 'Shifting Ports' }).uncheck();
  await expect(two.page.getByRole('switch', { name: 'Shifting Ports' })).not.toBeChecked();
  await one.page.getByRole('button', { name: 'Wake the island' }).click(); await setupHumans([one.page, two.page, three.page], room);
  expect(room.game!.settings.shiftingPorts).toBe(false);
  await expect(one.page.getByRole('button', { name: 'Roll dice', exact: false })).toBeEnabled();
  await one.page.getByRole('button', { name: 'Roll dice', exact: false }).click(); await expect.poll(() => room.game!.history.length).toBe(1);
  // Authoritative fixtures stay in this test process; no debug or forcing endpoint exists.
  room.game!.phase = 'main'; room.game!.active = 0; room.game!.discards = {};
  for (const p of room.game!.players) p.resources = { wood: 2, brick: 2, grain: 1, wool: 2, ore: 1 }; room.game!.revision++; publish(room);
  await one.page.getByRole('button', { name: '⇄ Trade', exact: true }).click();
  await one.page.getByRole('button', { name: 'More WOOL You give', exact: true }).click();
  await one.page.getByRole('button', { name: 'More ORE You want', exact: true }).click();
  await one.page.getByRole('button', { name: 'Put an offer on the table' }).click();
  await two.page.getByRole('button', { name: '⇄ Trade offer', exact: true }).click(); await two.page.getByRole('button', { name: 'Counter', exact: true }).click();
  await two.page.getByRole('button', { name: 'More BRICK You want', exact: true }).click(); await two.page.getByRole('button', { name: 'Send counteroffer' }).click();
  await one.page.getByRole('button', { name: /River.*counter/ }).click(); await one.page.getByRole('button', { name: 'Confirm exchange' }).click();
  await expect.poll(() => room.game!.trade).toBeNull(); expect(room.game!.players[0].resources.ore).toBe(2); expect(room.game!.players[1].resources.brick).toBe(3);
  await expect(one.page.locator('.trade-glow')).toHaveCount(2);
  await one.page.getByRole('button', { name: 'Close panel' }).click();
  room.game!.phase = 'robber'; room.game!.robberReturn = 'main'; room.game!.revision++; publish(room);
  const tile = Object.values(room.game!.board.hexes).find(h => h.id !== room.game!.robber && h.vertices.some(v => room.game!.buildings[v]?.owner === room.game!.players[1].id))!;
  await one.page.getByRole('button', { name: `Move Wanderer to ${tile.id}`, exact: true }).click();
  await one.page.locator('.victim-tray').getByRole('button', { name: 'River' }).click(); await expect.poll(() => room.game!.phase).toBe('main');
  const before = structuredClone(room.game!.players[0].resources); await one.context.setOffline(true); await expect(two.page.getByText('Reconnecting…')).toBeVisible(); await one.context.setOffline(false); await one.page.reload();
  await expect(one.page.locator('.player').filter({ hasText: 'Harbor' })).toBeVisible(); expect(room.profiles).toHaveLength(3); expect(room.game!.players[0].resources).toEqual(before);
  await one.page.getByRole('button', { name: 'Rules and help' }).click(); await expect(one.page.getByRole('heading', { name: 'Shifting Ports · OFF · Locked' })).toBeVisible(); await one.page.getByRole('button', { name: 'Close panel' }).click();
  await one.page.screenshot({ path: 'artifacts/three-player-match.png' });
  await Promise.all([one.context.close(), two.context.close(), three.context.close()]);
});
test('one human and two AI: 3D placement, roll, responsive landscape, portrait guard', async ({ browser }) => {
  const { page, context } = await client(browser, 'Aster', base, false); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); const code = await create(page);
  await page.getByRole('button', { name: 'Add companion' }).click(); await expect(page.getByText('Fern', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Add companion' }).click(); await expect(page.getByText('Otto', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Wake the island' }).click();
  for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: /Build settlement at/ }).first().click(); await page.getByRole('button', { name: /Build road at/ }).first().click(); }
  await expect(page.getByRole('button', { name: 'Roll dice', exact: false })).toBeEnabled(); await page.screenshot({ path: 'artifacts/desktop-3d.png' });
  await page.setViewportSize({ width: 844, height: 390 }); await page.screenshot({ path: 'artifacts/phone-landscape.png' });
  expect(await page.locator('.rotate-screen').isVisible()).toBe(false); await expect(page.getByRole('button', { name: 'Roll dice', exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Roll dice', exact: false }).click(); await expect.poll(() => server.manager.getRoom(code).game!.history.length).toBe(1);
  await page.waitForTimeout(650); await page.screenshot({ path: 'artifacts/dice-arena-phone.png' });
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole('heading', { name: 'A wider world awaits.' })).toBeVisible(); await page.screenshot({ path: 'artifacts/phone-portrait.png' }); expect(errors).toEqual([]); await context.close();
});
test('four-, six- and eight-seat lobbies start and all AI complete setup', async ({ browser }) => {
  for (const [size, seats] of [['classic', 4], ['expanded', 6], ['grand', 8]] as const) {
    const { page, context } = await client(browser, `Host${seats}`); await page.getByLabel('Your gathering').selectOption(size); const code = await create(page), room = server.manager.getRoom(code);
    for (let i = 1; i < seats; i++) { await page.getByRole('button', { name: 'Add companion' }).click(); await expect.poll(() => room.profiles.length).toBe(i + 1); }
    await expect(page.locator('.seats .seat')).toHaveCount(seats); await page.getByRole('button', { name: 'Wake the island' }).click();
    // Fast setup traverses the same visible legal actions without waiting 700ms per companion.
    while (room.game!.phase.startsWith('setup')) { const p = room.game!.players[room.game!.active]; const action = chooseAction(projectView(room.game!, p.id))!; const result = applyAction(room.game!, p.id, action, { rollDice, randomIndex, shufflePortEdges }); if (!result.ok) throw new Error(result.error); room.game = result.state; }
    publish(room); await expect(page.getByRole('button', { name: 'Roll dice', exact: false })).toBeEnabled(); expect(Object.keys(room.game!.buildings)).toHaveLength(seats * 2); await context.close();
  }
});

for (const [size, seats] of [['classic', 4], ['expanded', 6], ['grand', 8]] as const) {
  test(`${seats}-seat world renders at normal, close, and far zoom`, async ({ browser }) => {
    test.setTimeout(180000);
    const { page, context } = await client(browser, `Vista${seats}`, base, false);
    await page.getByLabel('Your gathering').selectOption(size);
    const code = await create(page), room = server.manager.getRoom(code);
    for (let i = 1; i < seats; i++) {
      await page.getByRole('button', { name: 'Add companion' }).click();
      await expect.poll(() => room.profiles.length).toBe(i + 1);
    }
    await page.getByRole('button', { name: 'Wake the island' }).click();
    while (room.game!.phase.startsWith('setup')) {
      const player = room.game!.players[room.game!.active];
      const action = chooseAction(projectView(room.game!, player.id))!;
      const result = applyAction(room.game!, player.id, action, { rollDice, randomIndex, shufflePortEdges });
      if (!result.ok) throw new Error(result.error);
      room.game = result.state;
    }
    publish(room);
    await page.getByRole('button', { name: 'Skip arrival' }).click();
    await expect(page.getByRole('button', { name: 'Roll dice', exact: false })).toBeEnabled();
    await expect(page.locator('.game-board canvas')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `artifacts/${seats}-seat-normal.png` });
    const bounds = await page.locator('.game-board canvas').boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    for (let i = 0; i < 7; i++) await page.mouse.wheel(0, -100);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `artifacts/${seats}-seat-close.png` });
    for (let i = 0; i < 15; i++) await page.mouse.wheel(0, 100);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `artifacts/${seats}-seat-far.png` });
    await context.close();
  });
}

test('world arrival: cloud reveal, local skip, same board, completed arrival and direct reconnect', async ({ browser }) => {
  test.setTimeout(90000);
  const host = await client(browser, 'Mariner', base, 'low'), code = await create(host.page);
  const guest = await client(browser, 'Willow', `${base}/?join=${code}`, 'low'), third = await client(browser, 'Reed', `${base}/?join=${code}`);
  const errors: string[] = []; for (const p of [host.page, guest.page]) { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }
  await guest.page.setViewportSize({ width: 844, height: 390 }); await join(guest.page); await join(third.page);
  await host.page.getByRole('button', { name: 'Wake the island' }).click();
  await expect(host.page.locator('.app')).toHaveAttribute('data-world-stage', 'arriving');
  const room = server.manager.getRoom(code), originalBoard = JSON.stringify(room.game!.board), originalRevision = room.game!.revision;
  await expect(host.page.getByRole('button', { name: /Build settlement at/ })).toHaveCount(0);
  await host.page.waitForTimeout(700); await host.page.screenshot({ path: 'artifacts/arrival-clouds.png' });
  await host.page.waitForTimeout(2600); await host.page.screenshot({ path: 'artifacts/arrival-flips.png' });
  await guest.page.screenshot({ path: 'artifacts/arrival-phone.png' });
  await host.page.getByRole('button', { name: 'Skip arrival' }).click();
  await expect(host.page.locator('.app')).toHaveAttribute('data-world-stage', 'ready');
  await expect(host.page.getByRole('button', { name: /Build settlement at/ }).first()).toBeVisible();
  await expect(guest.page.locator('.app')).toHaveAttribute('data-world-stage', 'ready', { timeout: 13000 });
  expect(JSON.stringify(room.game!.board)).toBe(originalBoard); expect(room.game!.revision).toBe(originalRevision);
  const numbers = await host.page.locator('.number-token b').allTextContents(); expect((await guest.page.locator('.number-token b').allTextContents()).sort()).toEqual(numbers.sort());
  await host.page.screenshot({ path: 'artifacts/arrival-complete.png' });
  await host.page.reload(); await expect(host.page.locator('.app')).toHaveAttribute('data-world-stage', 'ready');
  await expect(host.page.getByRole('button', { name: /Build settlement at/ }).first()).toBeVisible(); await expect(host.page.getByRole('button', { name: 'Skip arrival' })).toHaveCount(0);
  expect(JSON.stringify(room.game!.board)).toBe(originalBoard);
  // Roll fixture executes only inside the trusted test server. Clients receive normal events.
  room.game!.phase = 'roll'; room.game!.turn = 1;
  const rolled = applyAction(room.game!, room.host, { type: 'ROLL_DICE' }, { rollDice: () => [3, 4], randomIndex, shufflePortEdges });
  if (!rolled.ok) throw new Error(rolled.error); room.game = rolled.state; publish(room);
  await expect(host.page.getByRole('button', { name: /Move Wanderer to/ }).first()).toBeVisible();
  await host.page.waitForTimeout(900); await host.page.screenshot({ path: 'artifacts/traders-return.png' });
  await host.page.getByRole('button', { name: /Move Wanderer to/ }).first().click();
  await expect.poll(() => room.game!.portRevision).toBe(1);
  expect(room.game!.board.ports.map(p => [p.resource, p.ratio])).toEqual(JSON.parse(originalBoard).ports.map((p: { resource: string; ratio: number }) => [p.resource, p.ratio]));
  await host.page.waitForTimeout(1100); await host.page.screenshot({ path: 'artifacts/ports-shifted.png' });
  await host.page.getByRole('button', { name: 'Settings', exact: true }).click(); await host.page.getByRole('combobox', { name: 'Graphics', exact: true }).selectOption('high'); await host.page.getByRole('button', { name: 'Close panel' }).click();
  await host.page.waitForTimeout(500); await host.page.screenshot({ path: 'artifacts/world-high.png' });
  const bounds = await host.page.locator('.game-board canvas').boundingBox(); await host.page.mouse.move(bounds!.x + bounds!.width * .5, bounds!.y + bounds!.height * .55); for (let i = 0; i < 9; i++) { await host.page.mouse.wheel(0, -100); await host.page.waitForTimeout(60); } await host.page.waitForTimeout(600); await host.page.screenshot({ path: 'artifacts/world-close.png' });
  await host.page.getByRole('button', { name: 'Reset view' }).click();
  await host.page.setViewportSize({ width: 1280, height: 800 }); await host.page.screenshot({ path: 'artifacts/world-laptop.png' });
  await host.page.setViewportSize({ width: 1024, height: 768 }); await host.page.screenshot({ path: 'artifacts/world-tablet.png' });
  expect(errors).toEqual([]);
  await Promise.all([host.context.close(), guest.context.close(), third.context.close()]);
});

test('background music uses the supplied file, waits for a gesture and survives lobby transitions', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('morrow-settings', JSON.stringify({ quality: 'flat', reduced: 'on', muted: false }));
    const tracks: HTMLAudioElement[] = []; Object.defineProperty(window, '__testTracks', { value: tracks });
    window.Audio = new Proxy(window.Audio, { construct(target, args) { const track = Reflect.construct(target, args) as HTMLAudioElement; tracks.push(track); return track; } });
  });
  const page = await context.newPage(); await page.goto(base);
  const audio = () => page.evaluate(() => { const tracks = (window as unknown as { __testTracks: HTMLAudioElement[] }).__testTracks; return tracks.map(a => ({ time: a.currentTime, volume: a.volume, muted: a.muted, paused: a.paused, loop: a.loop, src: a.src })); });
  await expect.poll(async () => (await audio()).length).toBe(1); expect((await audio())[0].paused).toBe(true);
  await page.getByLabel('Your name', { exact: true }).fill('Melody'); await create(page);
  await expect.poll(async () => (await audio())[0].time).toBeGreaterThan(0);
  const first = (await audio())[0]; expect(first.loop).toBe(true); expect(first.src).toContain('/audio/background.mp3'); expect(first.volume).toBeCloseTo(.15);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('slider', { name: 'music volume' }).press('Home'); await expect.poll(async () => (await audio())[0].volume).toBe(0);
  await page.getByRole('slider', { name: 'music volume' }).press('ArrowRight'); await expect.poll(async () => (await audio())[0].volume).toBeCloseTo(.03);
  await page.getByRole('button', { name: 'Mute audio', exact: true }).click(); await expect.poll(async () => (await audio())[0].muted).toBe(true);
  await page.getByRole('button', { name: 'Unmute audio', exact: true }).click(); await page.getByRole('button', { name: 'Close panel' }).click();
  await page.getByRole('button', { name: 'Add companion' }).click(); await page.getByRole('button', { name: 'Add companion' }).click(); await page.getByRole('button', { name: 'Wake the island' }).click();
  await expect(page.locator('.in-game')).toBeVisible(); const final = await audio(); expect(final).toHaveLength(1); expect(final[0].time).toBeGreaterThan(first.time); expect(final[0].paused).toBe(false);
  await context.close();
});
