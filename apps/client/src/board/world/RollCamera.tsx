import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as T from 'three';

const ease = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
/** Local presentation only; the dice values always come from the authoritative game state. */
export function RollCamera({ roll, arenaX, controls, motion, intro }: { roll: number; arenaX: number; controls: RefObject<React.ComponentRef<typeof OrbitControls> | null>; motion: boolean; intro: boolean }) {
  const { camera } = useThree();
  const previous = useRef(roll), elapsed = useRef(99), start = useRef(new T.Vector3()), startTarget = useRef(new T.Vector3());
  const focus = useRef(new T.Vector3()), destination = useRef(new T.Vector3());
  useEffect(() => {
    if (roll === previous.current || !motion || intro) { previous.current = roll; return; }
    previous.current = roll; elapsed.current = 0;
    start.current.copy(camera.position); startTarget.current.copy(controls.current?.target ?? new T.Vector3());
    focus.current.set(arenaX, .10, 0);
    destination.current.set(arenaX, 3.0, 3.15);
    if (controls.current) controls.current.enabled = false;
  }, [roll, motion, intro, arenaX, camera, controls]);
  useFrame((_, dt) => {
    if (elapsed.current >= 2.5) return;
    elapsed.current += dt;
    const t = elapsed.current;
    const weight = t < .52 ? ease(t / .52) : t < 1.8 ? 1 : 1 - ease((t - 1.8) / .7);
    camera.position.copy(start.current).lerp(destination.current, weight);
    if (controls.current) { controls.current.target.copy(startTarget.current).lerp(focus.current, weight); controls.current.update(); }
    else camera.lookAt(startTarget.current.clone().lerp(focus.current, weight));
    if (t >= 2.5) { elapsed.current = 99; if (controls.current) controls.current.enabled = true; }
  });
  return null;
}
