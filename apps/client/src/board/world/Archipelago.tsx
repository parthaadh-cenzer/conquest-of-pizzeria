import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import type { Board, Port } from '../../../../../packages/game-engine/src/types';
import { assets, Sculpt } from './assets';
import { Boat } from './Boats';
import { Reveal } from './Introduction';
import { maritimeNavigation, mainMooring, outerMooring, type Navigation, type Point } from './navigation';
import { variation, type WorldQuality } from './math';
import { windTime } from './wind';

function islandGeometry(index: number) {
  const s = new Sculpt();
  // Broken rock foundations, overlapping beaches, and a small uneven grassy crown.
  for (let i = 0; i < 11; i++) { const a = i * 2.4, r = .19 + variation(i + index * 17) * .20; s.ball(i % 3 ? '#737c70' : '#92937e', [Math.cos(a) * r, -.16, Math.sin(a) * r], [.20, .18 + variation(i) * .15, .19], 1); }
  s.ball('#c5b18a', [0, -.095, 0], [.64, .13, .60], 2); s.ball('#84906a', [0, -.002, 0], [.46, .08, .44], 2);
  const lighthouse = index % 3 === 0;
  if (lighthouse) {
    s.add(new T.CylinderGeometry(.075, .12, .62, 14), '#ded9be', [0, .36, 0]);
    for (const y of [.24, .47]) s.add(new T.CylinderGeometry(.103 - y * .036, .105 - y * .036, .08, 14), '#a27256', [0, y, 0]);
    s.add(new T.CylinderGeometry(.12, .12, .032, 16), '#756a51', [0, .665, 0]); s.add(new T.CylinderGeometry(.062, .062, .10, 10), '#d1ba7c', [0, .72, 0]);
    s.ball('#66756b', [0, .79, 0], [.095, .062, .095], 1);
  } else {
    s.box('#d3c4a0', [0, .14, 0], [.26, .22, .24]);
    for (const side of [-1, 1]) s.box(index % 2 ? '#97744f' : '#717f6c', [side * .075, .28, 0], [.20, .025, .32], [0, 0, -side * .57]);
    s.box('#596253', [0, .115, .125], [.066, .12, .009]); s.box('#d5be82', [.08, .19, .125], [.045, .05, .008]);
    s.box('#8f7755', [.28, .075, .08], [.12, .12, .12]);
  }
  // Satellite dock faces inward. Its terminal is in the same navigable water used by the ship.
  for (let i = 0; i < 8; i++) s.box(i % 2 ? '#aa9065' : '#b59a70', [0, -.015, .30 + i * .075], [.25, .034, .068]);
  for (const x of [-.145, .145]) for (const z of [.43, .80]) s.add(new T.CylinderGeometry(.022, .027, .29, 6), '#78694f', [x, -.08, z]);
  return s.finish();
}
function Satellite({ site, index, low }: { site: Point; index: number; low: boolean }) {
  const geometry = useMemo(() => islandGeometry(index), [index]);
  const rotation = Math.atan2(-site.x, -site.z);
  return <group position={[site.x, -.035, site.z]} rotation={[0, rotation, 0]} name={`satellite-island-${index}`}>
    <mesh geometry={geometry} castShadow={!low} receiveShadow><meshStandardMaterial vertexColors roughness={.97}/></mesh>
    {[0, 1].map(i => <mesh key={i} geometry={assets().trees[(index + i) % 4]} position={[i ? .22 : -.24, .025, -.17]} scale={.30 + variation(index + i) * .15} castShadow={!low} dispose={null}><meshStandardMaterial vertexColors roughness={.94}/></mesh>)}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.263, 0]}><ringGeometry args={[.68, .85, 48]}/><meshBasicMaterial color="#b7c6ad" transparent opacity={.13} depthWrite={false}/></mesh>
  </group>;
}
function Merchant({ board, port, index, navigation, pending, revision, preview }: { board: Board; port: Port; index: number; navigation: Navigation; pending: boolean; revision: number; preview: boolean }) {
  const ref = useRef<T.Group>(null), from = outerMooring(navigation.sites[index]);
  const position = useRef<Point>(from), route = useRef<ReturnType<Navigation['route']> | null>(null), distance = useRef(0), waiting = useRef(1.5 + index * .8), destination = useRef<'main' | 'outer'>('main');
  const converging = useRef(false), latest = useRef({ port, pending, revision }); latest.current = { port, pending, revision };
  const prev = useRef({ pending: false, revision }), lastTime = useRef(windTime.value), heading = useRef(Math.atan2(-from.x, -from.z));
  const setCourse = (end: Point) => { route.current = navigation.route(position.current, end); distance.current = 0; waiting.current = 0; };
  useEffect(() => {
    if (pending && !prev.current.pending) { converging.current = true; destination.current = 'main'; setCourse(mainMooring(board, port)); }
    // A completed event may arrive in one packet (for example an AI's immediate no-victim move).
    if (revision > prev.current.revision && !converging.current) { waiting.current = .5 + index * .06; route.current = null; destination.current = 'outer'; }
    prev.current = { pending, revision };
  }, [pending, revision]);
  useFrame(() => {
    const dt = Math.max(0, windTime.value - lastTime.current); lastTime.current = windTime.value;
    if (waiting.current > 0) waiting.current -= dt;
    if (!route.current && waiting.current <= 0) {
      if (converging.current && latest.current.pending) return;
      if (converging.current) { converging.current = false; destination.current = 'outer'; }
      setCourse(destination.current === 'main' ? mainMooring(board, latest.current.port) : outerMooring(navigation.sites[index]));
    }
    if (route.current) {
      distance.current += dt * (converging.current ? .83 : .22 + variation(index) * .09);
      const p = route.current.sample(distance.current), look = route.current.sample(distance.current + .12), angle = Math.atan2(look.x - p.x, look.z - p.z);
      if (Math.hypot(look.x - p.x, look.z - p.z) > .0001) heading.current += Math.atan2(Math.sin(angle - heading.current), Math.cos(angle - heading.current)) * Math.min(1, dt * 4);
      position.current = p;
      if (distance.current >= route.current.length) { route.current = null; waiting.current = converging.current ? 1.3 : 3 + variation(index + 17) * 7; destination.current = destination.current === 'main' ? 'outer' : 'main'; }
    }
    if (ref.current) { ref.current.position.set(position.current.x, -.245, position.current.z); ref.current.rotation.y = heading.current; }
  });
  return <group ref={ref} position={[from.x, -.245, from.z]} rotation={[0, heading.current, 0]} scale={.70} name={`merchant-ship-${index}`} dispose={null}><Boat phase={index * 1.7} trade={!preview}/><mesh position={[0, -.08, -.68]} rotation={[-Math.PI / 2, 0, 0]} scale={[.22, .65, 1]}><ringGeometry args={[.8, 1, 20, 1, 0, Math.PI]}/><meshBasicMaterial color="#ced9c4" transparent opacity={.15} depthWrite={false}/></mesh></group>;
}
export function Archipelago({ board, ports, time, quality, pending = false, revision = 0, preview = false }: { board: Board; ports: Port[]; time: RefObject<number>; quality: WorldQuality; pending?: boolean; revision?: number; preview?: boolean }) {
  const navigation = useMemo(() => maritimeNavigation(board), [board]);
  return <Reveal time={time} at={6.7}><group name="trade-archipelago">
    {navigation.sites.map((site, i) => <Satellite key={i} site={site} index={i} low={quality === 'low'}/>)}
    {ports.map((port, i) => <Merchant key={i} board={board} port={port} index={i} navigation={navigation} pending={pending} revision={revision} preview={preview}/>)}
  </group></Reveal>;
}
