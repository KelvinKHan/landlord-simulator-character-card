import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { compilePortfolioRadar } from '../scripts/src/buildings/portfolio-radar-engine.js';

test('经营态势雷达只编译已接管建筑并保持输入不变', () => {
  const state = createDefaultLandlordState();
  const snapshot = structuredClone(state);
  const radar = compilePortfolioRadar(state);

  assert.deepEqual(radar.buildings.map(item => item.id), ['building_headquarters']);
  assert.equal(radar.metrics.buildings, 1);
  assert.equal(radar.buildings[0].current, true);
  assert.match(radar.buildings[0].polygon, /^50,/);
  assert.equal(radar.buildings[0].polygon.split(' ').length, 4);
  assert.deepEqual(state, snapshot);
  assert.ok(Object.isFrozen(radar));
});

test('接管第二栋建筑后雷达形成跨建筑对比和全局焦点', () => {
  const state = createDefaultLandlordState();
  state.建筑列表.building_hospital_candidate.接管状态 = '已接管';
  state.建筑列表.building_hospital_candidate.感知度 = 100;
  state.当前建筑ID = 'building_hospital_candidate';
  state.人物列表.person_hospital = { 姓名: '林夏', 来源世界: '近未来都市', 所在建筑ID: 'building_hospital_candidate', 所在空间ID: 'hospital_ward' };
  state.建筑列表.building_hospital_candidate.空间列表.hospital_ward.占用者.person_hospital = '员工';
  const radar = compilePortfolioRadar(state);

  assert.equal(radar.buildings.length, 2);
  assert.equal(radar.buildings[0].id, 'building_hospital_candidate');
  assert.equal(radar.metrics.residents, 1);
  assert.equal(radar.metrics.origins, 1);
  assert.ok(radar.spotlight.buildingId);
  assert.ok(radar.focus.buildingId);
  assert.ok(radar.focus.name);
});

test('未接管候选建筑不进入雷达统计或焦点', () => {
  const radar = compilePortfolioRadar(createDefaultLandlordState());
  assert.equal(radar.buildings.some(item => item.id === 'building_hospital_candidate'), false);
  assert.notEqual(radar.focus?.buildingId, 'building_hospital_candidate');
});
