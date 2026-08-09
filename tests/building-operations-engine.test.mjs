import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { compileBuildingOperations } from '../scripts/src/buildings/operations-engine.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');

test.after(() => delete globalThis.z);

function createMemoryMvu(initial) {
  let snapshot = { initialized_lorebooks: {}, stat_data: { 房东系统: structuredClone(initial) } };
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
      const before = structuredClone(snapshot);
      let draft = structuredClone(snapshot);
      await update(draft.stat_data, draft);
      if (validate) draft = await validate(draft);
      snapshot = structuredClone(draft);
      return { before, after: structuredClone(snapshot) };
    },
  };
}

function addResident(state, id, origin, spaceId = 'living_room') {
  state.人物列表[id] = {
    姓名: id, 来源世界: origin, 身份类型: '租客', 职业: '体验者', 所在建筑ID: 'building_headquarters', 所在空间ID: spaceId,
    外貌: '待补充', 性格: '好奇', 状态: '正常', 内心: '期待', 感知度: 100,
    视觉身份: { 图标: 'person', 主色: '#6B8DC9', 纹样: 'dots' }, 关系: {},
  };
  state.建筑列表.building_headquarters.空间列表[spaceId].占用者[id] = '租客';
}

test('建筑运行脉冲由同一份 MVU 状态稳定计算且不修改原数据', () => {
  const state = createDefaultLandlordState();
  const before = structuredClone(state);
  const first = compileBuildingOperations(state, 'building_headquarters');
  const second = compileBuildingOperations(state, 'building_headquarters');
  assert.deepEqual(first, second);
  assert.deepEqual(state, before);
  assert.match(first.signature, /^pulse_/);
  assert.equal(first.spaces.length, 7);
  for (const value of Object.values(first.metrics)) assert.ok(value >= 0 && value <= 100);
  assert.ok(first.scenes.length >= 1);
});

test('装修、入住与跨世界组合会改变空间体感并激活协同', () => {
  const state = createDefaultLandlordState();
  const room = state.建筑列表.building_headquarters.空间列表.living_room;
  const baseline = compileBuildingOperations(state, 'building_headquarters');
  room.装修 = { ...room.装修, 完成度: 100, 风格: '万界客厅', 配色: { 主色: '#E8E4FF', 点缀: '#55B7A5' }, 家具: { 沙发: '云朵沙发', 展台: '漂浮展台' }, 照明: '自然暖光', 氛围: '梦幻舒适' };
  addResident(state, 'person_a', '近未来都市');
  addResident(state, 'person_b', '东方幻想');
  const report = compileBuildingOperations(state, 'building_headquarters');
  const living = report.spaces.find(space => space.id === 'living_room');
  assert.ok(living.total > baseline.spaces.find(space => space.id === 'living_room').total);
  assert.ok(report.synergies.some(item => item.id === 'lived-design'));
  assert.ok(report.synergies.some(item => item.id === 'world-collision'));
  assert.ok(report.scenes.some(item => item.kind === 'world-convergence'));
});

test('点亮场景只在确认后写入人物、建筑记忆和四频道队列', async () => {
  const state = createDefaultLandlordState();
  addResident(state, 'person_scene', '蒸汽幻想');
  const schema = { parseState: value => Schema.parse({ 房东系统: value }).房东系统 };
  let next = 0;
  const store = createLandlordStore({ mvu: createMemoryMvu(state), schema, idFactory: prefix => `${prefix}_pulse_${++next}` });
  const preview = compileBuildingOperations(store.getState(), 'building_headquarters');
  const scene = preview.scenes[0];
  assert.equal(Object.keys(store.getState().事件列表).length, 0);
  await store.activateBuildingScene({ buildingId: 'building_headquarters', scene });
  const after = store.getState();
  assert.equal(Object.keys(after.事件列表).length, 1);
  assert.equal(Object.keys(after.联动队列).length, 4);
  assert.equal(Object.values(after.事件列表)[0].场景键, scene.id);
  assert.equal(compileBuildingOperations(after, 'building_headquarters').scenes.find(item => item.id === scene.id)?.activated, true);
  await assert.rejects(store.activateBuildingScene({ buildingId: 'building_headquarters', scene }), /已经点亮过/);
});
