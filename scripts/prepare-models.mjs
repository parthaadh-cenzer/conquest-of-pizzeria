import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, simplify, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const output = path.resolve('apps/client/public/models');
fs.mkdirSync(output, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
async function selected(source, target, predicate, transform) {
  const doc = await io.read(path.resolve('assets', source));
  const nodes = doc.getRoot().listNodes().filter(n => n.getMesh());
  nodes.forEach((node, index) => {
    if (!predicate(node, index)) node.setMesh(null);
    else if (transform) transform(node, index);
  });
  await doc.transform(prune(), dedup());
  if (source.startsWith('sheep')) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: .12, error: 1 }));
  if (source.startsWith('sheep')) await doc.transform(quantize({ quantizePosition: 12, quantizeNormal: 8, quantizeTexcoord: 12, quantizeWeight: 8 }));
  if (source.startsWith('caravel')) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: .55, error: .012 }));
  await doc.transform(textureCompress({ encoder: sharp, resize: source.startsWith('arena') ? [1024, 1024] : [512, 512], quality: 82 }));
  const destination = path.join(output, target);
  await io.write(destination, doc);
  console.log(`${source} -> ${target}: ${(fs.statSync(destination).size / 1048576).toFixed(2)} MB`);
}

function normalizeSurface(node, centerX, centerY, scale, baseZ = 5) {
  for (const primitive of node.getMesh().listPrimitives()) {
    const position = primitive.getAttribute('POSITION');
    const normal = primitive.getAttribute('NORMAL');
    for (let i = 0; i < position.getCount(); i++) {
      const [x, y, z] = position.getElement(i, []);
      position.setElement(i, [(x - centerX) * scale, (z - baseZ) * scale, -(y - centerY) * scale]);
      if (normal) { const [nx, ny, nz] = normal.getElement(i, []); normal.setElement(i, [nx, nz, -ny]); }
    }
  }
  node.setTranslation([0, 0, 0]); node.setRotation([0, 0, 0, 1]); node.setScale([1, 1, 1]);
}

await selected('hexlands_set1.glb', 'hexlands-selected.glb', (n) => ['Clay', 'Pasture', 'Gold', 'Stone'].includes(n.getMesh().listPrimitives()[0].getMaterial()?.getName()), node => {
  const pos = node.getMesh().listPrimitives()[0].getAttribute('POSITION');
  const min = pos.getMin([]), max = pos.getMax([]);
  normalizeSurface(node, (min[0] + max[0]) / 2, (min[1] + max[1]) / 2, .019, 5);
});
await selected('arena.glb', 'dice-arena.glb', () => true, node => normalizeSurface(node, 368, 366, .004, 0));
await selected('the_landscape_is_a_forest_in_the_mountains.glb', 'forest-selected.glb', (_, index) => [0, 1, 2, 3, 16, 74, 75].includes(index), node => {
  node.setTranslation([0, 0, 0]); node.setRotation([0, 0, 0, 1]); node.setScale([1, 1, 1]);
});
await selected('caravel_ship.glb', 'caravel-selected.glb', node => /Hull|Deck|Mast|Boom|Sail|Flag|Rudder|Keel|Wheel|Fence/i.test(node.getMesh().getName()) && !/Pulley|Rope|Cannon|Barrel|Ladder|Anchor/i.test(node.getMesh().getName()));
await selected('sheep-test_non-commercial.glb', 'sheep-development-only.glb', () => true);
