import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { compilePortfolio } from '../scripts/src/buildings/compiler.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { managementMockRecipes } from '../scripts/src/mock/management-recipes.js';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';
import { createMockTaskService } from '../scripts/src/services/mock-task-service.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');

test.after(() => {
  delete globalThis.z;
});

function createMemoryMvu() {
  let snapshot = { initialized_lorebooks: {}, stat_data: {} };
  const clone = value => structuredClone(value);
  return {
    read(path, fallback) {
      let value = snapshot.stat_data;
      for (const part of String(path).split('.')) {
        if (!value || typeof value !== 'object' || !(part in value)) return fallback;
        value = value[part];
      }
      return value;
    },
    async transaction(update, { validate } = {}) {
      const before = clone(snapshot);
      let draft = clone(snapshot);
      const result = await update(draft.stat_data, draft);
      if (validate) draft = await validate(draft);
      snapshot = clone(draft);
      return { before, after: clone(snapshot), result };
    },
    snapshot: () => clone(snapshot),
  };
}

function createIds() {
  let next = 0;
  return prefix => `${prefix}_test_${++next}`;
}

const schema = {
  parseState(value) {
    return Schema.parse({ 房东系统: value }).房东系统;
  },
};

test('建筑编译器把同一模型编译成可渲染的资产总览', () => {
  const portfolio = compilePortfolio(createDefaultLandlordState());
  assert.equal(portfolio.headquarters.name, '房东总部公寓');
  assert.equal(portfolio.owned.length, 1);
  assert.equal(portfolio.available.length, 2);
  assert.equal(portfolio.headquarters.metrics.floors, 5);
  assert.ok(portfolio.headquarters.metrics.spaces >= 7);
});

test('模拟任务不会调用真实 AI，并能取消与确认', async () => {
  globalThis.generate = () => assert.fail('不应调用真实 generate');
  globalThis.generateRaw = () => assert.fail('不应调用真实 generateRaw');
  try {
    const service = createMockTaskService({ recipes: managementMockRecipes, idFactory: createIds() });
    const building = { id: 'building_hospital_candidate', 类型: '医院', 主题: {} };
    const task = await service.run('takeover', { building });
    assert.equal(task.status, 'ready');
    assert.equal(task.preview.source, 'local-mock');
    assert.equal(task.preview.directions.length, 3);

    let applied = null;
    const confirmed = await service.confirm(task.id, preview => {
      applied = preview.directions[0].id;
    });
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(applied, 'healing-community');

    const second = await service.run('renovation', {
      building: { id: 'building_headquarters', 类型: '公寓', 主题: {} },
      space: { id: 'living_room', 名称: '客厅' },
    });
    assert.equal(service.cancel(second.id), true);
    assert.equal(service.get(second.id).status, 'cancelled');
  } finally {
    delete globalThis.generate;
    delete globalThis.generateRaw;
  }
});

test('接管、装修与招募只有确认后才写入 MVU', async () => {
  const mvu = createMemoryMvu();
  const store = createLandlordStore({ mvu, schema, idFactory: createIds() });
  const initialized = await store.ensureInitialized();
  assert.equal(initialized.initialized, true);
  assert.equal(store.getState().建筑列表.building_hospital_candidate.接管状态, '可接管');

  const tasks = createMockTaskService({ recipes: managementMockRecipes, idFactory: createIds() });
  const hospital = compilePortfolio(store.getState()).available.find(building => building.type === '医院');
  const takeover = await tasks.run('takeover', { building: hospital });
  assert.equal(store.getState().建筑列表[hospital.id].接管状态, '可接管');
  await tasks.confirm(takeover.id, preview => store.acquireBuilding(hospital.id, preview.directions[0]));
  assert.equal(store.getState().建筑列表[hospital.id].接管状态, '已接管');
  assert.equal(store.getState().当前建筑ID, hospital.id);

  const current = compilePortfolio(store.getState()).buildings.find(building => building.id === hospital.id);
  const ward = current.floors.flatMap(floor => floor.spaces).find(space => space.id === 'hospital_ward');
  const renovation = await tasks.run('renovation', { building: current, space: ward });
  await tasks.confirm(renovation.id, preview =>
    store.applyRenovation({ buildingId: current.id, spaceId: ward.id, plan: preview.plans[1] }),
  );
  assert.equal(store.getState().建筑列表[current.id].空间列表[ward.id].装修.风格, '跨世界折衷');

  const recruitment = await tasks.run('recruitment', { building: current });
  await tasks.confirm(recruitment.id, preview =>
    store.recruit({ buildingId: current.id, spaceId: ward.id, candidate: preview.candidates[0] }),
  );
  const state = store.getState();
  assert.equal(state.人物列表.person_mock_医院_linxia.姓名, '林夏');
  assert.equal(state.人物列表.person_mock_医院_linxia.所在空间ID, ward.id);
  assert.equal(state.建筑列表[current.id].空间列表[ward.id].占用者.person_mock_医院_linxia, '员工');
  assert.ok(Object.values(state.事件列表).some(event => event.类型 === '人物加入'));
  assert.deepEqual(mvu.snapshot().stat_data.房东系统, state);
});
