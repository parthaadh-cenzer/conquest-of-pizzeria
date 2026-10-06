import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'node:fs';
import path from 'node:path';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const file of fs.readdirSync('assets').filter(x => x.endsWith('.glb'))) {
  const doc = await io.read(path.resolve('assets', file));
  const root = doc.getRoot();
  const scenes = root.listScenes();
  const meshes = root.listMeshes().map((m, i) => ({ i, name: m.getName(), primitives: m.listPrimitives().map(p => ({ vertices: p.getAttribute('POSITION')?.getCount(), material: p.getMaterial()?.getName() })) }));
  console.log('\n##', file);
  console.log('scene roots:', scenes.flatMap(s => s.listChildren().map(n => n.getName())));
  console.log('meshes:', meshes.length, 'animations:', root.listAnimations().map(a => a.getName()));
  if (file.startsWith('hexlands') || file.startsWith('arena') || file.startsWith('sheep') || file.startsWith('experience')) console.log(JSON.stringify(meshes, null, 2));
  if (file.startsWith('forest') || file.startsWith('the_landscape')) {
    const names = root.listNodes().map(n => n.getName());
    const counts = new Map(); for (const n of names) { const key = n.replace(/\.\d+$/, ''); counts.set(key, (counts.get(key) ?? 0) + 1); }
    console.log('frequent node names:', [...counts].sort((a,b)=>b[1]-a[1]).slice(0,60));
    console.log('mesh sample:', meshes.slice(0,50));
  }
}
