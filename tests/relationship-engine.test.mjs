import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';
import { compileRelationshipSparks } from '../scripts/src/tenants/relationship-engine.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');

test.after(() => {
  delete globalThis.z;
});

function createPairState() {
  const state = createDefaultLandlordState();
  state.人物列表.person_photo = {
    姓名: '林夏', 来源世界: '近未来都市', 身份类型: '租客', 职业: '空间摄影师',
    所在建筑ID: 'building_headquarters', 所在空间ID: 'living_room', 外貌: '银灰短发',
    性格: '敏锐而松弛', 状态: '正在观察客厅', 内心: '好奇这里的光', 感知度: 100,
    视觉身份: { 图标: 'camera', 主色: '#6B8DC9', 纹样: 'grid' }, 关系: {},
  };
  state.人物列表.person_herbalist = {
    姓名: '邵青', 来源世界: '东方幻想', 身份类型: '租客', 职业: '灵植师',
    所在建筑ID: 'building_headquarters', 所在空间ID: 'living_room', 外貌: '墨绿长发',
    性格: '安静好奇', 状态: '研究现代家具', 内心: '这些器物没有灵力却很方便', 感知度: 100,
    视觉身份: { 图标: 'leaf', 主色: '#55B7A5', 纹样: 'leaves' }, 关系: {},
  };
  state.建筑列表.building_headquarters.空间列表.living_room.占用者 = {
    person_photo: '租客',
    person_herbalist: '租客',
  };
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

function createStore(initialState) {
  let nextId = 0;
  return createLandlordStore({
    mvu: createMemoryMvu(initialState),
    schema: { parseState: value => Schema.parse({ 房东系统: value }).房东系统 },
    idFactory: prefix => `${prefix}_relationship_${++nextId}`,
  });
}

test('只有真正同处一个空间的人物组合才会产生关系火花', () => {
  const state = createPairState();
  const before = structuredClone(state);
  const center = compileRelationshipSparks(state, 'building_headquarters');

  assert.equal(center.sparks.length, 1);
  assert.deepEqual(center.sparks[0].personIds, ['person_herbalist', 'person_photo']);
  assert.equal(center.sparks[0].spaceId, 'living_room');
  assert.match(center.sparks[0].summary, /客厅/);
  assert.ok(center.sparks[0].reasons.some(reason => reason.includes('不同世界')));
  assert.equal(center.sparks[0].recorded, false);
  assert.equal(center.network.nodes.length, 2);
  assert.equal(center.network.edges.length, 1);
  assert.equal(center.network.edges[0].type, 'potential');
  assert.equal(center.network.metrics.crossWorld, 1);
  assert.ok(center.network.nodes.every(node => node.x >= 42 && node.x <= 678 && node.y >= 48 && node.y <= 272));
  assert.deepEqual(state, before, '关系推演必须是无副作用的只读计算');

  delete state.建筑列表.building_headquarters.空间列表.living_room.占用者.person_herbalist;
  state.建筑列表.building_headquarters.空间列表.garden.占用者.person_herbalist = '租客';
  state.人物列表.person_herbalist.所在空间ID = 'garden';
  assert.equal(compileRelationshipSparks(state, 'building_headquarters').sparks.length, 0);
});

test('确认关系火花会双向写入关系并生成三个联动草稿', async () => {
  const store = createStore(createPairState());
  const spark = compileRelationshipSparks(store.getState(), 'building_headquarters').sparks[0];
  await store.confirmRelationshipSpark(spark);

  const state = store.getState();
  assert.equal(state.人物列表.person_photo.关系.person_herbalist, spark.label);
  assert.equal(state.人物列表.person_herbalist.关系.person_photo, spark.label);
  const events = Object.values(state.事件列表).filter(event => event.类型 === '关系火花');
  assert.equal(events.length, 1);
  assert.equal(events[0].场景键, spark.id);
  assert.deepEqual(
    Object.values(state.联动队列).filter(item => item.来源类型 === '关系火花').map(item => item.频道).sort(),
    ['建筑', '微信', '正文'],
  );
  const confirmedCenter = compileRelationshipSparks(state, 'building_headquarters');
  assert.equal(confirmedCenter.sparks[0].recorded, true);
  assert.equal(confirmedCenter.network.edges.length, 1);
  assert.equal(confirmedCenter.network.edges[0].type, 'confirmed');
  assert.equal(confirmedCenter.network.edges[0].label, spark.label);
  assert.equal(confirmedCenter.scenes.length, 2);
  assert.deepEqual(confirmedCenter.scenes.map(scene => scene.kind).sort(), ['dual-profession', 'world-exchange']);
  await assert.rejects(() => store.confirmRelationshipSpark(spark), /已经记录过/);
});

test('人物离开相遇空间后旧关系火花不能覆盖新状态', async () => {
  const store = createStore(createPairState());
  const spark = compileRelationshipSparks(store.getState(), 'building_headquarters').sparks[0];
  await store.movePerson({
    personId: 'person_herbalist',
    buildingId: 'building_headquarters',
    spaceId: 'garden',
    activity: '照看花园',
  });
  await assert.rejects(() => store.confirmRelationshipSpark(spark), /离开相遇空间/);
  assert.deepEqual(store.getState().人物列表.person_photo.关系, {});
});

test('已确认关系在人物分开活动后保留并重排为空间群落', async () => {
  const store = createStore(createPairState());
  const spark = compileRelationshipSparks(store.getState(), 'building_headquarters').sparks[0];
  await store.confirmRelationshipSpark(spark);
  await store.movePerson({
    personId: 'person_herbalist',
    buildingId: 'building_headquarters',
    spaceId: 'garden',
    activity: '照看花园',
  });

  const center = compileRelationshipSparks(store.getState(), 'building_headquarters');
  assert.equal(center.sparks.length, 0);
  assert.equal(center.network.clusters.length, 2);
  assert.equal(center.network.edges.length, 1);
  assert.equal(center.network.edges[0].type, 'confirmed');
  assert.equal(center.network.edges[0].label, spark.label);
  assert.notEqual(center.network.nodes[0].spaceId, center.network.nodes[1].spaceId);
});

test('启动双人生活场景会原子移动双方并生成三类联动', async () => {
  const store = createStore(createPairState());
  const spark = compileRelationshipSparks(store.getState(), 'building_headquarters').sparks[0];
  await store.confirmRelationshipSpark(spark);
  const scene = compileRelationshipSparks(store.getState(), 'building_headquarters').scenes[0];
  await store.activateRelationshipScene(scene);

  const state = store.getState();
  for (const personId of scene.personIds) {
    assert.equal(state.人物列表[personId].所在空间ID, scene.destination.id);
    assert.equal(state.建筑列表.building_headquarters.空间列表[scene.destination.id].占用者[personId], '租客');
    assert.match(state.人物列表[personId].状态, /正在和/);
  }
  assert.equal(state.建筑列表.building_headquarters.经营摘要.今日亮点, scene.title);
  assert.equal(Object.values(state.事件列表).filter(event => event.类型 === '关系场景').length, 1);
  assert.deepEqual(
    Object.values(state.联动队列).filter(item => item.来源类型 === '关系场景').map(item => item.频道).sort(),
    ['建筑', '微信', '正文'],
  );
  await assert.rejects(() => store.activateRelationshipScene(scene), /已经启动过/);
});

test('双人场景确认前任一人物移动都会让旧编排失效', async () => {
  const store = createStore(createPairState());
  const spark = compileRelationshipSparks(store.getState(), 'building_headquarters').sparks[0];
  await store.confirmRelationshipSpark(spark);
  const scene = compileRelationshipSparks(store.getState(), 'building_headquarters').scenes[0];
  await store.movePerson({ personId: scene.personIds[0], buildingId: 'building_headquarters', spaceId: 'garden', activity: '临时去了花园' });
  await assert.rejects(() => store.activateRelationshipScene(scene), /位置已经变化/);
  assert.equal(Object.values(store.getState().事件列表).filter(event => event.类型 === '关系场景').length, 0);
});
