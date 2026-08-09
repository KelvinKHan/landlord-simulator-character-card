import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { compilePortfolioAssignments } from '../scripts/src/tenants/portfolio-assignment-engine.js';

function ownHospital(state) {
  state.建筑列表.building_hospital_candidate.接管状态 = '已接管';
  state.建筑列表.building_hospital_candidate.感知度 = 100;
}

function addPerson(state, id, { name, origin, profession, personality, buildingId, spaceId }) {
  state.人物列表[id] = {
    姓名: name, 来源世界: origin, 身份类型: '租客', 职业: profession, 性格: personality,
    所在建筑ID: buildingId, 所在空间ID: spaceId, 内心: '正在观察环境', 视觉身份: { 主色: '#6B8DC9' },
  };
  state.建筑列表[buildingId].空间列表[spaceId].占用者[id] = '租客';
}

test('匹配矩阵穷举现有人物和已接管建筑且不修改输入', () => {
  const state = createDefaultLandlordState();
  ownHospital(state);
  addPerson(state, 'person_photo', { name: '林夏', origin: '现代都市', profession: '自然摄影师', personality: '安静敏锐', buildingId: 'building_hospital_candidate', spaceId: 'hospital_ward' });
  addPerson(state, 'person_doctor', { name: '程远', origin: '近未来都市', profession: '未来医生', personality: '理性严谨', buildingId: 'building_headquarters', spaceId: 'public_bath' });
  const snapshot = structuredClone(state);
  const center = compilePortfolioAssignments(state);

  assert.equal(center.buildings.length, 2);
  assert.equal(center.residents.length, 2);
  assert.equal(center.metrics.combinations, 4);
  assert.ok(center.residents.every(person => person.placements.length === 2));
  assert.ok(center.residents.every(person => person.placements.every(placement => state.建筑列表[placement.buildingId].空间列表[placement.spaceId])));
  assert.deepEqual(state, snapshot);
  assert.ok(Object.isFrozen(center));
});

test('人物与建筑的职业和世界观偏好会形成可解释的跨建筑机会', () => {
  const state = createDefaultLandlordState();
  ownHospital(state);
  addPerson(state, 'person_photo', { name: '林夏', origin: '现代都市', profession: '自然摄影师', personality: '安静敏锐', buildingId: 'building_hospital_candidate', spaceId: 'hospital_ward' });
  const center = compilePortfolioAssignments(state);
  const person = center.residents[0];

  assert.equal(person.current.buildingId, 'building_hospital_candidate');
  assert.equal(person.crossBuilding?.buildingId, 'building_headquarters');
  assert.ok(person.crossBuilding.delta > 0);
  assert.match(person.verdict, /房东总部公寓/);
  assert.ok(person.crossBuilding.matchedTags.includes('自然与生命感'));
  assert.equal(center.metrics.crossBuildingOpportunities, 1);
});

test('未被充分感知的空间不会泄露到跨建筑匹配结果', () => {
  const state = createDefaultLandlordState();
  ownHospital(state);
  for (const floor of Object.values(state.建筑列表.building_hospital_candidate.楼层列表)) floor.感知度 = 20;
  addPerson(state, 'person_photo', { name: '林夏', origin: '现代都市', profession: '自然摄影师', personality: '安静敏锐', buildingId: 'building_headquarters', spaceId: 'living_room' });
  const center = compilePortfolioAssignments(state);
  const person = center.residents[0];

  assert.equal(person.placements.some(placement => placement.buildingId === 'building_hospital_candidate'), false);
  assert.equal(center.metrics.combinations, 1);
  assert.equal(center.opportunities.length, 0);
});
