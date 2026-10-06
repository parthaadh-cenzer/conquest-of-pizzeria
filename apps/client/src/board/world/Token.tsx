import { Html } from '@react-three/drei';
import type { RefObject } from 'react';
import { useLabelReveal } from './Introduction';
export function Token({ number, producing, blocked, time, at }: { number: number; producing: boolean; blocked: boolean; time: RefObject<number>; at: number }) {
  const label = useLabelReveal(time, at);
  return <group position={[0, .10, .32]}>
    <mesh receiveShadow castShadow><cylinderGeometry args={[.255, .267, .055, 40]}/><meshStandardMaterial color="#e9d7af" roughness={.87}/></mesh>
    <Html position={[0, .032, 0]} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}><div ref={label} className={`number-token ${number === 6 || number === 8 ? 'hot' : ''} ${producing ? 'producing' : ''} ${blocked ? 'blocked-token' : ''}`}><b>{number}</b><span>{'·'.repeat(6 - Math.abs(7 - number))}</span>{producing && blocked && <em>BLOCKED</em>}</div></Html>
  </group>;
}
