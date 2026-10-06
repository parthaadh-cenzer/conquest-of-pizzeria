/** Runtime files resolve against Vite's base, so the client works from any hosting subpath. */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
/** Optional external game server (https://…). Empty means the server that serves this page. */
export const gameServerUrl = String(import.meta.env.VITE_GAME_SERVER_URL ?? '').trim();
