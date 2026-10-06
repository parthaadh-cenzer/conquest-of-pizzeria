import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as T from 'three';
import { INTRO_DURATION, smooth, variation } from './math';
import { windTime } from './wind';

/** A local presentation clock. It never sends an intent or consumes game entropy. */
export function WorldClock({ time, active, motion, done }: { time: RefObject<number>; active: boolean; motion: boolean; done?: () => void }) {
  const elapsed = useRef(-1), completed = useRef(false);
  useEffect(() => { elapsed.current = -1; completed.current = false; time.current = active ? 0 : 99; }, [active, time]);
  useFrame((_, dt) => {
    if (motion) windTime.value += Math.min(dt, .05);
    if (!active) { time.current = 99; return; }
    elapsed.current = elapsed.current < 0 ? 0 : elapsed.current + dt; time.current = motion ? elapsed.current : 99;
    if ((time.current >= INTRO_DURATION) && !completed.current) { completed.current = true; done?.(); }
  }, -2);
  return null;
}

export function CameraRig({ reset, grand, preview, active, time }: { reset: number; grand: boolean; preview: boolean; active: boolean; time: RefObject<number> }) {
  const { camera, size } = useThree(), destination = useRef(new T.Vector3()), look = useRef(new T.Vector3());
  useEffect(() => {
    const compact = size.height < 420 && !preview, distance = compact ? grand ? 11.5 : 8.8 : grand ? 15.8 : 12.4;
    const ratio = Math.max(1, 1.3 / (size.width / size.height));
    destination.current.set(preview ? -1.3 : 0, distance * ratio * (compact ? .52 : .8), distance * ratio * (compact ? .93 : .8));
    if (!active) { camera.position.copy(destination.current); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); }
  }, [camera, reset, grand, preview, size.width, size.height, active]);
  useFrame(() => {
    if (!active) return;
    const t = smooth(time.current / INTRO_DURATION), d = destination.current;
    camera.position.set(d.x - (1 - t) * 4.6, d.y + (1 - t) * 8.0, d.z + (1 - t) * 6.5);
    look.current.set((1 - t) * .5, 0, (1 - t) * 1.2); camera.lookAt(look.current);
  }, -1);
  return null;
}

/** Soft procedural cloud billboards; no downloaded or generated backdrop. */
function cloudTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; const c = canvas.getContext('2d')!;
  for (let i = 0; i < 28; i++) {
    const x = 52 + variation(i + 6) * 152, y = 74 + variation(i + 40) * 109, r = 29 + variation(i + 90) * 35;
    const gradient = c.createRadialGradient(x, y, 0, x, y, r); gradient.addColorStop(0, 'rgba(239,235,217,.40)'); gradient.addColorStop(.5, 'rgba(219,226,215,.23)'); gradient.addColorStop(1, 'rgba(204,220,214,0)'); c.fillStyle = gradient; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}
export function Atmosphere({ time, grand, low }: { time: RefObject<number>; grand: boolean; low: boolean }) {
  const texture = useMemo(cloudTexture, []), ref = useRef<T.Group>(null), { camera } = useThree();
  const forward = useMemo(() => new T.Vector3(), []), right = useMemo(() => new T.Vector3(), []), up = useMemo(() => new T.Vector3(), []), center = useMemo(() => new T.Vector3(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    if (!ref.current) return; const intro = 1 - smooth((time.current - 1.0) / 2.8), extent = grand ? 11 : 8;
    camera.getWorldDirection(forward); right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1); center.copy(camera.position).addScaledVector(forward, 9);
    ref.current.children.forEach((child, i) => {
      const a = i * 2.3999 + windTime.value * .002, r = extent * (1 - intro * .83), mesh = child as T.Mesh;
      mesh.position.set(Math.cos(a) * r + Math.sin(i) * intro * 3, 2.4 + intro * (5 + i % 3), Math.sin(a) * r);
      if (intro > 0) { const x = (variation(i + 80) - .5) * 8, y = (variation(i + 40) - .5) * 4; mesh.position.multiplyScalar(1 - intro).addScaledVector(center, intro).addScaledVector(right, x * intro).addScaledVector(up, y * intro); }
      mesh.quaternion.copy(camera.quaternion); mesh.scale.set(8 + intro * 6, 4 + intro * 6, 1);
      const distance = camera.position.length(), cloudLod = smooth((distance - 16) / 7);
      (mesh.material as T.MeshBasicMaterial).opacity = cloudLod * .29 + intro * .90;
    });
  });
  return <group ref={ref} name="drifting-clouds">{Array.from({ length: low ? 6 : 10 }, (_, i) => <mesh key={i} renderOrder={3}><planeGeometry args={[1, 1]}/><meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0}/></mesh>)}</group>;
}

export function Reveal({ time, at, children, flip = false }: { time: RefObject<number>; at: number; children: ReactNode; flip?: boolean }) {
  const ref = useRef<T.Group>(null);
  useFrame(() => {
    if (!ref.current) return; const raw = (time.current - at) / (flip ? .8 : .48), p = smooth(raw);
    if (flip) { ref.current.rotation.x = (1 - p) * Math.PI; ref.current.position.y = Math.sin(p * Math.PI) * .22; }
    else { ref.current.scale.setScalar(Math.max(.0001, p)); ref.current.position.y = (1 - p) * -.025; ref.current.visible = p > .001; }
  });
  return <group ref={ref}>{children}</group>;
}

export function TileBack({ time, at }: { time: RefObject<number>; at: number }) {
  const ref = useRef<T.Mesh>(null);
  useFrame(() => { if (ref.current) ref.current.visible = time.current < at + .39; });
  return <mesh ref={ref} position={[0, -.053, 0]}><cylinderGeometry args={[.997, .997, .10, 6]}/><meshStandardMaterial color="#b6ab8c" roughness={.98}/></mesh>;
}

/** HTML labels need their own reveal; ancestor mesh visibility does not hide DOM overlays. */
export function useLabelReveal(time: RefObject<number>, at: number) {
  const ref = useRef<HTMLDivElement>(null);
  useFrame(() => { if (ref.current) { const p = smooth((time.current - at) / .35); ref.current.style.opacity = String(p); ref.current.style.visibility = p > .01 ? 'visible' : 'hidden'; } });
  return ref;
}
