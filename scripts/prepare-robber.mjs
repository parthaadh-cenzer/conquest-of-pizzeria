import fs from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
globalThis.window = { URL };
globalThis.FileReader = class {
  result = null;
  onloadend = null;
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};
THREE.ImageLoader.prototype.load = function () { return { width: 1, height: 1 }; };
const clips = [];
let model;
for (const [file, name] of [['Laying Idle.fbx', 'rest'], ['Getting Up (3).fbx', 'rise'], ['Nervously Look Around.fbx', 'nervous'], ['Jumping Down.fbx', 'jump']]) {
  const bytes = fs.readFileSync(`assets/${file}`);
  const array = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const scene = new FBXLoader().parse(array, '');
  if (!model) model = scene;
  const clip = scene.animations.find(a => a.tracks.length);
  clip.name = name;
  // These exports share the same Mixamo skeleton; the Hips translation is kept for the authored move.
  clips.push(clip);
}
const colors = {
  Erika_Archer_Eyelashes_Mesh: '#584d3c',
  Erika_Archer_Clothes_Mesh: '#c3aa7e',
  Erika_Archer_Bow_Mesh: '#6e5e45',
  Erika_Archer_Arrow_Mesh: '#8a6e4e',
  Erika_Archer_Eyes_Mesh: '#302e29',
  Erika_Archer_Body_Mesh: '#c2ad83',
};
model.traverse(object => {
  if (!object.isMesh) return;
  object.material = new THREE.MeshStandardMaterial({ color: colors[object.name] ?? '#746a57', roughness: .9, side: THREE.DoubleSide });
  object.castShadow = true;
});
const result = await new GLTFExporter().parseAsync(model, { binary: true, animations: clips, trs: true, onlyVisible: true, maxTextureSize: 1024 });
fs.mkdirSync('apps/client/public/models', { recursive: true });
fs.writeFileSync('apps/client/public/models/robber.glb', Buffer.from(result));
console.log(`robber.glb: ${(result.byteLength / 1048576).toFixed(2)} MB; clips: ${clips.map(c => c.name).join(', ')}`);
