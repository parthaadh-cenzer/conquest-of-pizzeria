import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import type { Hex } from '../../../../../packages/game-engine/src/types';
import { assets, Sculpt } from './assets';
import { inHex, outsideToken, propPosition, variation, WORLD_QUALITY, type WorldQuality } from './math';
import { windMaterial, windTime } from './wind';
import { Grounding } from './Grounding';
import { ImportedFlock, ImportedForest } from './ImportedWorld';
type Instance = { x: number; y: number; z: number; scale: number; rotation: number };
const painted = new T.MeshStandardMaterial({ vertexColors: true, roughness: .94 });
const treeMaterial = windMaterial(.065), cropMaterial = windMaterial(1.0), grassMaterial = windMaterial(1.5);
function Batch({ geometry, items, material = painted, shadows = true }: { geometry: T.BufferGeometry; items: Instance[]; material?: T.Material; shadows?: boolean }) {
  const ref = useRef<T.InstancedMesh>(null);
  useLayoutEffect(() => { if (!ref.current) return; const t = new T.Object3D(); items.forEach((p, i) => { t.position.set(p.x, p.y, p.z); t.rotation.set(0, p.rotation, 0); t.scale.setScalar(p.scale); t.updateMatrix(); ref.current!.setMatrixAt(i, t.matrix); }); ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere(); }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadows} receiveShadow dispose={null}/>;
}
function Flock({ seed, count, blocked }: { seed: number; count: number; blocked: boolean }) {
  const bodies = useRef<T.InstancedMesh>(null), heads = useRef<T.InstancedMesh>(null), frightened = useRef(-100);
  const starts = useMemo(() => Array.from({ length: count }, (_, i) => propPosition(seed + 381, i, .22)), [seed, count]);
  const wasBlocked = useRef(blocked);
  useEffect(() => { if (blocked && !wasBlocked.current) frightened.current = windTime.value; wasBlocked.current = blocked; }, [blocked]);
  const transform = useMemo(() => new T.Object3D(), []), headTransform = useMemo(() => new T.Object3D(), []), product = useMemo(() => new T.Matrix4(), []);
  useFrame(() => {
    if (!bodies.current || !heads.current) return; const t = windTime.value;
    starts.forEach((start, i) => {
      const phase = seed + i * 2.7, cycle = t * .18 + phase, walking = Math.sin(cycle) > .2, panic = Math.max(0, 1 - (t - frightened.current) / 3.5);
      let x = start.x + Math.sin(cycle * .63) * .09 + panic * (start.x < 0 ? -.11 : .11), z = start.z + Math.cos(cycle * .71) * .07;
      if (!inHex(x, z, .18) || !outsideToken(x, z)) { x = start.x; z = start.z; }
      const angle = Math.sin(cycle * .48) * .55 + phase, scale = .67 + variation(i + seed) * .18;
      transform.position.set(x, .065 + (walking ? Math.sin(t * 5 + phase) * .003 : 0), z); transform.rotation.set(0, angle, 0); transform.scale.setScalar(scale); transform.updateMatrix(); bodies.current!.setMatrixAt(i, transform.matrix);
      const grazing = !walking ? (Math.sin(t * .7 + phase) + 1) * .20 : .05;
      headTransform.position.set(.163, .175 - grazing * .12, 0); headTransform.rotation.set(0, Math.sin(t * .44 + phase) * .13, -grazing); headTransform.scale.setScalar(1); headTransform.updateMatrix(); heads.current!.setMatrixAt(i, product.multiplyMatrices(transform.matrix, headTransform.matrix));
    }); bodies.current.instanceMatrix.needsUpdate = heads.current.instanceMatrix.needsUpdate = true;
  });
  return <><instancedMesh ref={bodies} args={[assets().sheep, painted, count]} castShadow receiveShadow frustumCulled={false}/><instancedMesh ref={heads} args={[assets().head, painted, count]} castShadow frustumCulled={false}/></>;
}
export function Vegetation({ hex, seed, quality, blocked, motion, preview = false }: { hex: Hex; seed: number; quality: WorldQuality; blocked: boolean; motion: boolean; preview?: boolean }) {
  const detail = WORLD_QUALITY[quality], resource = hex.resource, a = assets();
  const data = useMemo(() => {
    const trees = Array.from({ length: 4 }, () => [] as Instance[]), grass: Instance[] = [], flowers: Instance[] = [], crops: Instance[] = [], rocks: Instance[] = [];
    if (resource === 'wood') for (let i = 0; i < Math.ceil(detail.trees * .23); i++) { const p = propPosition(seed + 51, i, .27); trees[i % 4].push({ x: p.x, y: .066, z: p.z, rotation: i * 2.399, scale: .54 + variation(seed + i + 8) * .35 }); }
    if (!['ore','brick','desert'].includes(resource)) for (let i = 0; i < detail.grass; i++) { const p = propPosition(seed + 90, i, .09); grass.push({ x: p.x, y: .063, z: p.z, rotation: i * 2.4, scale: .45 + variation(i + seed) * .85 }); if (resource === 'wool' && i % 7 === 0) flowers.push({ x: p.x, y: .065, z: p.z, rotation: i, scale: .7 + variation(i) * .4 }); }
    if (resource === 'grain') {
      const spacing = quality === 'low' ? .115 : quality === 'medium' ? .087 : .073;
      for (let x = -.72; x < .73; x += spacing) for (let z = -.76; z < .67; z += spacing) {
        if (!inHex(x, z, .15) || !outsideToken(x, z) || (x > .13 && x < .21)) continue;
        const id = crops.length; crops.push({ x: x + (variation(id + seed) - .5) * .027, y: .061, z: z + (variation(id * 3 + seed) - .5) * .026, scale: .78 + variation(id + 14) * .36, rotation: variation(id + seed) * .4 });
      }
    }
    for (let i = 0; i < (resource === 'ore' ? 3 : resource === 'brick' ? 4 : 5); i++) { const p = propPosition(seed + 200, i, resource === 'ore' ? .26 : .17); rocks.push({ x: p.x, y: .052, z: p.z, scale: resource === 'ore' ? .65 + variation(seed + i) * .5 : resource === 'brick' ? .33 + variation(seed + i) * .28 : .065 + variation(seed + i) * .045, rotation: i * 2.2 }); }
    return { trees, grass, flowers, crops, rocks };
  }, [seed, detail, resource, quality]);
  const props = useMemo(() => {
    const s = new Sculpt();
    if (resource === 'wood') { s.add(new T.CylinderGeometry(.028, .035, .29, 9), '#7b674a', [-.34, .08, .28], [1, 1, 1], [0, 0, 1.5]); s.add(new T.CylinderGeometry(.024, .024, .008, 9), '#c5a77a', [-.195, .08, .28], [1, 1, 1], [0, 0, 1.5]); }
    if (resource === 'grain') { s.add(new T.CylinderGeometry(.095, .10, .19, 10), '#c7aa5e', [-.60, .15, .23], [1, 1, 1], [0, 0, Math.PI / 2]); for (let i = 0; i < 4; i++) s.box('#978667', [-.58 + i * .09, .11, -.64], [.013, .18, .015]); s.box('#b8a177', [-.445, .15, -.64], [.3, .017, .018]); }
    if (resource === 'brick') for (let i = 0; i < 10; i++) { const p = propPosition(seed, i, .1); s.box('#996b4d', [p.x, .067, p.z], [.04 + variation(i) * .11, .002, .008], [0, i * 2, 0]); }
    if (resource === 'desert') for (let i = 0; i < 6; i++) { const p = propPosition(seed, i); s.box('#9d9270', [p.x, .11, p.z], [.009, .10, .009], [0, i, .3]); s.box('#9d9270', [p.x + .013, .10, p.z], [.07, .007, .007], [0, i, .35]); }
    return s.parts.length ? s.finish() : null;
  }, [resource, seed]);
  return <group name={`biome-${hex.id}-${resource}`}>
    <Grounding hex={hex} seed={seed} quality={quality}/>
    {(resource === 'wood' || resource === 'ore') && <ImportedForest seed={seed} quality={quality} resource={resource}/>}
    {data.trees.map((items, i) => items.length ? <Batch key={i} geometry={a.trees[i]} items={items} material={treeMaterial} shadows={quality !== 'low'}/> : null)}
    {!!data.grass.length && <Batch geometry={a.grass} items={data.grass} material={grassMaterial} shadows={false}/>}
    {!!data.flowers.length && <Batch geometry={a.flower} items={data.flowers} material={grassMaterial} shadows={false}/>}
    {!!data.crops.length && <Batch geometry={a.wheat} items={data.crops} material={cropMaterial} shadows={quality === 'high'}/>}
    <Batch geometry={resource === 'brick' ? a.clay[seed % 2] : a.rocks[seed % 3]} items={data.rocks} shadows={quality !== 'low'}/>
    {resource === 'wool' && <><Flock seed={seed} count={preview ? detail.sheep : Math.max(1, detail.sheep - (quality === 'high' ? 3 : quality === 'medium' ? 2 : 1))} blocked={blocked}/>{!preview && <ImportedFlock seed={seed} quality={quality} blocked={blocked} motion={motion}/>}</>}
    {props && <mesh geometry={props} material={painted} castShadow receiveShadow/>}
  </group>;
}
