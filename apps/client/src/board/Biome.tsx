import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Resource } from '../../../../packages/game-engine/src/types';
/** Original procedural miniature props. No loaded models, textures or external artwork. */
export function Biome({ resource, seed, motion, active, blocked }: { resource: Resource | 'desert'; seed: number; motion: boolean; active: boolean; blocked: boolean }) {
  const group = useRef<THREE.Group>(null), grain = useRef<THREE.InstancedMesh>(null);
  const clockOffset = seed * 1.73;
  useLayoutEffect(() => {
    if (!grain.current) return;
    const transform = new THREE.Object3D();
    for (let i = 0; i < 25; i++) { transform.position.set((i % 5 - 2) * .12, .12, (Math.floor(i / 5) - 2) * .12); transform.rotation.set(0, i, .08); transform.updateMatrix(); grain.current.setMatrixAt(i, transform.matrix); }
    grain.current.instanceMatrix.needsUpdate = true;
  }, [resource]);
  useFrame(({ clock }) => {
    if (!group.current || !motion) return; const t = clock.elapsedTime + clockOffset;
    if (resource === 'wood') { group.current.rotation.z = Math.sin(t * .8) * .025 * (active ? 2.5 : 1); group.current.rotation.x = Math.cos(t * .6) * .015; }
    if (resource === 'wool') group.current.children.forEach((child, i) => { child.position.x = Math.sin(t * .2 + i * 2) * .2 + (i - 1) * .24; child.position.z = Math.cos(t * .16 + i) * .18 - .28; child.rotation.y = Math.sin(t * .2 + i) * .5 + (blocked ? t * .5 : i * 2); child.rotation.z = Math.sin(t * 2 + i) * .02; });
    if (grain.current) {
      const transform = new THREE.Object3D();
      for (let i = 0; i < 25; i++) { transform.position.set((i % 5 - 2) * .12, .12, (Math.floor(i / 5) - 2) * .12); transform.rotation.set(Math.sin(t * 1.2 + i % 5 * .5) * .11, 0, Math.sin(t + Math.floor(i / 5) * .6) * .13 * (active ? 2 : 1)); transform.updateMatrix(); grain.current.setMatrixAt(i, transform.matrix); } grain.current.instanceMatrix.needsUpdate = true;
    }
  });
  if (resource === 'wood') return <group ref={group} position={[0, 0, -.23]}>{[-.38, -.12, .22, .4, .1].map((x, i) => <group key={i} position={[x, 0, i % 2 ? -.25 : .12]} scale={.7 + (i % 3) * .18}><mesh position={[0, .17, 0]}><cylinderGeometry args={[.035, .05, .34, 5]}/><meshStandardMaterial color="#7c6143"/></mesh><mesh position={[0, .38, 0]}><coneGeometry args={[.23, .55, 7]}/><meshStandardMaterial color={i % 2 ? '#356a50' : '#477b53'} flatShading/></mesh><mesh position={[0, .61, 0]}><coneGeometry args={[.16, .4, 7]}/><meshStandardMaterial color="#669264" flatShading/></mesh></group>)}</group>;
  if (resource === 'grain') return <group position={[0, 0, -.27]}><mesh position={[0, .015, 0]}><boxGeometry args={[.77, .04, .68]}/><meshStandardMaterial color="#ad8a43"/></mesh><instancedMesh ref={grain} args={[undefined, undefined, 25]}><capsuleGeometry args={[.026, .23, 2, 4]}/><meshStandardMaterial color="#ead17e"/></instancedMesh></group>;
  if (resource === 'wool') return <group ref={group}>{[0, 1, 2].map(i => <group key={i} position={[(i - 1) * .25, .12, -.23]} rotation={[0, i * 2, 0]} scale={.85}><mesh scale={[1.25, .8, .8]}><icosahedronGeometry args={[.13, 1]}/><meshStandardMaterial color="#f7f0db" flatShading/></mesh><mesh position={[.15, 0, 0]}><boxGeometry args={[.10, .10, .08]}/><meshStandardMaterial color="#5d6252"/></mesh>{[-.07, .07].flatMap(x => [-.05, .05].map(z => <mesh key={`${x}:${z}`} position={[x, -.10, z]}><boxGeometry args={[.025, .1, .025]}/><meshStandardMaterial color="#5d6252"/></mesh>))}</group>)}</group>;
  if (resource === 'ore') return <group position={[0, 0, -.25]}>{[-.24, .12, .35].map((x, i) => <group key={i} position={[x, 0, i % 2 * .1]}><mesh position={[0, .27 - i * .045, 0]} rotation={[0, i, 0]}><coneGeometry args={[.29 - i * .035, .65 - i * .1, 5]}/><meshStandardMaterial color={i % 2 ? '#9ca9b0' : '#71848e'} flatShading/></mesh><mesh position={[0, .54 - i * .09, 0]} rotation={[0, i, 0]}><coneGeometry args={[.085, .2, 5]}/><meshStandardMaterial color="#e7e7dd" flatShading/></mesh></group>)}</group>;
  if (resource === 'brick') return <group position={[0, 0, -.24]}>{[-.25, .1, .33].map((x, i) => <mesh key={i} position={[x, .11 + i * .015, i % 2 * .17]} rotation={[0, i * .5, 0]}><dodecahedronGeometry args={[.25 - i * .03, 0]}/><meshStandardMaterial color={i % 2 ? '#bd7d5a' : '#ce9975'} flatShading/></mesh>)}</group>;
  return <group position={[0, .04, -.1]}>{[0, 1, 2].map(i => <mesh key={i} position={[(i - 1) * .3, 0, i % 2 * .2]} scale={[1.5, .25, 1]}><sphereGeometry args={[.22, 10, 5]}/><meshStandardMaterial color="#d6c5a2"/></mesh>)}</group>;
}
