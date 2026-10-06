import { randomInt } from 'node:crypto';
/** Unbiased, independent OS-backed dice. Deliberately no state/strategy arguments. */
export function rollDice(): [number, number] { return [randomInt(1, 7), randomInt(1, 7)]; }
export function randomIndex(length: number): number { return randomInt(0, length); }
/** Separate entropy boundary for merchant assignments. No dice or cosmetic state. */
export function shufflePortEdges(edges: readonly string[]): string[] {
  const result = [...edges];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function secureShuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
