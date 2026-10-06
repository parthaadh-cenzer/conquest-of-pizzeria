import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
const pipPositions = (n: number): [number, number][] => {
  const p: [number, number][] = []; if (n % 2) p.push([0, 0]); if (n > 1) p.push([-.12, -.12], [.12, .12]); if (n > 3) p.push([-.12, .12], [.12, -.12]); if (n === 6) p.push([-.12, 0], [.12, 0]); return p;
};
const rotations: Record<number, [number, number, number]> = { 1: [-Math.PI / 2, 0, 0], 6: [Math.PI / 2, 0, 0], 2: [0, 0, Math.PI / 2], 5: [0, 0, -Math.PI / 2], 3: [0, 0, 0], 4: [Math.PI, 0, 0] };
function Die({ value, index, roll, motion }: { value: number; index: number; roll: number; motion: boolean }) {
  const group = useRef<THREE.Group>(null), progress = useRef(2);
  useEffect(() => { progress.current = motion ? 0 : 2; }, [roll, motion]);
  useFrame((_state, dt) => { if (!group.current) return; progress.current += dt; const p = Math.min(1, progress.current / 1.1), target = rotations[value];
    group.current.rotation.set(target[0] + (1 - p) * Math.PI * 4, target[1] + (1 - p) * Math.PI * (index ? 3 : -3), target[2] + (1 - p) * Math.PI * 2);
    group.current.position.y = .33 + (motion ? Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) * 1.3 : 0);
  });
  const faces: { n: number; position: [number, number, number]; rotation: [number, number, number] }[] = [
    { n: 1, position: [0, 0, .261], rotation: [0, 0, 0] }, { n: 6, position: [0, 0, -.261], rotation: [0, Math.PI, 0] },
    { n: 2, position: [.261, 0, 0], rotation: [0, Math.PI / 2, 0] }, { n: 5, position: [-.261, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    { n: 3, position: [0, .261, 0], rotation: [-Math.PI / 2, 0, 0] }, { n: 4, position: [0, -.261, 0], rotation: [Math.PI / 2, 0, 0] },
  ];
  return <group ref={group} position={[index * .72, .33, index * .1]}><RoundedBox castShadow receiveShadow args={[.52, .52, .52]} radius={.06} smoothness={2}><meshStandardMaterial color={index ? '#e5d7bd' : '#fff7df'} roughness={.58}/></RoundedBox>{faces.map(f => <group key={f.n} position={f.position} rotation={f.rotation}>{pipPositions(f.n).map(([x, y], i) => <mesh key={i} position={[x, y, 0]}><circleGeometry args={[.033, 12]}/><meshBasicMaterial color="#46524a"/></mesh>)}</group>)}</group>;
}
export function Dice({ values, roll, motion }: { values: [number, number] | null; roll: number; motion: boolean }) { return <group position={[-.35, 0, 0]}>{[0, 1].map(i => <Die key={i} value={values?.[i] ?? (i ? 5 : 3)} index={i} roll={roll} motion={motion}/>)}</group>; }
