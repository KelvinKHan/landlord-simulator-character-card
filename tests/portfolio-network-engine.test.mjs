import assert from 'node:assert/strict';
import test from 'node:test';
import { compilePortfolio } from '../scripts/src/buildings/compiler.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';

test('经营版图网络从建筑状态确定性生成节点和机会链路', () => {
  const network = compilePortfolio(createDefaultLandlordState()).network;
  const headquarters = network.nodes.find(node => node.headquarters);
  const hospital = network.nodes.find(node => node.id === 'building_hospital_candidate');

  assert.deepEqual({ x: headquarters.x, y: headquarters.y }, { x: 50, y: 50 });
  assert.equal(headquarters.current, true);
  assert.equal(headquarters.action, 'open-building');
  assert.equal(hospital.action, 'open-takeover');
  assert.equal(network.edges.find(edge => edge.to === hospital.id).status, 'potential');
  assert.deepEqual(network.metrics, { owned: 1, opportunities: 2, activeRoutes: 0, totalPeople: 0 });
  assert.ok(Object.isFrozen(network));
  assert.ok(Object.isFrozen(network.nodes));
});

test('接管建筑后机会链路自动升级为跨建筑运营链路', () => {
  const state = createDefaultLandlordState();
  state.建筑列表.building_hospital_candidate.接管状态 = '已接管';
  state.当前建筑ID = 'building_hospital_candidate';
  const network = compilePortfolio(state).network;
  const hospital = network.nodes.find(node => node.id === 'building_hospital_candidate');
  const route = network.edges.find(edge => edge.to === hospital.id);

  assert.equal(hospital.current, true);
  assert.equal(hospital.owned, true);
  assert.equal(hospital.action, 'open-building');
  assert.equal(route.kind, '运营交通');
  assert.equal(route.status, 'active');
  assert.deepEqual(network.metrics, { owned: 2, opportunities: 1, activeRoutes: 1, totalPeople: 0 });
});

test('未发现建筑不会泄露到经营版图网络', () => {
  const state = createDefaultLandlordState();
  state.建筑列表.building_office_candidate.接管状态 = '未发现';
  const network = compilePortfolio(state).network;

  assert.equal(network.nodes.some(node => node.id === 'building_office_candidate'), false);
  assert.equal(network.edges.some(edge => edge.to === 'building_office_candidate'), false);
});
