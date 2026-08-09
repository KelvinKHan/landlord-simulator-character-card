import assert from 'node:assert/strict';
import test from 'node:test';
import { compileBuilding } from '../scripts/src/buildings/compiler.js';
import { createBuildingLayout } from '../scripts/src/buildings/layout-engine.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';

function overlaps(left, right) {
  const epsilon = 0.002;
  return left.x < right.x + right.w - epsilon && left.x + left.w > right.x + epsilon && left.y < right.y + right.h - epsilon && left.y + left.h > right.y + epsilon;
}

test('数字孪生布局稳定、不重叠并且始终位于楼层边界内', () => {
  const state = createDefaultLandlordState();
  const compiled = compileBuilding('building_headquarters', state.建筑列表.building_headquarters, state.人物列表);
  const first = createBuildingLayout(compiled);
  const second = createBuildingLayout(compiled);
  assert.deepEqual(first, second);
  assert.equal(first.metrics.nodes, compiled.metrics.spaces);
  for (const floor of first.floors) {
    for (const node of floor.nodes) {
      assert.ok(node.x >= 0 && node.y >= 0);
      assert.ok(node.w > 0 && node.h > 0);
      assert.ok(node.x + node.w <= 100.002);
      assert.ok(node.y + node.h <= 100.002);
    }
    for (let left = 0; left < floor.nodes.length; left += 1) {
      for (let right = left + 1; right < floor.nodes.length; right += 1) assert.equal(overlaps(floor.nodes[left], floor.nodes[right]), false);
    }
  }
});

test('数字孪生只为同楼层的已知相邻空间创建唯一连接', () => {
  const state = createDefaultLandlordState();
  const compiled = compileBuilding('building_headquarters', state.建筑列表.building_headquarters, {});
  const twin = createBuildingLayout(compiled);
  const ground = twin.floors.find(floor => floor.id === 'floor_1');
  const keys = ground.edges.map(edge => edge.id);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes('garden::living_room'));
  assert.ok(keys.includes('garden::pool'));
  assert.ok(keys.includes('kitchen::living_room'));
});
