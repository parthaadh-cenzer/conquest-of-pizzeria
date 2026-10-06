import { useEffect, useMemo } from 'react';
import * as T from 'three';
import type { Board } from '../../../../../packages/game-engine/src/types';
import { coastLoop, type WorldQuality } from './math';
import { windTime } from './wind';
export function distanceField(board: Board, resolution = 192) {
  const loop = coastLoop(board), data = new Uint8Array(resolution * resolution * 4);
  for (let j = 0; j < resolution; j++) for (let i = 0; i < resolution; i++) {
    const x = (i / (resolution - 1) - .5) * 32, z = (j / (resolution - 1) - .5) * 32; let distance = 100;
    for (let k = 0; k < loop.length; k++) { const a = loop[k], b = loop[(k + 1) % loop.length], dx = b.x - a.x, dz = b.z - a.z; const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz))); distance = Math.min(distance, Math.hypot(x - a.x - dx * t, z - a.z - dz * t)); }
    const value = Math.min(255, Math.round(distance / 8 * 255)), offset = (j * resolution + i) * 4; data[offset] = data[offset + 1] = data[offset + 2] = value; data[offset + 3] = 255;
  }
  const texture = new T.DataTexture(data, resolution, resolution); texture.minFilter = texture.magFilter = T.LinearFilter; texture.needsUpdate = true; return texture;
}
export function Ocean({ board, quality }: { board: Board; quality: WorldQuality }) {
  const shore = useMemo(() => distanceField(board), [board]);
  useEffect(() => () => shore.dispose(), [shore]);
  const material = useMemo(() => new T.ShaderMaterial({ uniforms: { uTime: windTime, uShore: { value: shore }, uDetail: { value: quality === 'low' ? 0 : 1 } },
    vertexShader: `uniform float uTime; varying vec3 vWorld;
      void main(){vec3 p=position; p.z+=.021*sin(p.x*1.7+p.y*.6+uTime*.8)+.012*sin(p.x*.65-p.y*2.5+uTime*.65);vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `uniform float uTime; uniform float uDetail; uniform sampler2D uShore; varying vec3 vWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec2 p=vWorld.xz, drift=vec2(.86,.51)*uTime*.09;
        float depth=texture2D(uShore,p/32.+.5).r*8.;
        float n=noise(p*2.4+drift), fine=noise(p*11.-drift*2.);
        float wave=sin(p.x*4.+p.y*2.3+uTime*.8+n*2.3)*.5+.5;
        vec3 deep=vec3(.055,.17,.205),shallow=vec3(.23,.40,.38);
        vec3 color=mix(shallow,deep,smoothstep(.35,3.3,depth));
        color+=vec3(.035,.055,.055)*(n-.4)+vec3(.012,.026,.025)*wave;
        float shoreWave=sin(depth*15.-uTime*1.5+n*4.);
        float foam=smoothstep(.78,.98,shoreWave)*smoothstep(.30,.52,depth)*(1.-smoothstep(.62,1.1,depth));
        foam*=smoothstep(.22,.66,fine)*.62;
        float glint=pow(max(0.,sin(p.x*9.+uTime*.7+n*4.)*cos(p.y*13.-uTime*.5+fine)),22.)*(.018+.025*uDetail);
        color=mix(color,vec3(.65,.73,.65),foam)+glint;
        // Broad drifting cloud shade shares the same wind direction as the island.
        color*=.94+.06*noise(p*.18+drift*.17);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), [shore, quality]);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.32, 0]} material={material} receiveShadow name="ocean"><planeGeometry args={[120, 120, quality === 'low' ? 48 : 100, quality === 'low' ? 48 : 100]}/></mesh>;
}
