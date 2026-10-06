import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents, RoomView, Reply, ProfileInput, LobbyAction } from '../../../packages/protocol/src/index';
import type { Action, Size } from '../../../packages/game-engine/src/types';
import { gameServerUrl } from './paths';
type Session = { code: string; token: string };
export function useConnection() {
  const socket = useRef<Socket<ServerEvents, ClientEvents> | null>(null);
  const [view, setView] = useState<RoomView | null>(null), [online, setOnline] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const previousView = useRef<RoomView | null>(null);
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    const s: Socket<ServerEvents, ClientEvents> = (gameServerUrl ? io(gameServerUrl, { autoConnect: false }) : io({ autoConnect: false })); socket.current = s;
    s.on('state', next => {
      // Only a connected lobby-to-match transition plays the introduction.
      // A refresh/resume starts directly at the current authoritative position.
      if (next.game && previousView.current && !previousView.current.game) setIntro(true);
      previousView.current = next; setView(next);
    });
    s.on('connect', () => {
      setOnline(true); setError('');
      try {
        const join = new URLSearchParams(location.search).get('join');
        const saved = JSON.parse(localStorage.getItem(join ? `morrow-session-${join}` : 'morrow-session') ?? 'null') as Session | null;
        if (saved) s.emit('resume', { version: 1, ...saved }, reply => { if (!reply.ok) { setError(reply.error); localStorage.removeItem('morrow-session'); localStorage.removeItem(`morrow-session-${saved.code}`); } });
      } catch { localStorage.removeItem('morrow-session'); }
    });
    s.on('disconnect', () => { setOnline(false); pending.current = false; setBusy(false); });
    s.on('connect_error', () => setError('Cannot reach the host. Check Wi-Fi and keep the host running.'));
    s.on('replaced', () => { setError('This seat is open in another tab. Close that tab and refresh to return here.'); s.disconnect(); });
    s.connect(); return () => { s.disconnect(); };
  }, []);
  const send = (execute: (ack: (r: Reply) => void) => void) => {
    if (!online || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    const timeout = window.setTimeout(() => { pending.current = false; setBusy(false); setError('The host did not respond. Reconnecting to refresh the board.'); socket.current?.disconnect().connect(); }, 8000);
    execute(reply => { clearTimeout(timeout); pending.current = false; setBusy(false); if (!reply.ok) setError(reply.error);
      else if (reply.token && reply.code) { const saved = JSON.stringify({ code: reply.code, token: reply.token }); localStorage.setItem('morrow-session', saved); localStorage.setItem(`morrow-session-${reply.code}`, saved); history.replaceState(null, '', `${location.pathname}?join=${reply.code}`); }
    });
  };
  // randomUUID is not available on insecure LAN HTTP, so use getRandomValues directly.
  const requestId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
  return { view, online, busy, error, intro, finishIntro: () => setIntro(false), clearError: () => setError(''),
    create: (profile: ProfileInput, name: string, size: Size) => send(ack => socket.current!.emit('create', { version: 1, profile, name, size }, ack)),
    join: (profile: ProfileInput, code: string) => send(ack => socket.current!.emit('join', { version: 1, profile, code: code.toUpperCase() }, ack)),
    lobby: (action: LobbyAction) => send(ack => socket.current!.emit('lobby', { requestId: requestId(), revision: view!.lobby.revision, action }, ack)),
    act: (action: Action) => send(ack => socket.current!.emit('intent', { version: 1, requestId: requestId(), revision: view!.game!.revision, action }, ack)),
  };
}
export type Connection = ReturnType<typeof useConnection>;
