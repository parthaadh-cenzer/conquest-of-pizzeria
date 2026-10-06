import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameView } from '../../../../packages/game-engine/src/types';
import { RESOURCE_COLORS } from '../ui/Icons';
interface Particle { from: THREE.Vector3; to: THREE.Vector3; age: number; duration: number; blocked: boolean; color: string }
/** Fixed-size particle pool; no per-frame React updates and no private inventory data. */
export function ResourceEffects({ game, motion }: { game?: GameView; motion: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null), pool = useRef<Particle[]>([]), last = useRef<number | null>(null);
  useEffect(() => {
    if (!game) return; const newest = game.events.at(-1)?.id;
    if (newest === undefined) return;
    if (last.current === null) { last.current = newest; return; }
    const events = game.events.filter(e => e.id > last.current!); last.current = newest;
    if (!motion) { pool.current = []; return; }
    for (const event of events) {
      if (event.type !== 'production' && event.type !== 'blocked') continue;
      for (const id of event.hexes ?? []) {
        const h = game.board.hexes[id];
        for (const v of h.vertices) {
          const building = game.buildings[v]; if (!building) continue;
          if (event.type === 'production' && !event.players.includes(building.owner)) continue;
          const vertex = game.board.vertices[v];
          for (let i = 0; i < 3; i++) pool.current.push({ from: new THREE.Vector3(h.x, .5 + i * .06, h.y), to: new THREE.Vector3(event.type === 'blocked' ? h.x : vertex.x, .4, event.type === 'blocked' ? h.y - .17 : vertex.y), age: -i * .12, duration: .85, blocked: event.type === 'blocked', color: RESOURCE_COLORS[h.resource] });
        }
      }
    }
    pool.current = pool.current.slice(-120);
  }, [game, motion]);
  useFrame((_, dt) => {
    if (!mesh.current) return;
    const matrix = new THREE.Object3D(); pool.current = pool.current.filter(p => p.age < p.duration);
    pool.current.forEach((p, i) => { p.age += dt; const t = Math.max(0, Math.min(1, p.age / p.duration)); matrix.position.lerpVectors(p.from, p.to, t); matrix.position.y += Math.sin(t * Math.PI) * (p.blocked ? .65 : .9); matrix.scale.setScalar(p.age < 0 ? 0 : (1 - t * .6) * (p.blocked ? .8 : 1)); matrix.rotation.set(t * 4, t * 3, 0); matrix.updateMatrix(); mesh.current!.setMatrixAt(i, matrix.matrix); mesh.current!.setColorAt(i, new THREE.Color(p.blocked && t > .65 ? '#6c5c75' : p.color)); });
    mesh.current.count = pool.current.length; mesh.current.instanceMatrix.needsUpdate = true; if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, 120]} frustumCulled={false}><boxGeometry args={[.09, .13, .045]}/><meshStandardMaterial color="#ffffff" roughness={.7}/></instancedMesh>;
}
