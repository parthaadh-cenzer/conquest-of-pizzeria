import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as T from 'three';
import type { Board, Port } from '../../../../../packages/game-engine/src/types';
import { Sculpt } from './assets';
import { coastalFrame, smooth } from './math';
import { Boat } from './Boats';
import { ResourceIcon, LABELS } from '../../ui/Icons';
import { windTime, windStrength } from './wind';
import { useLabelReveal } from './Introduction';
import { mainMooring } from './navigation';
export function Harbor({ board, port, index, introTime, motion }: { board: Board; port: Port; index: number; introTime: React.RefObject<number>; motion: boolean }) {
  const label = useLabelReveal(introTime, 6.75 + index * .035), changedAt = useRef(-100), previousType = useRef(port.resource);
  useEffect(() => { if (previousType.current !== port.resource) changedAt.current = windTime.value; previousType.current = port.resource; }, [port.resource]);
  useFrame(() => { if (label.current) { const change = motion ? smooth((windTime.value - changedAt.current) / .7) : 1; label.current.style.transform = `scaleX(${Math.max(.03, change)})`; label.current.dataset.portType = port.resource; } });
  const frame = useMemo(() => coastalFrame(board, port.edge), [board, port.edge]), group = useRef<T.Group>(null), flag = useRef<T.Mesh>(null);
  const dockLength = useMemo(() => { const end = mainMooring(board, port); return Math.max(1, (end.x - frame.x) * frame.nx + (end.z - frame.z) * frame.nz - .22); }, [board, port.edge, frame]);
  const geometry = useMemo(() => { const s = new Sculpt();
    // Cross-shore landing joins both intersections; longitudinal deck extends along the outward normal.
    for (let i = 0; i < 12; i++) s.box(i % 2 ? '#9c7e53' : '#ad8b5d', [0, .015, -.11 + i * .094], [.39, .038, .086]);
    s.box('#ad8e64', [0, .018, -.09], [1.02, .045, .18]);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      s.add(new T.CylinderGeometry(.033, .043, .54, 8), '#7a6347', [side * .22, -.085, .02 + i * .40]);
      s.add(new T.CylinderGeometry(.04, .04, .023, 8), '#bda984', [side * .22, .194, .02 + i * .40]);
      if (i < 2) s.box('#c5b694', [side * .22, .17, .22 + i * .40], [.011, .013, .39]);
    }
    s.box('#876744', [-.10, .10, .64], [.14, .14, .14]); s.box('#b1986b', [-.10, .16, .64], [.145, .018, .148]);
    s.add(new T.CylinderGeometry(.071, .065, .14, 10), '#9f8057', [.10, .09, .77]);
    s.add(new T.CylinderGeometry(.073, .073, .015, 10), '#665e4d', [.10, .11, .77]);
    s.add(new T.CylinderGeometry(.014, .02, .71, 7), '#8b704f', [.17, .36, .92]);
    return s.finish();
  }, []);
  useFrame(() => { if (group.current) { const amount = smooth((introTime.current - 6.35 - index * .035) / .75); group.current.scale.set(1, amount, amount * dockLength); group.current.visible = amount > .005; } if (flag.current) flag.current.rotation.y = Math.sin(windTime.value * 1.1 + frame.x) * .08 * windStrength(windTime.value, frame.x, frame.z); });
  return <group ref={group} position={[frame.x, .015, frame.z]} rotation={[0, frame.rotation, 0]} name={`harbor-${port.edge}`}><mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.93}/></mesh>
    <mesh ref={flag} position={[.03, .61, .915]}><planeGeometry args={[.44, .30, 4, 2]}/><meshStandardMaterial color="#b3945e" roughness={1} side={T.DoubleSide}/></mesh>
    <Html position={[0, .65, .92]} center zIndexRange={[8, 0]}><div ref={label} className="harbor-marker" title={`${port.ratio}:1 ${port.resource === 'any' ? 'ANY RESOURCE' : LABELS[port.resource]} port`}><b>{port.ratio}:1</b>{port.resource !== 'any' && <ResourceIcon resource={port.resource} size={22}/>}</div></Html>
    {index % 3 === 1 && <group position={[.44, -.24, .56]} scale={.48} rotation={[0, Math.PI * .05, 0]}><Boat phase={index} docked/></group>}
  </group>;
}
