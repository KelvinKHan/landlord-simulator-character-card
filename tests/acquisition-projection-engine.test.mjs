import assert from 'node:assert/strict';
import test from 'node:test';
import { compileAcquisitionProjection, applyAcquisitionDirection } from '../scripts/src/buildings/acquisition-projection-engine.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { managementMockRecipes } from '../scripts/src/mock/management-recipes.js';

test('接管预演升级建筑身份和版图链路但不修改原状态', async () => {
  const state = createDefaultLandlordState();
  const direction = (await managementMockRecipes.takeover({ building: { type: '医院' } })).directions[0];
  const snapshot = structuredClone(state);
  const projection = compileAcquisitionProjection(state, 'building_hospital_candidate', direction);

  assert.equal(projection.before.name, '白塔社区医院');
  assert.equal(projection.after.name, '白塔治愈生活馆');
  assert.deepEqual(projection.network, { before: '接管机会', after: '运营交通', beforeStatus: '可接管', afterStatus: '已接管' });
  assert.equal(projection.deltas.owned, 1);
  assert.equal(projection.deltas.activeRoutes, 1);
  assert.equal(projection.after.awareness, 100);
  assert.deepEqual(state, snapshot);
  assert.ok(Object.isFrozen(projection));
});

test('接管预演和正式接管共用同一建筑身份变换', async () => {
  const state = createDefaultLandlordState();
  const direction = (await managementMockRecipes.takeover({ building: { type: '写字楼' } })).directions[0];
  const projection = compileAcquisitionProjection(state, 'building_office_candidate', direction);
  const applied = applyAcquisitionDirection(structuredClone(state.建筑列表.building_office_candidate), direction);

  assert.equal(applied.名称, projection.after.name);
  assert.equal(applied.简介, projection.after.description);
  assert.equal(applied.主题.主色, projection.after.color);
  assert.equal(applied.经营摘要.今日亮点, projection.after.highlight);
});

test('不可接管建筑不会生成接管预演', () => {
  const state = createDefaultLandlordState();
  state.建筑列表.building_hospital_candidate.接管状态 = '已接管';
  assert.equal(compileAcquisitionProjection(state, 'building_hospital_candidate', { id: 'direction' }), null);
  assert.throws(() => applyAcquisitionDirection(state.建筑列表.building_hospital_candidate), /不可接管/);
});
