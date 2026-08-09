import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { compileBuilding } from '../scripts/src/buildings/compiler.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';
import { createPerceptionService } from '../scripts/src/services/perception-service.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');
test.after(() => delete globalThis.z);

function memoryMvu(initial = createDefaultLandlordState()) {
  let snapshot = { stat_data: { 房东系统: structuredClone(initial) } };
  return {
    read(path, fallback) {
      let value = snapshot.stat_data;
      for (const part of String(path).split('.')) value = value?.[part];
      return value ?? fallback;
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

function ids() {
  let next = 0;
  return prefix => `${prefix}_perception_${++next}`;
}

const schema = { parseState: value => Schema.parse({ 房东系统: value }).房东系统 };

test('建筑编译器按有效感知度隐藏细节而不泄露未知信息', () => {
  const state = createDefaultLandlordState();
  const building = state.建筑列表.building_headquarters;
  building.楼层列表.floor_1.感知度 = 12;
  const compiled = compileBuilding('building_headquarters', building, {});
  const floor = compiled.floors.find(item => item.id === 'floor_1');
  const room = floor.spaces.find(item => item.id === 'living_room');
  assert.equal(floor.visibility, 'outline');
  assert.equal(floor.name, '未确认楼层');
  assert.equal(room.name, '未知空间');
  assert.equal(room.purpose, '等待进一步探索');
  assert.doesNotMatch(room.description, /宽敞舒适/);
  assert.equal(room.facilityCount, 0);
});

test('探索会稳定选择感知最低的目标，跨阶段时发出联动', async () => {
  const store = createLandlordStore({ mvu: memoryMvu(), schema, idFactory: ids() });
  const perception = createPerceptionService({ store, step: 18 });
  assert.deepEqual(perception.findNext('building_headquarters'), { kind: 'floor', id: 'floor_b1', name: '地下一楼', awareness: 25 });
  const first = await perception.exploreNext('building_headquarters');
  assert.equal(first.target.awareness, 43);
  assert.equal(Object.keys(store.getState().联动队列).length, 0);
  const second = await perception.exploreNext('building_headquarters');
  assert.equal(second.target.id, 'floor_4');
  assert.equal(second.target.awareness, 53);
  const third = await perception.exploreNext('building_headquarters');
  assert.equal(third.target.id, 'floor_b1');
  assert.equal(third.target.awareness, 61);
  assert.equal(Object.keys(store.getState().联动队列).length, 4);
  assert.match(Object.values(store.getState().事件列表)[0].摘要, /初步了解.*已显露/);
});
