import type { Resource } from '../../../../packages/game-engine/src/types';
export const LABELS: Record<Resource, string> = { wood: 'WOOD', brick: 'BRICK', grain: 'GRAIN', wool: 'WOOL', ore: 'ORE' };
export const RESOURCE_COLORS: Record<Resource | 'desert', string> = { wood: '#537e5b', brick: '#bd7960', grain: '#d2b459', wool: '#94ae6d', ore: '#929cad', desert: '#c9b38e' };
export function ResourceIcon({ resource, size = 24 }: { resource: Resource; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {resource === 'wood' && <><path d="M16 3 7 16h5l-6 8h20l-6-8h5Z" fill="currentColor" opacity=".25"/><path d="M16 3 7 16h5l-6 8h20l-6-8h5ZM16 24v5"/></>}
    {resource === 'brick' && <><path d="m4 17 12-6 12 6-12 6Z" fill="currentColor" opacity=".25"/><path d="m4 17 12-6 12 6-12 6Zm0 0v7l12 6 12-6v-7M16 23v7M4 9l12-6 12 6-12 6Z"/></>}
    {resource === 'grain' && <><path d="M16 29V4M16 12c-7 0-9-4-9-7 6 0 9 3 9 7Zm0 7c-7 0-9-4-9-7 6 0 9 3 9 7Zm0-7c7 0 9-4 9-7-6 0-9 3-9 7Zm0 7c7 0 9-4 9-7-6 0-9 3-9 7Zm0 7c-6 0-8-3-8-6 5 0 8 3 8 6Zm0 0c6 0 8-3 8-6-5 0-8 3-8 6Z"/></>}
    {resource === 'wool' && <><path d="M8 22c-6-2-5-9 0-10 0-7 10-8 12-2 8-2 12 8 6 12-3 5-8 4-10 2-4 3-8 2-8-2Z" fill="currentColor" opacity=".25"/><path d="M8 22c-6-2-5-9 0-10 0-7 10-8 12-2 8-2 12 8 6 12-3 5-8 4-10 2-4 3-8 2-8-2Z"/></>}
    {resource === 'ore' && <><path d="m3 24 6-14 8-5 8 8 4 13-17 2Z" fill="currentColor" opacity=".25"/><path d="m3 24 6-14 8-5 8 8 4 13-17 2Zm6-14 9 5-6 13m6-13 7-2M17 5l1 10"/></>}
  </g></svg>;
}
export function Mark() { return <svg width="33" height="38" viewBox="0 0 40 44" fill="none" aria-hidden="true"><path d="m20 2 17 10v20L20 42 3 32V12Z" stroke="currentColor" strokeWidth="1.4"/><path d="m8 29 8-14 5 9 5-7 7 12M8 33h25" stroke="currentColor" strokeWidth="1.4"/><circle cx="26" cy="11" r="2.5" fill="currentColor"/></svg>; }
