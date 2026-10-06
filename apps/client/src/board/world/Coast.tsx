import { useMemo } from 'react';
import * as T from 'three';
import type { Board } from '../../../../../packages/game-engine/src/types';
import { coastLoop, variation, type WorldQuality } from './math';
import { Sculpt } from './assets';
function shoreline(board: Board) {
  const loop = coastLoop(board), samples: { x: number; z: number; nx: number; nz: number; seed: number }[] = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length], prev = loop[(i + loop.length - 1) % loop.length], next = loop[(i + 2) % loop.length];
    for (let step = 0; step < 8; step++) { const t = step / 8;
      const nx = (b.z - prev.z) * (1 - t) + (next.z - a.z) * t, nz = -(b.x - prev.x) * (1 - t) - (next.x - a.x) * t, length = Math.hypot(nx, nz);
      samples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, nx: nx / length, nz: nz / length, seed: i * 8 + step });
    }
  }
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const bands = [{ offset: -.012, y: .048, color: '#a1a17b' }, { offset: .12, y: .015, color: '#b8ac7f' }, { offset: .31, y: -.14, color: '#c8b58c' }, { offset: .49, y: -.38, color: '#999985' }, { offset: .51, y: -.75, color: '#6c776f' }];
  for (let layer = 0; layer < bands.length; layer++) for (const p of samples) {
    const b = bands[layer], ragged = layer ? Math.sin(p.x * 12 + p.z * 5) * .044 + Math.sin(p.z * 16 - p.x * 3) * .028 : 0;
    const width = b.offset + ragged, c = new T.Color(b.color).multiplyScalar(.87 + variation(p.seed * 3 + layer) * .24);
    positions.push(p.x + p.nx * width, b.y + (layer && layer < 3 ? Math.sin(p.seed * .6) * .027 : 0), p.z + p.nz * width); colors.push(c.r, c.g, c.b);
  }
  const count = samples.length;
  for (let l = 0; l < bands.length - 1; l++) for (let i = 0; i < count; i++) { const a = l * count + i, b = l * count + (i + 1) % count, c = a + count, d = b + count; indices.push(a, b, c, b, d, c); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals();
  return { geometry: g, samples };
}
export function Coast({ board, quality }: { board: Board; quality: WorldQuality }) {
  const data = useMemo(() => shoreline(board), [board]);
  const rocks = useMemo(() => { const s = new Sculpt();
    for (let i = 0; i < data.samples.length; i += quality === 'low' ? 4 : 2) {
      const p = data.samples[i]; if (variation(i + 33) < .36) continue;
      const size = .045 + variation(i * 5) * .13, offset = .18 + variation(i + 3) * .29;
      s.add(new T.IcosahedronGeometry(1, 1), ['#8c9080', '#a2a38e', '#7b837c', '#b8ac91'][i % 4], [p.x + p.nx * offset, -.10 - offset * .18, p.z + p.nz * offset], [size * 1.4, size * .85, size], [i, i * .7, 0]);
    } return s.finish();
  }, [data, quality]);
  return <group name="coastline"><mesh geometry={data.geometry} receiveShadow><meshStandardMaterial vertexColors roughness={1} side={T.DoubleSide}/></mesh><mesh geometry={rocks} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.95}/></mesh></group>;
}
