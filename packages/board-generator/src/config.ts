import type { Size, CardKind, Hand } from '../../game-engine/src/types';
export interface GameConfig { min: number; max: number; tiles: Hand; deserts: number; ports: number; bank: number; deck: Record<CardKind, number>; roads: number; settlements: number; cities: number }
export const CONFIG: Record<Size, GameConfig> = {
  classic: { min: 3, max: 4, tiles: { wood: 4, brick: 3, grain: 4, wool: 4, ore: 3 }, deserts: 1, ports: 9, bank: 19, deck: { guard: 14, charter: 5, roads: 2, harvest: 2, monopoly: 2 }, roads: 15, settlements: 5, cities: 4 },
  expanded: { min: 5, max: 6, tiles: { wood: 6, brick: 5, grain: 6, wool: 6, ore: 5 }, deserts: 2, ports: 11, bank: 24, deck: { guard: 20, charter: 6, roads: 3, harvest: 3, monopoly: 2 }, roads: 15, settlements: 5, cities: 4 },
  grand: { min: 7, max: 8, tiles: { wood: 7, brick: 7, grain: 7, wool: 7, ore: 7 }, deserts: 2, ports: 13, bank: 30, deck: { guard: 25, charter: 8, roads: 4, harvest: 3, monopoly: 3 }, roads: 15, settlements: 5, cities: 4 },
};
/** Symmetric probability weights for the larger islands; Grand's odd count uses one fewer 3. */
export const NUMBER_COUNTS: Record<Size, Record<number, number>> = {
  classic: { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 },
  expanded: { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 },
  grand: { 2: 2, 3: 3, 4: 4, 5: 4, 6: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 2 },
};
export const LAYOUT: Record<Size, { radius: number; trim: boolean }> = { classic: { radius: 2, trim: false }, expanded: { radius: 3, trim: true }, grand: { radius: 3, trim: false } };
