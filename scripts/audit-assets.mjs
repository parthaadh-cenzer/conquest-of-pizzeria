import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('assets');
for (const file of fs.readdirSync(root).filter(name => name.endsWith('.glb'))) {
  const bytes = fs.readFileSync(path.join(root, file));
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const counts = { nodes: json.nodes?.length ?? 0, meshes: json.meshes?.length ?? 0, materials: json.materials?.length ?? 0, textures: json.textures?.length ?? 0, images: json.images?.length ?? 0, animations: json.animations?.length ?? 0, skins: json.skins?.length ?? 0 };
  const meshInfo = (json.meshes ?? []).map((mesh, index) => ({ index, name: mesh.name ?? '', primitives: mesh.primitives?.length ?? 0, triangles: (mesh.primitives ?? []).reduce((n, p) => n + Math.floor((json.accessors?.[p.indices]?.count ?? json.accessors?.[p.attributes.POSITION]?.count ?? 0) / 3), 0) }));
  console.log(JSON.stringify({ file, sizeMB: +(bytes.length / 1048576).toFixed(1), counts, extensions: json.extensionsUsed ?? [], scenes: (json.scenes ?? []).map(s => ({ name: s.name, roots: s.nodes })), nodes: (json.nodes ?? []).map((n, index) => ({ index, name: n.name, mesh: n.mesh, skin: n.skin, children: n.children?.length })).filter(n => n.name || n.mesh !== undefined).slice(0, 120), meshes: meshInfo.slice(0, 120), animations: (json.animations ?? []).map(a => ({ name: a.name, channels: a.channels?.length, samplers: a.samplers?.length })) }, null, 2));
}
