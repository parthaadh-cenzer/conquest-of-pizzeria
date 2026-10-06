import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as T from 'three';
import { inHex, outsideToken, propPosition, variation, type WorldQuality } from './math';
import { windTime } from './wind';
import { asset } from '../../paths';

type Item = { x: number; y: number; z: number; rotation: number; scale: number };
function meshList(scene: T.Group) { const meshes: T.Mesh[] = []; scene.traverse(o => { if ((o as T.Mesh).isMesh) meshes.push(o as T.Mesh); }); return meshes; }

function InstancedSource({ source, items, shadows }: { source: T.Mesh; items: Item[]; shadows: boolean }) {
  const ref = useRef<T.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const dummy = new T.Object3D();
    items.forEach((item, i) => { dummy.position.set(item.x, item.y, item.z); dummy.rotation.y = item.rotation; dummy.scale.setScalar(item.scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[source.geometry, source.material, items.length]} castShadow={shadows} receiveShadow dispose={null}/>;
}

/** Geometry is taken from the supplied forest, without importing its full diorama or scene transforms. */
export function ImportedForest({ seed, quality, resource }: { seed: number; quality: WorldQuality; resource: 'wood' | 'ore' }) {
  const { scene } = useGLTF(asset('models/forest-selected.glb'));
  const source = useMemo(() => meshList(scene), [scene]);
  const trees = useMemo(() => Array.from({ length: resource === 'wood' ? quality === 'high' ? 25 : quality === 'medium' ? 19 : 11 : 0 }, (_, i) => {
    const p = propPosition(seed + 411, i, .30);
    return { x: p.x, y: .067, z: p.z, rotation: variation(seed * 19 + i) * Math.PI * 2, scale: .59 + variation(seed + i * 17) * .36 };
  }), [seed, quality, resource]);
  const first = useMemo(() => trees.filter((_, i) => i % 2 === 0), [trees]);
  const second = useMemo(() => trees.filter((_, i) => i % 2 === 1), [trees]);
  const boulders = useMemo(() => Array.from({ length: resource === 'ore' ? 5 : 2 }, (_, i) => {
    const p = propPosition(seed + 550, i, .25);
    return { x: p.x, y: .055, z: p.z, rotation: variation(seed + i * 29) * Math.PI * 2, scale: resource === 'ore' ? .12 + variation(i + seed) * .08 : .045 };
  }), [seed, resource]);
  return <group name={`supplied-${resource}-details`}>
    {source[0] && source[1] && <><InstancedSource source={source[0]} items={first} shadows={quality !== 'low'}/><InstancedSource source={source[1]} items={first} shadows={quality !== 'low'}/></>}
    {source[2] && source[3] && <><InstancedSource source={source[2]} items={second} shadows={quality !== 'low'}/><InstancedSource source={source[3]} items={second} shadows={quality !== 'low'}/></>}
    {source[4] && <InstancedSource source={source[4]} items={boulders} shadows={quality !== 'low'}/>}
  </group>;
}

export function ImportedTerrain({ resource }: { resource: 'brick' | 'grain' | 'wool' }) {
  const { scene } = useGLTF(asset('models/hexlands-selected.glb'));
  const source = useMemo(() => meshList(scene).find(m => {
    const material = Array.isArray(m.material) ? m.material[0] : m.material;
    return material.name === ({ brick: 'Clay', grain: 'Gold', wool: 'Pasture' }[resource]);
  }), [scene, resource]);
  const material = useMemo(() => {
    if (!source) return null;
    const original = Array.isArray(source.material) ? source.material[0] : source.material;
    const result = resource === 'wool' ? new T.MeshStandardMaterial({ color: '#94a66f', roughness: 1, side: T.DoubleSide }) : original.clone() as T.MeshStandardMaterial;
    if (resource === 'grain') result.color.set('#b4a274');
    result.roughness = 1;
    return result;
  }, [source, resource]);
  return source && material ? <mesh geometry={source.geometry} material={material} position={[0, .052, 0]} scale={[1, .27, 1]} receiveShadow castShadow={resource === 'brick'} dispose={null} name={`supplied-${resource}-ground`}/> : null;
}

function LivingSheep({ scene, clips, seed, index, blocked, motion }: { scene: T.Group; clips: T.AnimationClip[]; seed: number; index: number; blocked: boolean; motion: boolean }) {
  const group = useRef<T.Group>(null);
  const actor = useMemo(() => cloneSkinned(scene), [scene]);
  const mixer = useMemo(() => new T.AnimationMixer(actor), [actor]);
  const start = useMemo(() => propPosition(seed + 761, index, .25), [seed, index]);
  const prevBlocked = useRef(blocked), startled = useRef(-100);
  useEffect(() => { const idle = clips.find(c => c.name === 'idle'); if (idle) { const action = mixer.clipAction(idle); action.play(); action.time = index * .63 % Math.max(.1, idle.duration); } return () => { mixer.stopAllAction(); }; }, [mixer, clips, index]);
  useEffect(() => { if (blocked && !prevBlocked.current) { startled.current = windTime.value; const clip = clips.find(c => c.name === 'jump'); if (clip) mixer.clipAction(clip).reset().setLoop(T.LoopOnce, 1).play(); } prevBlocked.current = blocked; }, [blocked, clips, mixer]);
  useFrame((_, dt) => {
    if (motion) mixer.update(dt);
    const t = windTime.value, cycle = t * .35 + seed + index * 2.7, panic = Math.max(0, 1 - (t - startled.current) / 2.3);
    let x = start.x + Math.sin(cycle) * .065 + panic * (start.x < 0 ? -.11 : .11), z = start.z + Math.cos(cycle * .8) * .045;
    if (!inHex(x, z, .20) || !outsideToken(x, z)) { x = start.x; z = start.z; }
    if (group.current) { group.current.position.set(x, .073 + Math.max(0, Math.sin(cycle * 2)) * .006, z); group.current.rotation.y = cycle * .22 + index; }
  });
  return <group ref={group} position={[start.x, .073, start.z]} scale={.22} name={`animated-sheep-${seed}-${index}`}><primitive object={actor} dispose={null}/></group>;
}
export function ImportedFlock({ seed, quality, blocked, motion }: { seed: number; quality: WorldQuality; blocked: boolean; motion: boolean }) {
  const { scene, animations } = useGLTF(asset('models/sheep-development-only.glb'));
  const count = quality === 'high' ? 3 : quality === 'medium' ? 2 : 1;
  return <>{Array.from({ length: count }, (_, i) => <LivingSheep key={i} scene={scene} clips={animations} seed={seed} index={i} blocked={blocked} motion={motion}/>)}</>;
}

export function ImportedCaravel({ phase }: { phase: number }) {
  const { scene, animations } = useGLTF(asset('models/caravel-selected.glb'));
  const model = useMemo(() => {
    const instance = scene.clone(true);
    const box = new T.Box3().setFromObject(instance);
    const center = box.getCenter(new T.Vector3());
    instance.position.set(-center.x, -box.min.y, -center.z);
    instance.traverse(o => { if ((o as T.Mesh).isMesh) { (o as T.Mesh).castShadow = true; (o as T.Mesh).receiveShadow = true; } });
    return instance;
  }, [scene]);
  const mixer = useMemo(() => new T.AnimationMixer(model), [model]);
  useEffect(() => { const clip = animations.find(a => a.name === 'Sail'); if (clip) { const action = mixer.clipAction(clip); action.play(); action.time = phase % Math.max(.01, clip.duration); } return () => { mixer.stopAllAction(); }; }, [animations, mixer, phase]);
  useFrame((_, dt) => mixer.update(dt));
  return <group scale={.0075} rotation={[0, Math.PI, 0]} name="supplied-caravel"><primitive object={model} dispose={null}/></group>;
}

export function ImportedArena() {
  const { scene } = useGLTF(asset('models/dice-arena.glb'));
  const meshes = useMemo(() => meshList(scene), [scene]);
  return <group name="supplied-dice-arena" position={[0, -.61, 0]}>{meshes.map((mesh, i) => <mesh key={i} geometry={mesh.geometry} material={mesh.material} receiveShadow castShadow dispose={null}/>)}</group>;
}

export function ImportedRobber({ x, z, motion }: { x: number; z: number; motion: boolean }) {
  const { scene, animations } = useGLTF(asset('models/robber.glb'));
  const actor = useMemo(() => cloneSkinned(scene), [scene]);
  const mixer = useMemo(() => new T.AnimationMixer(actor), [actor]);
  const group = useRef<T.Group>(null), previous = useRef(`${x}:${z}`), movement = useRef(-100), lastNervous = useRef(0), state = useRef<'rest' | 'rise' | 'jump' | 'nervous'>('rest');
  const play = (name: typeof state.current) => {
    if (state.current === name) return;
    const next = animations.find(c => c.name === name); if (!next) return;
    const old = animations.find(c => c.name === state.current);
    if (old) mixer.clipAction(old).fadeOut(.18);
    const action = mixer.clipAction(next).reset().fadeIn(.18).play();
    action.setLoop(name === 'rest' ? T.LoopRepeat : T.LoopOnce, name === 'rest' ? Infinity : 1);
    action.clampWhenFinished = name !== 'rest'; state.current = name;
  };
  useEffect(() => { const rest = animations.find(c => c.name === 'rest'); if (rest) mixer.clipAction(rest).play(); return () => { mixer.stopAllAction(); }; }, [animations, mixer]);
  useEffect(() => { const at = `${x}:${z}`; if (previous.current !== at) { previous.current = at; movement.current = windTime.value; play('rise'); } }, [x, z]);
  useFrame((_, dt) => {
    if (!group.current) return;
    const age = windTime.value - movement.current;
    if (motion) mixer.update(dt);
    if (age >= .55 && age < 2 && state.current === 'rise') play('jump');
    if (age >= 2 && state.current !== 'rest') play('rest');
    if (age > 4 && windTime.value - lastNervous.current > 18 && state.current === 'rest') { lastNervous.current = windTime.value; play('nervous'); }
    if (state.current === 'nervous' && windTime.value - lastNervous.current > 2.4) play('rest');
    const target = new T.Vector3(x, .10, z);
    group.current.position.lerp(target, motion ? Math.min(1, dt * (age < 2 ? 2.3 : 8)) : 1);
    group.current.rotation.y = .25 + Math.sin(windTime.value * .45) * .045;
  });
  return <group ref={group} position={[x, .10, z]} scale={.0019} name="animated-robber"><primitive object={actor} dispose={null}/></group>;
}
