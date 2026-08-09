import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';
import { compileLifeCollisions } from '../scripts/src/tenants/life-collision-engine.js';
import { handleLifeCollisionAction } from '../scripts/src/ui/console/life-collision-actions.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');
test.after(() => delete globalThis.z);

function addPerson(state, id, { name, origin, profession, personality, buildingId, spaceId, color }) {
  state.人物列表[id] = {
    姓名: name, 来源世界: origin, 身份类型: '租客', 职业: profession, 性格: personality,
    所在建筑ID: buildingId, 所在空间ID: spaceId, 外貌: '待补充', 状态: '正常', 内心: '对对方的世界感到好奇', 感知度: 100,
    视觉身份: { 图标: 'person', 主色: color, 纹样: 'dots' }, 生活状态: {}, 关系: {},
  };
  state.建筑列表[buildingId].空间列表[spaceId].占用者[id] = '租客';
}

function createCollisionState() {
  const state = createDefaultLandlordState();
  state.建筑列表.building_hospital_candidate.接管状态 = '已接管';
  state.建筑列表.building_hospital_candidate.感知度 = 100;
  state.建筑列表.building_headquarters.空间列表.living_room.装修 = { 风格: '跨世界会客厅', 配色: { 主色: '#E8E4FF', 点缀: '#55B7A5' }, 材质: { 地面: '暖木' }, 家具: { 主沙发: '云朵沙发' }, 照明: '自然柔光与灵光', 氛围: '梦幻而舒适', 完成度: 100 };
  addPerson(state, 'person_photo', { name: '林夏', origin: '近未来都市', profession: '空间摄影师', personality: '敏锐而松弛', buildingId: 'building_hospital_candidate', spaceId: 'hospital_ward', color: '#6B8DC9' });
  addPerson(state, 'person_spirit', { name: '邵青', origin: '东方幻想', profession: '灵植师', personality: '安静好奇', buildingId: 'building_headquarters', spaceId: 'living_room', color: '#55B7A5' });
  return state;
}

function createMemoryMvu(initialState) {
  let snapshot = { initialized_lorebooks: {}, stat_data: { 房东系统: structuredClone(initialState) } };
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
      const result = await update(draft.stat_data, draft);
      if (validate) draft = await validate(draft);
      snapshot = structuredClone(draft);
      return { before, after: structuredClone(snapshot), result };
    },
  };
}

function createStore(state) {
  let next = 0;
  return createLandlordStore({
    mvu: createMemoryMvu(state),
    schema: { parseState: value => Schema.parse({ 房东系统: value }).房东系统 },
    idFactory: prefix => `${prefix}_collision_${++next}`,
  });
}

test('交汇预言机从生活流线发现可达的跨世界相遇且不修改输入', () => {
  const state = createCollisionState();
  const snapshot = structuredClone(state);
  const center = compileLifeCollisions(state);

  assert.ok(center.collisions.length >= 1);
  assert.ok(center.collisions.every(collision => collision.routes.every(route => route.code !== 'ROUTE_UNKNOWN')));
  assert.ok(center.collisions.every(collision => state.建筑列表[collision.buildingId].空间列表[collision.destination.id]));
  assert.ok(center.collisions.some(collision => collision.people[0].origin !== collision.people[1].origin));
  assert.ok(center.focus.score >= 58);
  assert.deepEqual(state, snapshot);
  assert.ok(Object.isFrozen(center));
});

test('锁定生活交汇复用双人场景原子写入并生成三频道联动', async () => {
  const store = createStore(createCollisionState());
  const collision = compileLifeCollisions(store.getState()).focus;
  await store.activateRelationshipScene(collision.scene);
  const state = store.getState();

  for (const personId of collision.personIds) {
    assert.equal(state.人物列表[personId].所在建筑ID, collision.buildingId);
    assert.equal(state.人物列表[personId].所在空间ID, collision.destination.id);
  }
  assert.equal(Object.values(state.事件列表).filter(event => event.场景键 === collision.id).length, 1);
  assert.deepEqual(Object.values(state.联动队列).filter(item => item.来源类型 === '关系场景').map(item => item.频道).sort(), ['建筑', '微信', '正文']);
});

test('交汇按钮只在显式确认后启动场景，选中阶段不写入 MVU', async () => {
  const store = createStore(createCollisionState());
  const collision = compileLifeCollisions(store.getState()).focus;
  const ui = { selectedLifeCollisionId: null };
  let renders = 0;
  let notice = null;
  await handleLifeCollisionAction({ action: 'choose-life-collision', button: { dataset: { collisionId: collision.id } }, ui, store, render: () => { renders += 1; }, withBusy: async work => work(), recordOperation: (_kind, _label, action) => action(), setNotice: (text, type) => { notice = { text, type }; } });
  assert.equal(ui.selectedLifeCollisionId, collision.id);
  assert.equal(Object.keys(store.getState().事件列表).length, 0);
  await handleLifeCollisionAction({ action: 'confirm-life-collision', button: { dataset: {} }, ui, store, render: () => { renders += 1; }, withBusy: async work => work(), recordOperation: (_kind, _label, action) => action(), setNotice: (text, type) => { notice = { text, type }; } });
  assert.equal(ui.selectedLifeCollisionId, null);
  assert.equal(Object.keys(store.getState().事件列表).length, 1);
  assert.equal(notice.type, 'success');
  assert.equal(renders, 1);
});
