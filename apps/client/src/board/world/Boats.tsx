import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import type { Board } from '../../../../../packages/game-engine/src/types';
import { assets } from './assets';
import { boatRoute, WORLD_QUALITY, type WorldQuality } from './math';
import { windTime, windStrength } from './wind';
import { ImportedCaravel } from './ImportedWorld';
export function Boat({ phase = 0, docked = false, trade = false }: { phase?: number; docked?: boolean; trade?: boolean }) {
  const hull = useRef<T.Group>(null), sail = useRef<T.Mesh>(null);
  useFrame(() => { const t = windTime.value; if (hull.current) { hull.current.position.y = Math.sin(t * 1.1 + phase) * .016; hull.current.rotation.z = Math.sin(t * .8 + phase) * .035; hull.current.rotation.x = Math.sin(t * .63 + phase) * .022; } if (sail.current) sail.current.rotation.y = -.25 + windStrength(t, phase, 0) * .11; });
  return <group ref={hull} name={docked ? 'moored-boat' : 'sailing-boat'}>{trade ? <><ImportedCaravel phase={phase}/><mesh ref={sail} geometry={assets().sail} position={[0, .55, -.07]} scale={[1.0, 1.05, 1]} rotation={[0, -.2, -.025]} castShadow><meshStandardMaterial color="#e6d6ae" roughness={1} side={T.DoubleSide}/></mesh></> : <><mesh geometry={assets().boat} castShadow><meshStandardMaterial vertexColors roughness={.85}/></mesh><mesh ref={sail} geometry={assets().sail} position={[.015, .425, .03]} rotation={[0, -.2, -.025]} castShadow><meshStandardMaterial color={phase % 2 ? '#d6c59c' : '#ebe0bf'} roughness={1} side={T.DoubleSide}/></mesh></>}</group>;
}
function Roamer({ board, index }: { board: Board; index: number }) {
  const vessel = useRef<T.Group>(null), wake = useRef<T.Mesh>(null), first = boatRoute(board, index, 0);
  useFrame(() => { const route = boatRoute(board, index, windTime.value); if (vessel.current) { vessel.current.position.set(route.x, -.23, route.z); vessel.current.rotation.y = route.rotation; } if (wake.current) (wake.current.material as T.MeshBasicMaterial).opacity = .15 + .035 * Math.sin(windTime.value + index); });
  return <group ref={vessel} position={[first.x, -.23, first.z]} rotation={[0, first.rotation, 0]} name={`roaming-boat-${index}`}><Boat phase={index * 1.7}/><mesh ref={wake} position={[0, -.054, -.79]} rotation={[-Math.PI / 2, 0, 0]} scale={[.18, .9, 1]}><ringGeometry args={[.75, 1, 24, 1, Math.PI * .08, Math.PI * .84]}/><meshBasicMaterial color="#d1d7bd" transparent opacity={.18} depthWrite={false} side={T.DoubleSide}/></mesh></group>;
}
export function Boats({ board, quality }: { board: Board; quality: WorldQuality }) { return <group name="ocean-traffic" dispose={null}>{Array.from({ length: WORLD_QUALITY[quality].boats }, (_, i) => <Roamer key={i} board={board} index={i}/>)}</group>; }
