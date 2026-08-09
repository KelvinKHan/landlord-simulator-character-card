import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { createBuildingEventBus } from '../scripts/src/events/building-event-bus.js';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');

test.after(() => delete globalThis.z);

function createMemoryMvu() {
  let state = { stat_data: { 房东系统: createDefaultLandlordState() } };
  return {
    read(path, fallback) {
      let value = state.stat_data;
      for (const part of String(path).split('.')) value = value?.[part];
      return value ?? fallback;
    },
    async transaction(update, { validate } = {}) {
      const before = structuredClone(state);
      let draft = structuredClone(state);
      await update(draft.stat_data, draft);
      if (validate) draft = await validate(draft);
      state = structuredClone(draft);
      return { before, after: structuredClone(state) };
    },
  };
}

function createIds() {
  let next = 0;
  return prefix => `${prefix}_bus_${++next}`;
}

const schema = { parseState: value => Schema.parse({ 房东系统: value }).房东系统 };

test('经营变化会一次性投递到正文、微信、新闻和建筑频道', async () => {
  const store = createLandlordStore({ mvu: createMemoryMvu(), schema, idFactory: createIds() });
  const bus = createBuildingEventBus({ store });
  await store.acquireBuilding('building_hospital_candidate', { buildingName: '白塔生活馆', summary: '白塔医院开始新经营。' });

  assert.deepEqual(bus.counts(), { 正文: 1, 微信: 1, 新闻: 1, 建筑: 1 });
  assert.equal(bus.list({ status: '待分发' }).length, 4);
  assert.match(bus.buildContext('正文'), /\[\u5efa筑接管\].*白塔生活馆/);
  assert.doesNotMatch(bus.buildContext('正文'), /undefined/);

  const wechat = bus.list({ channel: '微信' })[0];
  await bus.consume(wechat.id);
  assert.equal(bus.list({ channel: '微信' })[0].状态, '已读取');
  assert.deepEqual(bus.counts(), { 正文: 1, 微信: 0, 新闻: 1, 建筑: 1 });
  bus.dispose();
});

test('装修和招募联动保留建筑、空间与人物定位', async () => {
  const store = createLandlordStore({ mvu: createMemoryMvu(), schema, idFactory: createIds() });
  const bus = createBuildingEventBus({ store });
  await store.applyRenovation({
    buildingId: 'building_headquarters',
    spaceId: 'living_room',
    plan: { name: '星空客厅', style: '未来感', palette: {}, materials: {}, furniture: {}, lighting: '星光', atmosphere: '温暖', resultDescription: '客厅有了星空顶。' },
  });
  const item = bus.list({ channel: '新闻' })[0];
  assert.equal(item.建筑ID, 'building_headquarters');
  assert.equal(item.空间ID, 'living_room');
  assert.equal(item.来源类型, '装修完成');
  await bus.ignore(item.id);
  assert.equal(bus.list({ channel: '新闻' })[0].状态, '已忽略');
  bus.dispose();
});
