import { useLayoutEffect, useMemo, useRef } from 'react';
import * as T from 'three';
import { propPosition, WORLD_QUALITY, type WorldQuality } from './math';
import type { Hex } from '../../../../../packages/game-engine/src/types';
let shadowMaterial: T.MeshBasicMaterial | undefined;
function material() {
  if (shadowMaterial) return shadowMaterial;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(39,45,32,.43)'); gradient.addColorStop(.45, 'rgba(44,48,34,.22)'); gradient.addColorStop(1, 'rgba(44,48,34,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  return shadowMaterial = new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
}
const plane = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
/** Shared soft grounding survives LOW mode with zero shadow-map passes. */
export function Grounding({ hex, seed, quality }: { hex: Hex; seed: number; quality: WorldQuality }) {
  const ref = useRef<T.InstancedMesh>(null), detail = WORLD_QUALITY[quality];
  const marks = useMemo(() => {
    const count = hex.resource === 'wood' ? detail.trees : hex.resource === 'ore' ? 3 : hex.resource === 'brick' ? 4 : hex.resource === 'wool' ? detail.sheep : 0;
    return Array.from({ length: count }, (_, i) => {
      const resource = hex.resource, p = propPosition(resource === 'wood' ? seed + 51 : resource === 'wool' ? seed + 381 : seed + 200, i, resource === 'wood' ? .27 : resource === 'ore' ? .26 : resource === 'wool' ? .22 : .17);
      return { ...p, size: resource === 'wood' ? .65 : resource === 'ore' ? .95 : resource === 'brick' ? .52 : .32 };
    });
  }, [hex.resource, seed, detail]);
  useLayoutEffect(() => { const o = new T.Object3D(); marks.forEach((p, i) => { o.position.set(p.x, .081, p.z); o.scale.set(p.size, 1, p.size); o.updateMatrix(); ref.current?.setMatrixAt(i, o.matrix); }); if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere(); } }, [marks]);
  return marks.length ? <instancedMesh ref={ref} args={[plane, material(), marks.length]} dispose={null} renderOrder={1}/> : null;
}
