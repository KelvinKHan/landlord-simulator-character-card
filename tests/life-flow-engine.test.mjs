import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { compileLifeFlows } from '../scripts/src/tenants/life-flow-engine.js';

function ownHospital(state) {
  state.建筑列表.building_hospital_candidate.接管状态 = '已接管';
  state.建筑列表.building_hospital_candidate.感知度 = 100;
}

function addPerson(state, id, { name, profession, personality, buildingId, spaceId, color }) {
  state.人物列表[id] = {
    姓名: name, 来源世界: profession.includes('灵') ? '东方幻想' : '近未来都市', 身份类型: '租客', 职业: profession, 性格: personality,
    所在建筑ID: buildingId, 所在空间ID: spaceId, 内心: '正在观察环境', 视觉身份: { 主色: color },
  };
  state.建筑列表[buildingId].空间列表[spaceId].占用者[id] = '租客';
}

test('24H 生活流线只读编译真实可达落点', () => {
  const state = createDefaultLandlordState();
  ownHospital(state);
  addPerson(state, 'person_photo', { name: '林夏', profession: '自然摄影师', personality: '安静敏锐', buildingId: 'building_hospital_candidate', spaceId: 'hospital_ward', color: '#6B8DC9' });
  const snapshot = structuredClone(state);
  const center = compileLifeFlows(state);
  const flow = center.residents[0];

  assert.equal(flow.stops.length, 4);
  assert.equal(flow.transitions.length, 3);
  assert.deepEqual(flow.stops.map(stop => stop.phase), ['origin', 'day', 'evening', 'return']);
  assert.ok(flow.stops.every(stop => state.建筑列表[stop.buildingId].空间列表[stop.spaceId]));
  assert.ok(flow.transitions.every(transition => transition.code !== 'ROUTE_UNKNOWN'));
  assert.deepEqual(state, snapshot);
  assert.ok(Object.isFrozen(center));
});

test('人流波形在每个时段都守恒且记录跨建筑交通', () => {
  const state = createDefaultLandlordState();
  ownHospital(state);
  addPerson(state, 'person_photo', { name: '林夏', profession: '自然摄影师', personality: '安静敏锐', buildingId: 'building_hospital_candidate', spaceId: 'hospital_ward', color: '#6B8DC9' });
  addPerson(state, 'person_spirit', { name: '邵青', profession: '灵植师', personality: '温柔好奇', buildingId: 'building_headquarters', spaceId: 'living_room', color: '#55B7A5' });
  const center = compileLifeFlows(state);

  assert.equal(center.residents.length, 2);
  assert.equal(center.waves.length, 4);
  assert.ok(center.waves.every(wave => wave.total === 2));
  assert.ok(center.metrics.crossBuildingTrips >= 2);
  assert.ok(center.busiest.count >= 1);
});

test('生活流线不会把感知不足的建筑空间当作白日或晚间目的地', () => {
  const state = createDefaultLandlordState();
  ownHospital(state);
  for (const floor of Object.values(state.建筑列表.building_hospital_candidate.楼层列表)) floor.感知度 = 20;
  addPerson(state, 'person_spirit', { name: '邵青', profession: '灵植师', personality: '温柔好奇', buildingId: 'building_headquarters', spaceId: 'living_room', color: '#55B7A5' });
  const flow = compileLifeFlows(state).residents[0];

  assert.ok(flow.stops.filter(stop => ['day', 'evening'].includes(stop.phase)).every(stop => stop.buildingId === 'building_headquarters'));
});
