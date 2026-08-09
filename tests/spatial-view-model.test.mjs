import assert from 'node:assert/strict';
import test from 'node:test';
import { compilePortfolio } from '../scripts/src/buildings/compiler.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { compileOwnedSpatialTargets } from '../scripts/src/ui/console/spatial-view-model.js';

test('跨建筑目标只汇总总部和已接管建筑的可见空间', () => {
  const state = createDefaultLandlordState();
  state.建筑列表.building_hospital_candidate.接管状态 = '已接管';
  const portfolio = compilePortfolio(state);
  const targets = compileOwnedSpatialTargets(portfolio, 'building_hospital_candidate');
  const buildingIds = new Set(targets.map(target => target.buildingId));
  assert.deepEqual([...buildingIds].sort(), ['building_headquarters', 'building_hospital_candidate']);
  assert.ok(targets.some(target => target.currentBuilding && target.buildingId === 'building_hospital_candidate'));
  assert.ok(targets.some(target => !target.currentBuilding && target.buildingId === 'building_headquarters'));
  assert.ok(!targets.some(target => target.buildingId === 'building_office_candidate'));
});

test('跨建筑目标保留建筑、楼层和空间的完整显示定位', () => {
  const state = createDefaultLandlordState();
  state.建筑列表.building_hospital_candidate.接管状态 = '已接管';
  const targets = compileOwnedSpatialTargets(compilePortfolio(state), 'building_headquarters');
  const ward = targets.find(target => target.id === 'hospital_ward');
  assert.equal(ward.buildingName, '白塔社区医院');
  assert.equal(ward.floorName, '三楼·住院部');
  assert.equal(ward.currentBuilding, false);
  assert.equal(Object.isFrozen(targets), true);
  assert.equal(Object.isFrozen(ward), true);
});
