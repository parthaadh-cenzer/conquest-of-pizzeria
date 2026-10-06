import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { generateBoard } from '../../../../packages/board-generator/src/board';
import type { Board as BoardData, GameView, Action, Port } from '../../../../packages/game-engine/src/types';
import { Vegetation } from './world/Vegetation';
import { Terrain } from './world/Terrain';
import { BuildingPiece, RoadPiece, Wanderer } from './world/Pieces';
import { ImportedArena, ImportedRobber } from './world/ImportedWorld';
import { RollCamera } from './world/RollCamera';
import { Dice } from './Dice';
import { ResourceEffects } from './Effects';
import { Ocean as LivingOcean } from './world/Ocean';
import { Coast } from './world/Coast';
import { Archipelago } from './world/Archipelago';
import { Harbor } from './world/Ports';
import { CameraRig, WorldClock, Atmosphere, Reveal, TileBack } from './world/Introduction';
import { Token } from './world/Token';
import { WORLD_QUALITY, revealSchedule, type WorldQuality } from './world/math';
import { RESOURCE_COLORS, LABELS } from '../ui/Icons';
export type BuildMode = 'road' | 'settlement' | 'city' | null;
export interface BoardProps { game?: GameView; mode?: BuildMode; act?: (a: Action) => void; motion: boolean; quality: string; reset: number; preview?: boolean; intro?: boolean; onIntroComplete?: () => void }
type Props = BoardProps;
class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> { state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; } render() { return this.state.failed ? this.props.fallback : this.props.children; } }
function Scene({ board, game, mode, act, motion, reset, preview, quality, intro = false, onIntroComplete, ports }: Props & { board: BoardData; ports: Port[] }) {
  const detail = (quality in WORLD_QUALITY ? quality : 'medium') as WorldQuality;
  const introTime = useRef(intro ? 0 : 99);
  const [cosmeticSeed] = useState(() => crypto.getRandomValues(new Uint32Array(1))[0]);
  const schedule = useMemo(() => revealSchedule(Object.keys(board.hexes), cosmeticSeed), [board, cosmeticSeed]);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => { controls.current?.target.set(0, 0, 0); controls.current?.update(); }, [reset]);
  const legalVertices = intro ? [] : mode === 'city' ? game?.legal.cities ?? [] : (mode === 'settlement' || game?.phase === 'setup-settlement') ? game?.legal.settlements ?? [] : [];
  const legalEdges = intro ? [] : mode === 'road' || game?.phase === 'setup-road' || game?.phase === 'free-roads' ? game?.legal.roads ?? [] : [];
  const recent = game?.events.slice(-4) ?? [];
  const sum = game?.dice ? game.dice[0] + game.dice[1] : 0;
  const robberHex = game ? board.hexes[game.robber] : Object.values(board.hexes).find(h => h.resource === 'desert')!;
  const arenaX = Math.max(...Object.values(board.vertices).map(v => Math.hypot(v.x, v.y))) + 6.8;
  return <>
    <color attach="background" args={['#6e8c87']}/><fog attach="fog" args={['#9cafa1', 28, 85]}/><hemisphereLight args={['#d9e7de', '#555b48', .85]}/><directionalLight position={[-6, 10, -3]} intensity={2.95} color="#ffe3b1" castShadow={detail !== 'low'} shadow-mapSize={[WORLD_QUALITY[detail].shadow || 512, WORLD_QUALITY[detail].shadow || 512]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-normalBias={.035} shadow-bias={-.0001}/><directionalLight position={[4, 6, 8]} intensity={.4} color="#c4dce2"/>
    <WorldClock time={introTime} active={intro} motion={motion} done={onIntroComplete}/><CameraRig reset={reset} grand={Object.keys(board.hexes).length > 25} preview={!!preview} active={intro} time={introTime}/><RollCamera roll={game?.history.length ?? 0} arenaX={arenaX} controls={controls} motion={motion} intro={intro}/><Atmosphere time={introTime} grand={Object.keys(board.hexes).length > 25} low={detail === 'low'}/><LivingOcean board={board} quality={detail}/><Coast board={board} quality={detail}/><Archipelago board={board} ports={ports} time={introTime} quality={detail} pending={game?.portShiftPending} revision={game?.portRevision} preview={!!preview}/>
    <group dispose={null}>
      {Object.values(board.hexes).map((h, i) => {
        const producing = !!game && h.number === sum && recent.some(e => e.type === 'production' || e.type === 'blocked');
        return <group key={h.id} position={[h.x, 0, h.y]}>
          <Reveal time={introTime} at={schedule[h.id]} flip><TileBack time={introTime} at={schedule[h.id]}/><Terrain hex={h} seed={i}/></Reveal>
          <Reveal time={introTime} at={schedule[h.id] + .66}><Vegetation hex={h} seed={i} quality={detail} blocked={game?.robber === h.id} motion={motion} preview={!!preview}/></Reveal>
          {h.number && <Reveal time={introTime} at={schedule[h.id] + .85}><Token number={h.number} producing={producing} blocked={game?.robber === h.id} time={introTime} at={schedule[h.id] + .85}/></Reveal>}
          {!intro && game?.legal.robberHexes.includes(h.id) && <Html position={[0, .8, 0]} center zIndexRange={[15, 10]}><button className="place-hex" aria-label={`Move Wanderer to ${h.id}`} onClick={() => act?.({ type: 'MOVE_ROBBER', hex: h.id })}>⌖</button></Html>}
        </group>;
      })}
      {ports.map((port, index) => <Harbor key={port.edge} board={board} port={port} index={index} introTime={introTime} motion={motion}/>)}
      {game && Object.entries(game.roads).map(([id, owner]) => { const [a, b] = board.edges[id].vertices.map(v => board.vertices[v]), color = game.players.find(p => p.id === owner)!.color; return <group key={id} position={[(a.x + b.x) / 2, .064, (a.y + b.y) / 2]} rotation={[0, -Math.atan2(b.y - a.y, b.x - a.x), 0]}><RoadPiece color={color}/></group>; })}
      {game && Object.entries(game.buildings).map(([id, b]) => { const v = board.vertices[id], color = game.players.find(p => p.id === b.owner)!.color; return <group key={id+':'+b.kind} position={[v.x, .07, v.y]}><BuildingPiece color={color} city={b.kind === 'city'}/></group>; })}
      {legalVertices.map(id => { const v = board.vertices[id]; return <Html key={id} position={[v.x, .35, v.y]} center zIndexRange={[20, 15]}><button className="place-dot" aria-label={`${mode === 'city' ? 'Upgrade city' : 'Build settlement'} at ${id}`} onClick={() => act?.(mode === 'city' ? { type: 'BUILD_CITY', vertex: id } : { type: 'BUILD_SETTLEMENT', vertex: id })}>＋</button></Html>; })}
      {legalEdges.map(id => { const [a, b] = board.edges[id].vertices.map(v => board.vertices[v]); return <Html key={id} position={[(a.x + b.x) / 2, .34, (a.y + b.y) / 2]} center zIndexRange={[20, 15]}><button className="place-road" aria-label={`Build road at ${id}`} onClick={() => act?.({ type: 'BUILD_ROAD', edge: id })}>＋</button></Html>; })}
      {robberHex && <Reveal time={introTime} at={schedule[robberHex.id] + .75}>{preview ? <Wanderer x={robberHex.x} z={robberHex.y - .17} motion={motion}/> : <ImportedRobber x={robberHex.x} z={robberHex.y - .17} motion={motion}/>}</Reveal>}
      {game && <Reveal time={introTime} at={7.1}><group position={[arenaX, 0, 0]}><ImportedArena/><Dice values={game.dice} roll={game.history.length} motion={motion}/></group></Reveal>}
      <ResourceEffects game={game} motion={motion}/>
    </group>
    <OrbitControls ref={controls} enabled={!intro} makeDefault enablePan={!preview} enableZoom={!preview} enableRotate={!preview} minDistance={4.5} maxDistance={31} minPolarAngle={.3} maxPolarAngle={1.05} minAzimuthAngle={-.5} maxAzimuthAngle={.5} target={[0, 0, 0]} enableDamping={motion}/>
  </>;
}
function FlatBoard({ board, game, mode, act }: Props & { board: BoardData }) {
  const radius = Object.keys(board.hexes).length > 25 ? 7 : 5;
  return <svg className="flat-board" viewBox={`${-radius} ${-radius} ${radius * 2} ${radius * 2}`} aria-label="Accessible flat island board">
    {Object.values(board.hexes).map(h => <g key={h.id}><polygon points={h.vertices.map(v => `${board.vertices[v].x},${board.vertices[v].y}`).join(' ')} fill={RESOURCE_COLORS[h.resource]} stroke="#e7dfc7" strokeWidth=".05"/><text x={h.x} y={h.y + .12} textAnchor="middle" fontSize=".32" fill="#253e33">{h.number ?? '◇'}{game?.robber === h.id ? ' ●' : ''}</text>{game?.legal.robberHexes.includes(h.id) && <circle role="button" tabIndex={0} aria-label={`Move Wanderer to ${h.id}`} cx={h.x} cy={h.y} r=".5" fill="transparent" stroke="#fff" onClick={() => act?.({ type: 'MOVE_ROBBER', hex: h.id })}/>}</g>)}
    {game && Object.entries(game.roads).map(([id, owner]) => { const [a, b] = board.edges[id].vertices.map(v => board.vertices[v]); return <line key={id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={game.players.find(p => p.id === owner)!.color} strokeWidth=".13"/>; })}
    {game && Object.entries(game.buildings).map(([id, b]) => <circle key={id} cx={board.vertices[id].x} cy={board.vertices[id].y} r={b.kind === 'city' ? .19 : .14} fill={game.players.find(p => p.id === b.owner)!.color} stroke="#fff" strokeWidth=".04"/>)}
    {board.ports.map(p => { const [a, b] = board.edges[p.edge].vertices.map(id => board.vertices[id]), x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, length = Math.hypot(x, y); return <g key={p.edge} transform={`translate(${x + x / length * .37},${y + y / length * .37})`}><title>{p.ratio}:1 {p.resource === 'any' ? 'Any resource' : LABELS[p.resource]} port</title><rect x="-.29" y="-.13" width=".58" height=".26" rx=".04" fill="#fbf3d7"/><text textAnchor="middle" y=".07" fontSize=".18" fill="#304b40">{p.ratio}:1{p.resource === 'any' ? '' : LABELS[p.resource][0]}</text></g>; })}
    {(mode === 'city' ? game?.legal.cities : mode === 'settlement' || game?.phase === 'setup-settlement' ? game?.legal.settlements : [])?.map(id => <circle key={id} role="button" tabIndex={0} aria-label={`Build settlement at ${id}`} cx={board.vertices[id].x} cy={board.vertices[id].y} r=".18" fill="#fff8db" stroke="#335d4b" strokeWidth=".06" onClick={() => act?.(mode === 'city' ? { type: 'BUILD_CITY', vertex: id } : { type: 'BUILD_SETTLEMENT', vertex: id })}/>)}
    {(mode === 'road' || game?.phase === 'setup-road' || game?.phase === 'free-roads' ? game?.legal.roads : [])?.map(id => { const [a, b] = board.edges[id].vertices.map(v => board.vertices[v]); return <circle key={id} role="button" tabIndex={0} aria-label={`Build road at ${id}`} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r=".16" fill="#fff8db" stroke="#335d4b" strokeWidth=".05" onClick={() => act?.({ type: 'BUILD_ROAD', edge: id })}/>; })}
  </svg>;
}
export function IslandBoard(props: Props) {
  const boardKey = JSON.stringify(props.game?.board.hexes);
  const board = useMemo(() => props.game?.board ?? generateBoard('classic', items => { const list = [...items]; for (let i = list.length - 1; i > 0; i--) { const j = (i * 17 + 3) % (i + 1); [list[i], list[j]] = [list[j], list[i]]; } return list; }), [boardKey]);
  const flat = <FlatBoard {...props} board={props.game?.board ?? board}/>;
  if (props.quality === 'flat') return flat;
  return <Boundary fallback={flat}><Suspense fallback={flat}><Canvas shadows={props.quality !== 'low'} dpr={props.quality === 'high' ? [1, 2] : [1, 1.35]} camera={{ position: [0, 10, 10], fov: 42 }} gl={{ antialias: props.quality !== 'low', powerPreference: 'high-performance' }}><Scene {...props} board={board} ports={props.game?.board.ports ?? board.ports}/></Canvas></Suspense></Boundary>;
}
