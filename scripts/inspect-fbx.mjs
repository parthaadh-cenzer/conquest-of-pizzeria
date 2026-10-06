import fs from 'node:fs';
import * as T from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
globalThis.window = { URL };
T.ImageLoader.prototype.load = function () { return { width: 1, height: 1 }; };
for (const file of fs.readdirSync('assets').filter(x => x.endsWith('.fbx'))) {
  const b = fs.readFileSync(`assets/${file}`), a = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), o = new FBXLoader().parse(a, '');
  const meshes = [], bones = [], box = new T.Box3().setFromObject(o);
  o.traverse(x => { if (x.isSkinnedMesh) meshes.push({ name: x.name, verts: x.geometry.attributes.position.count, materials: (Array.isArray(x.material) ? x.material : [x.material]).map(m => m?.name), skeleton: x.skeleton.bones.length }); if (x.isBone) bones.push(x.name); });
  console.log(JSON.stringify({ file, meshes, boneCount: bones.length, boneSample: bones.slice(0, 15), box: { min: box.min.toArray(), max: box.max.toArray() }, animations: o.animations.map(a => ({ name: a.name, duration: a.duration, tracks: a.tracks.length, sample: a.tracks[0]?.name })) }, null, 2));
}
