import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import { Sculpt, assets } from './assets';
import { windTime } from './wind';
function home(color: string, city: boolean) {
  const s = new Sculpt();
  const house = (x: number, z: number, scale: number, tower = false) => {
    s.box('#e1d3ad', [x, .13 * scale, z], [.23 * scale, .23 * scale, .23 * scale]); s.box('#a69b7c', [x, .03, z], [.27 * scale, .046, .26 * scale]);
    for (const side of [-1, 1]) s.box(color, [x + side * .068 * scale, .278 * scale, z], [.19 * scale, .027 * scale, .285 * scale], [0, 0, -side * .58]);
    s.box('#73664c', [x, .11 * scale, z + .117 * scale], [.047 * scale, .105 * scale, .006]);
    for (const side of [-1, 1]) s.box('#737968', [x + side * .072 * scale, .18 * scale, z + .118 * scale], [.036 * scale, .045 * scale, .006]);
    s.box('#a19376', [x - .072 * scale, .34 * scale, z - .06 * scale], [.035 * scale, .11 * scale, .043 * scale]);
    if (tower) { s.box('#d4c6a2', [x + .16, .23, z - .12], [.13, .43, .13]); s.box(color, [x + .16, .45, z - .12], [.17, .034, .17]); }
  };
  house(0, 0, city ? .92 : 1, city); if (city) house(-.18, .02, .66);
  s.box(color, [.16, .18, .06], [.074, .065, .008]); s.box('#8b7b5c', [.12, .11, .06], [.009, .21, .009]); return s.finish();
}
export function BuildingPiece({ color, city }: { color: string; city: boolean }) { const geometry = useMemo(() => home(color, city), [color, city]); return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.89}/></mesh>; }
export function RoadPiece({ color }: { color: string }) { const geometry = useMemo(() => { const s = new Sculpt(); s.box('#9e906f', [0, .009, 0], [.87, .022, .31]); for (let i = 0; i < 6; i++) s.box(i % 2 ? '#b7a786' : '#c3b596', [(i - 2.5) * .137, .037, 0], [.127, .070, .28], [0, i * .035, 0]); for (const z of [-.125, .125]) s.box(color, [0, .080, z], [.82, .028, .025]); return s.finish(); }, [color]); return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.92}/></mesh>; }
export function Wanderer({ x, z, motion }: { x: number; z: number; motion: boolean }) {
  const ref = useRef<T.Group>(null), target = useMemo(() => new T.Vector3(), []);
  useFrame((_, dt) => { if (!ref.current) return; target.set(x, .07, z); ref.current.position.lerp(target, motion ? Math.min(1, dt * 4) : 1); ref.current.rotation.y = .25 + Math.sin(windTime.value * .5) * .04; });
  return <group ref={ref} position={[x, .07, z]}><mesh geometry={assets().cloak} castShadow><meshStandardMaterial vertexColors roughness={.97}/></mesh><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .006, 0]}><circleGeometry args={[.19, 24]}/><meshBasicMaterial color="#41433a" transparent opacity={.13} depthWrite={false}/></mesh></group>;
}
