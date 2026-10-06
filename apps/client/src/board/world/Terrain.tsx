import { useMemo } from 'react';
import * as T from 'three';
import type { Hex } from '../../../../../packages/game-engine/src/types';
import { variation } from './math';
import { windTime } from './wind';
import { ImportedTerrain } from './ImportedWorld';
const PALETTE = { wood: '#6f7c4d', wool: '#9ba66e', grain: '#bb9c51', ore: '#9a967f', brick: '#bf885e', desert: '#cbb58a' };
function terrain(hex: Hex, seed: number) {
  const positions: number[] = [0, .075, 0], colors: number[] = [], indices: number[] = [], sides = 48, rings = 9;
  const base = new T.Color(PALETTE[hex.resource]); colors.push(base.r, base.g, base.b);
  for (let ring = 1; ring <= rings; ring++) for (let k = 0; k < sides; k++) {
    const side = Math.floor(k / 8), t = (k % 8) / 8, aa = (side * 60 - 30) * Math.PI / 180, ba = ((side + 1) * 60 - 30) * Math.PI / 180;
    const x = (Math.cos(aa) * (1 - t) + Math.cos(ba) * t) * ring / rings, z = (Math.sin(aa) * (1 - t) + Math.sin(ba) * t) * ring / rings;
    const fade = Math.pow(1 - ring / rings, .7), noise = Math.sin(x * 12 + seed) * Math.cos(z * 11 - seed) * .015;
    const dunes = hex.resource === 'desert' ? Math.sin(x * 9 + z * 4 + seed) * .043 : 0;
    positions.push(x, .051 + fade * (.025 + noise + dunes), z);
    const tint = 1 + noise * 2 + (variation(seed + ring * sides + k) - .5) * .095 + (hex.resource === 'desert' ? dunes * 1.6 : 0); const c = base.clone().multiplyScalar(tint);
    if (ring === rings) c.lerp(new T.Color('#b8aa82'), .56);
    colors.push(c.r, c.g, c.b);
  }
  for (let k = 0; k < sides; k++) indices.push(0, 1 + (k + 1) % sides, 1 + k);
  for (let r = 0; r < rings - 1; r++) for (let k = 0; k < sides; k++) { const a = 1 + r * sides + k, b = 1 + r * sides + (k + 1) % sides, c = a + sides, d = b + sides; indices.push(a, b, c, b, d, c); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
function groundMaterial() {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide });
  m.onBeforeCompile = shader => {
    shader.uniforms.uWorldTime = windTime;
    shader.vertexShader = 'varying vec3 vGround;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = (modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader = 'varying vec3 vGround; uniform float uWorldTime;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float grain = fract(sin(dot(floor(vGround.xz*145.),vec2(12.9898,78.233)))*43758.5453);
      float cloud = smoothstep(.2,.8,sin(vGround.x*.45+vGround.z*.3+uWorldTime*.032)*sin(vGround.z*.6-uWorldTime*.02));
      diffuseColor.rgb *= (.96+grain*.08)*(1.-cloud*.10);`);
  }; return m;
}
const material = groundMaterial();
export function Terrain({ hex, seed }: { hex: Hex; seed: number }) { const geometry = useMemo(() => terrain(hex, seed), [hex.resource, seed]); return <group name={`ground-${hex.id}`}><mesh geometry={geometry} material={material} receiveShadow/>{(hex.resource === 'brick' || hex.resource === 'grain' || hex.resource === 'wool') && <ImportedTerrain resource={hex.resource}/>}</group>; }
