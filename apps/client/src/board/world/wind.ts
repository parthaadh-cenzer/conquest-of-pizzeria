import * as T from 'three';
export const windTime = { value: 0 };
/** Shared direction and gust field used by vegetation, flags, water and boats. */
export const WIND = { x: .86, z: .51, base: .65 };
export function windStrength(time: number, x: number, z: number) { return .55 + .19 * Math.sin(time * .47 - x * .65 - z * .35) + .12 * Math.sin(time * .13); }
export function windMaterial(strength: number) {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: .93, side: T.DoubleSide });
  m.onBeforeCompile = shader => {
    shader.uniforms.uWorldTime = windTime;
    shader.vertexShader = `uniform float uWorldTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec4 anchor = vec4(0.0,0.0,0.0,1.0);
      #ifdef USE_INSTANCING
      anchor = instanceMatrix * anchor;
      #endif
      anchor = modelMatrix * anchor;
      float gust = .55 + .19*sin(uWorldTime*.47-anchor.x*.65-anchor.z*.35)+.12*sin(uWorldTime*.13);
      float sway = sin(uWorldTime*1.4-anchor.x*1.8-anchor.z*.9)*gust*${strength.toFixed(4)};
      transformed.x += sway*position.y*position.y*.86;
      transformed.z += sway*position.y*position.y*.51;
    `);
  };
  m.customProgramCacheKey = () => `morrow-wind-${strength}`;
  return m;
}
