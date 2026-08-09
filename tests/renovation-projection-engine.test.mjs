import assert from 'node:assert/strict';
import test from 'node:test';
import { compileBuilding } from '../scripts/src/buildings/compiler.js';
import { createBuildingLayout } from '../scripts/src/buildings/layout-engine.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { managementMockRecipes } from '../scripts/src/mock/management-recipes.js';
import { compileRenovationProjection } from '../scripts/src/renovation/projection-engine.js';

test('装修投影只替换目标节点视觉并保持数字孪生输入不变', async () => {
  const state = createDefaultLandlordState();
  const building = compileBuilding('building_headquarters', state.建筑列表.building_headquarters, {});
  const twin = createBuildingLayout(building);
  const space = building.floors.flatMap(floor => floor.spaces).find(item => item.id === 'living_room');
  const plans = (await managementMockRecipes.renovation({ building, space })).plans;
  const snapshot = structuredClone(twin);
  const projection = compileRenovationProjection(twin, space.id, plans[1], building.theme.主色);
  const projected = projection.nodes.find(node => node.id === space.id);
  const untouched = projection.nodes.find(node => node.id === 'kitchen');
  const originalUntouched = twin.floors.flatMap(floor => floor.nodes).find(node => node.id === 'kitchen');

  assert.equal(projected.projected, true);
  assert.notEqual(projection.before.signature, projection.after.signature);
  assert.equal(untouched.visual.signature, originalUntouched.visual.signature);
  assert.equal(projection.floorName, '一楼');
  assert.deepEqual(twin, snapshot);
  assert.ok(Object.isFrozen(projection));
  assert.ok(Object.isFrozen(projection.nodes));
});

test('装修投影拒绝不存在的目标而不猜造空间', () => {
  assert.equal(compileRenovationProjection({ floors: [] }, 'unknown', { id: 'plan' }), null);
});
