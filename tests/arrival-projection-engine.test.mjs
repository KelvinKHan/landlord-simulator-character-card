import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { managementMockRecipes } from '../scripts/src/mock/management-recipes.js';
import { compileArrivalProjection } from '../scripts/src/tenants/arrival-projection-engine.js';

async function candidateFor(state, buildingId = 'building_headquarters') {
  const building = state.建筑列表[buildingId];
  return (await managementMockRecipes.recruitment({ building })).candidates[0];
}

test('入住预演计算候选人的空间契合和脉冲变化但不修改状态', async () => {
  const state = createDefaultLandlordState();
  const candidate = await candidateFor(state);
  const snapshot = structuredClone(state);
  const projection = compileArrivalProjection(state, 'building_headquarters', 'living_room', candidate);

  assert.equal(projection.candidate.name, '林夏');
  assert.equal(projection.spaceName, '客厅');
  assert.ok(projection.fit >= 0 && projection.fit <= 100);
  assert.ok(projection.pulseDelta.roomVitality > 0);
  assert.equal(projection.roommates.length, 0);
  assert.equal(projection.sparks.length, 0);
  assert.deepEqual(state, snapshot);
  assert.equal(state.人物列表[candidate.id], undefined);
  assert.ok(Object.isFrozen(projection));
});

test('入住预演只和目标房间里的真实人物生成潜在相遇', async () => {
  const state = createDefaultLandlordState();
  state.人物列表.existing = { 姓名: '邵青', 来源世界: '东方奇幻世界', 身份类型: '租客', 职业: '灵植师', 所在建筑ID: 'building_headquarters', 所在空间ID: 'living_room', 外貌: '', 性格: '安静好奇', 状态: '', 内心: '', 感知度: 100, 视觉身份: { 主色: '#55B7A5' }, 关系: {} };
  state.建筑列表.building_headquarters.空间列表.living_room.占用者.existing = '租客';
  const candidate = await candidateFor(state);
  const projection = compileArrivalProjection(state, 'building_headquarters', 'living_room', candidate);

  assert.deepEqual(projection.roommates.map(person => person.name), ['邵青']);
  assert.equal(projection.sparks.length, 1);
  assert.equal(projection.sparks[0].otherName, '邵青');
  assert.match(projection.sparks[0].title, /林夏.*邵青|邵青.*林夏/);
});

test('入住预演拒绝未知空间和未接管建筑', async () => {
  const state = createDefaultLandlordState();
  const candidate = await candidateFor(state);
  assert.equal(compileArrivalProjection(state, 'building_headquarters', 'unknown', candidate), null);
  assert.equal(compileArrivalProjection(state, 'building_hospital_candidate', 'hospital_ward', candidate), null);
});
