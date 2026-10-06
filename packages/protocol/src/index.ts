import { z } from 'zod';
import type { GameView, Profile, Size, Action, GameSettings } from '../../game-engine/src/types';
export const PROTOCOL_VERSION = 1;
const resource = z.enum(['wood', 'brick', 'grain', 'wool', 'ore']);
const quantity = z.number().int().min(0).max(1000);
const hand = z.strictObject({ wood: quantity, brick: quantity, grain: quantity, wool: quantity, ore: quantity });
const id = z.string().min(1).max(160);
export const actionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ROLL_DICE') }), z.strictObject({ type: z.literal('END_TURN') }), z.strictObject({ type: z.literal('BUY_CARD') }), z.strictObject({ type: z.literal('CANCEL_TRADE') }),
  z.strictObject({ type: z.literal('BUILD_ROAD'), edge: id }), z.strictObject({ type: z.literal('BUILD_SETTLEMENT'), vertex: id }), z.strictObject({ type: z.literal('BUILD_CITY'), vertex: id }),
  z.strictObject({ type: z.literal('DISCARD'), cards: hand }), z.strictObject({ type: z.literal('MOVE_ROBBER'), hex: id }), z.strictObject({ type: z.literal('STEAL'), victim: id }),
  z.strictObject({ type: z.literal('BANK_TRADE'), give: resource, want: resource }),
  z.strictObject({ type: z.literal('PROPOSE_TRADE'), give: hand, want: hand }),
  z.strictObject({ type: z.literal('RESPOND_TRADE'), tradeId: id, response: z.enum(['accept', 'counter', 'pass']), give: hand, want: hand }),
  z.strictObject({ type: z.literal('CONFIRM_TRADE'), tradeId: id, player: id }),
  z.strictObject({ type: z.literal('PLAY_CARD'), kind: z.enum(['guard', 'roads', 'harvest', 'monopoly']), resources: z.array(resource).max(2).optional() }),
]);
export const intentSchema = z.strictObject({ version: z.literal(1), requestId: z.string().min(8).max(80), revision: z.number().int().nonnegative(), action: actionSchema });
export const profileSchema = z.strictObject({ name: z.string().trim().min(1).max(24), avatar: z.string().max(100000).regex(/^(|avatar:[0-7]|data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+)$/), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
export const difficultySchema = z.enum(['easy', 'normal', 'hard', 'expert']);
export const personalitySchema = z.enum(['balanced', 'trader', 'builder', 'expansionist', 'aggressive', 'chaotic']);
export const lobbyActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ADD_AI'), difficulty: difficultySchema, personality: personalitySchema }),
  z.strictObject({ type: z.literal('REMOVE_SEAT'), player: id }),
  z.strictObject({ type: z.literal('CONFIGURE'), size: z.enum(['classic', 'expanded', 'grand']), target: z.number().int().min(8).max(15), name: z.string().trim().min(1).max(40) }),
  z.strictObject({ type: z.literal('SET_RULES'), shiftingPorts: z.boolean() }),
  z.strictObject({ type: z.literal('START') }),
]);
export interface LobbyView { code: string; name: string; host: string; size: Size; target: number; settings: GameSettings; players: Profile[]; revision: number; urls: string[] }
export interface RoomView { lobby: LobbyView; game: GameView | null; self: string }
export type Reply = { ok: true; token?: string; code?: string; playerId?: string } | { ok: false; error: string };
export type ProfileInput = z.infer<typeof profileSchema>;
export type LobbyAction = z.infer<typeof lobbyActionSchema>;
export interface ClientEvents {
  create: (input: { version: 1; profile: ProfileInput; name: string; size: Size }, ack: (r: Reply) => void) => void;
  join: (input: { version: 1; code: string; profile: ProfileInput }, ack: (r: Reply) => void) => void;
  resume: (input: { version: 1; code: string; token: string }, ack: (r: Reply) => void) => void;
  lobby: (input: { requestId: string; revision: number; action: LobbyAction }, ack: (r: Reply) => void) => void;
  intent: (input: { version: 1; requestId: string; revision: number; action: Action }, ack: (r: Reply) => void) => void;
}
export interface ServerEvents { state: (view: RoomView) => void; replaced: () => void }
