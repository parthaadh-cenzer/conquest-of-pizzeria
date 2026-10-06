import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Connection } from '../network';
import type { Difficulty, Personality, Size } from '../../../../packages/game-engine/src/types';
import { CONFIG } from '../../../../packages/board-generator/src/config';
import { Avatar } from './Avatar';
import { Mark } from './Icons';
import { gameServerUrl } from '../paths';
const COLORS = ['#d97c57', '#69a5a0', '#d1aa52', '#9c83bc', '#77a968', '#cb819f', '#718dbb', '#bdaf90'];
export function Arrival({ net }: { net: Connection }) {
  const initialCode = new URLSearchParams(location.search).get('join') ?? '';
  const [mode, setMode] = useState<'create' | 'join'>(initialCode ? 'join' : 'create'), [name, setName] = useState(''), [code, setCode] = useState(initialCode), [avatar, setAvatar] = useState('avatar:0'), [color, setColor] = useState(COLORS[0]), [size, setSize] = useState<Size>('classic');
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null), [zoom, setZoom] = useState(1), [offsetX, setOffsetX] = useState(0), [offsetY, setOffsetY] = useState(0), [photoError, setPhotoError] = useState('');
  useEffect(() => {
    if (!photo) return;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 160; const ctx = canvas.getContext('2d')!;
    const side = Math.min(photo.width, photo.height) / zoom;
    const x = (photo.width - side) / 2 * (1 + offsetX), y = (photo.height - side) / 2 * (1 + offsetY);
    ctx.drawImage(photo, x, y, side, side, 0, 0, 160, 160); setAvatar(canvas.toDataURL('image/jpeg', .75));
  }, [photo, zoom, offsetX, offsetY]);
  const upload = (file?: File) => {
    if (!file) return; setPhotoError(''); if (file.size > 20000000) { setPhotoError('Choose a photo smaller than 20 MB.'); return; }
    const url = URL.createObjectURL(file), image = new Image(); image.onload = () => { setPhoto(image); setZoom(1); setOffsetX(0); setOffsetY(0); URL.revokeObjectURL(url); }; image.onerror = () => { setPhotoError('This image could not be opened. Try JPEG or PNG.'); URL.revokeObjectURL(url); }; image.src = url;
  };
  // Hosts such as STAIGE embed the game in an iframe sandbox without allow-forms, which blocks native form
  // submission before onSubmit runs. Validate and send directly from the button and the Enter key instead.
  const submit = (form: HTMLFormElement | null) => {
    if (!form?.reportValidity()) return;
    const profile = { name, avatar, color }; mode === 'create' ? net.create(profile, `${name}'s island`, size) : net.join(profile, code);
  };
  return <section className="arrival">
    <div className="eyebrow">A LITTLE WORLD. A SHARED TABLE.</div><h1>Good company.<br/>New horizons.</h1><p className="intro">Gather your people around a living island.<br/>Build a home. Make a deal. Find your way.</p>
    <div className="arrival-form"><div className="segmented"><button className={mode === 'create' ? 'selected' : ''} onClick={() => setMode('create')}>Create an island</button><button className={mode === 'join' ? 'selected' : ''} onClick={() => setMode('join')}>Join friends</button></div>
      <form onSubmit={e => { e.preventDefault(); submit(e.currentTarget); }} onKeyDown={e => { if (e.key === 'Enter' && e.target instanceof HTMLInputElement) { e.preventDefault(); submit(e.currentTarget); } }}>
        <div className="profile-entry"><Avatar avatar={avatar} color={color} name={name || 'Your'} size={58}/><label>Your name<input autoComplete="nickname" placeholder="What should we call you?" value={name} maxLength={24} required onChange={e => setName(e.target.value)}/></label></div>
        <div className="profile-tools"><label className="text-button upload">＋ Add your photo<input type="file" accept="image/*" onChange={e => upload(e.target.files?.[0])}/></label><button type="button" className="text-button" onClick={() => { setPhoto(null); setAvatar(`avatar:${(Number(avatar.split(':')[1]) + 1 || 1) % 8}`); }}>Change character ↻</button></div>
        {photo && <div className="crop-controls"><label>Crop zoom<input aria-label="Crop zoom" type="range" min="1" max="3" step=".05" value={zoom} onChange={e => setZoom(+e.target.value)}/></label><label>Horizontal<input type="range" min="-1" max="1" step=".05" value={offsetX} onChange={e => setOffsetX(+e.target.value)}/></label><label>Vertical<input type="range" min="-1" max="1" step=".05" value={offsetY} onChange={e => setOffsetY(+e.target.value)}/></label></div>}
        {photoError && <p role="alert">{photoError}</p>}
        <div className="colors" aria-label="Player color">{COLORS.map(c => <button type="button" key={c} className={color === c ? 'chosen' : ''} style={{ background: c }} aria-label={`Choose color ${c}`} onClick={() => setColor(c)}/>)}</div>
        {mode === 'join' ? <label>Island code<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={5} minLength={5} placeholder="ABCDE" required/></label> : <label>Your gathering<select value={size} onChange={e => setSize(e.target.value as Size)}><option value="classic">Classic island · 3–4 players</option><option value="expanded">Expanded island · 5–6 players</option><option value="grand">Grand island · 7–8 players · custom</option></select></label>}
        <button type="button" className="primary wide" disabled={net.busy} onClick={e => submit(e.currentTarget.form)}>{net.busy ? 'Preparing your island…' : mode === 'create' ? 'Make room for adventure  ↗' : 'Join the table  ↗'}</button>
      </form>
    </div><p className="quiet arrival-foot">3–8 friends & AI companions <span>·</span> No accounts <span>·</span> Your local Wi-Fi</p>
  </section>;
}
export function Lobby({ net }: { net: Connection }) {
  const room = net.view!.lobby, host = net.view!.self === room.host, config = CONFIG[room.size];
  const [difficulty, setDifficulty] = useState<Difficulty>('normal'), [personality, setPersonality] = useState<Personality>('balanced'), [qr, setQr] = useState(''), [urlIndex, setUrlIndex] = useState(0), [copyLabel, setCopyLabel] = useState('Copy link');
  // An external game server only knows its own addresses, so invite with this page's address instead.
  const urls = gameServerUrl ? [] : room.urls;
  const url = urls[urlIndex] ?? `${location.origin}${location.pathname}?join=${room.code}`;
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 160, color: { dark: '#304c40', light: '#faf9f2' } }).then(setQr); }, [url]);
  return <section className="lobby-panel"><div className="eyebrow">THE TABLE IS OPEN</div><h1>{room.name}</h1><p className="intro">A place for old friends and new companions.</p>
    <div className="lobby-config"><label>Island size<select disabled={!host || net.busy} value={room.size} onChange={e => net.lobby({ type: 'CONFIGURE', size: e.target.value as Size, target: room.target, name: room.name })}><option value="classic">Classic · 3–4</option><option value="expanded">Expanded · 5–6</option><option value="grand">Grand · 7–8 (custom)</option></select></label><label>Victory<select disabled={!host || net.busy} value={room.target} onChange={e => net.lobby({ type: 'CONFIGURE', size: room.size, target: +e.target.value, name: room.name })}>{[8, 10, 12, 15].map(n => <option key={n} value={n}>{n} points</option>)}</select></label></div>
    <div className="lobby-rules" aria-label="Game rules"><label className="rule-toggle"><span>Shifting Ports <small>{room.settings.shiftingPorts ? 'On' : 'Off'}</small></span><input type="checkbox" role="switch" aria-label="Shifting Ports" checked={room.settings.shiftingPorts} disabled={!host || net.busy} onChange={e => net.lobby({ type: 'SET_RULES', shiftingPorts: e.target.checked })}/></label><p>{room.settings.shiftingPorts ? 'After a 7 and the completed Wanderer sequence, merchants exchange docks.' : 'Ports stay fixed for the entire match. The Wanderer follows classic rules.'}</p><small>{host ? 'Choose before starting. Rules lock when the island wakes.' : 'Chosen by the host. Rules lock when the island wakes.'}</small></div>
    <div className="seat-heading"><span>YOUR COMPANY</span><span>{room.players.length} / {config.max} seats</span></div>
    <div className="seats">{room.players.map((p, i) => <div className="seat" key={p.id}><span className="seat-number">0{i + 1}</span><Avatar {...p}/><div><strong>{p.name}{p.id === net.view!.self && <small> you</small>}</strong><p>{p.ai ? `${p.difficulty} · ${p.personality}` : p.connected ? p.id === room.host ? 'Host · ready to explore' : 'Joined the table' : 'Reconnecting…'}</p></div>{host && p.id !== room.host && (p.ai || !p.connected) && <button className="icon-button remove-seat" aria-label={`Remove ${p.name}`} disabled={net.busy} onClick={() => net.lobby({ type: 'REMOVE_SEAT', player: p.id })}>×</button>}</div>)}</div>
    {host && room.players.length < config.max && <div className="add-companion"><div><select aria-label="AI difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>{['easy', 'normal', 'hard', 'expert'].map(x => <option key={x}>{x}</option>)}</select><select aria-label="AI personality" value={personality} onChange={e => setPersonality(e.target.value as Personality)}>{['balanced', 'trader', 'builder', 'expansionist', 'aggressive', 'chaotic'].map(x => <option key={x}>{x}</option>)}</select></div><button className="secondary" disabled={net.busy} onClick={() => net.lobby({ type: 'ADD_AI', difficulty, personality })}>＋ Add companion</button></div>}
    <div className="join-block">{qr && <img src={qr} alt="QR code to join this island"/>}<div><div className="eyebrow">INVITE A FRIEND</div><strong className="island-code">{room.code}</strong><p>Same Wi-Fi. Scan. Settle in.</p><button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopyLabel('Copied'); } catch { setCopyLabel('Select the address below'); } }}>{copyLabel}</button></div></div>
    {urls.length > 1 && <select aria-label="LAN network address" value={urlIndex} onChange={e => setUrlIndex(+e.target.value)}>{urls.map((u, i) => <option value={i} key={u}>{u}</option>)}</select>}<input className="join-url" aria-label="Local join URL" value={url} readOnly onFocus={e => e.target.select()}/>
    {host ? <button className="primary wide" disabled={net.busy || room.players.length < config.min} onClick={() => net.lobby({ type: 'START' })}>Wake the island  ↗</button> : <p className="waiting">Waiting for the host to wake the island…</p>}
    <p className="quiet">{room.players.length < config.min ? `Add ${config.min - room.players.length} more player${config.min - room.players.length > 1 ? 's' : ''} to begin. ` : ''}Random terrain & ports · Shifting Ports {room.settings.shiftingPorts ? 'ON' : 'OFF'} · Classic core rules{room.size !== 'classic' ? ' · Experimental large island' : ''}</p>
  </section>;
}
export function Brand() { return <div className="brand"><Mark/><span>CONQUEST <b>OF PIZZERIA</b><small>A LIVING ISLAND, A SHARED TABLE</small></span></div>; }
