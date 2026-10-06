import { useEffect, useRef } from 'react';
import type { GameEvent } from '../../../../packages/game-engine/src/types';
import { asset } from '../paths';
export interface AudioSettings { master: number; music: number; effects: number; ambient: number; muted: boolean }
/** Original synthesized cues. Audio starts only after a browser-authorized user gesture. */
export function useAudio(events: GameEvent[], settings: AudioSettings) {
  const context = useRef<AudioContext | null>(null), previous = useRef<number | null>(null), ambient = useRef<GainNode | null>(null);
  const music = useRef<HTMLAudioElement | null>(null), current = useRef(settings); current.current = settings;
  useEffect(() => {
    const track = new Audio(asset('audio/background.mp3')); track.loop = true; track.preload = 'none'; music.current = track;
    const unlock = () => {
      const settings = current.current;
      track.volume = settings.master * settings.music; track.muted = settings.muted;
      if (track.paused && !settings.muted) void track.play().catch(() => { /* Retry on the next browser-authorized gesture. */ });
      if (!context.current) { const ctx = new AudioContext(); context.current = ctx; const gain = ctx.createGain(); gain.gain.value = settings.muted ? 0 : settings.master * settings.ambient * .008; gain.connect(ctx.destination); ambient.current = gain;
        for (const hz of [110, 164.81, 220.2]) { const oscillator = ctx.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = hz; oscillator.connect(gain); oscillator.start(); }
      }
      if (context.current.state === 'suspended') void context.current.resume();
    };
    document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); track.pause(); track.removeAttribute('src'); track.load(); music.current = null; void context.current?.close(); context.current = null; };
  }, []);
  useEffect(() => { if (music.current) { music.current.volume = Math.max(0, Math.min(1, settings.master * settings.music)); music.current.muted = settings.muted; } }, [settings.master, settings.music, settings.muted]);
  useEffect(() => { if (ambient.current && context.current) ambient.current.gain.setTargetAtTime(settings.muted ? 0 : settings.master * settings.ambient * .008, context.current.currentTime, .4); }, [settings]);
  useEffect(() => {
    const last = events.at(-1); if (!last) return;
    if (previous.current === null) { previous.current = last.id; return; }
    const fresh = events.filter(e => e.id > previous.current!); previous.current = last.id;
    const ctx = context.current; if (!ctx || settings.muted) return;
    const selected = fresh.find(e => e.type === 'ports-shifted') ?? fresh.find(e => ['victory', 'trade', 'roll', 'robber', 'steal', 'build', 'production', 'card', 'turn'].includes(e.type)); if (!selected) return;
    const frequencies: Record<string, number[]> = { 'ports-shifted': [659, 988, 1318], roll: [140, 180, 125, 200], trade: [440, 554, 659], build: [230, 345], production: [660, 880], robber: [130, 110], steal: [150, 120], victory: [330, 440, 554, 660], card: [440, 660], turn: [392] };
    (frequencies[selected.type] ?? [440]).forEach((frequency, i) => {
      const time = ctx.currentTime + i * .075, o = ctx.createOscillator(), g = ctx.createGain(); o.type = selected.type === 'roll' ? 'triangle' : 'sine'; o.frequency.setValueAtTime(frequency, time); g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(settings.master * settings.effects * .075, time + .007); g.gain.exponentialRampToValueAtTime(.0001, time + .23); o.connect(g); g.connect(ctx.destination); o.start(time); o.stop(time + .25);
    });
  }, [events, settings]);
}
