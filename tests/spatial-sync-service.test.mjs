import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';
import { createSpatialSyncService } from '../scripts/src/services/spatial-sync-service.js';
import { planSpatialMove } from '../scripts/src/spatial/route-engine.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');

test.after(() => {
  delete globalThis.z;
});

function createMemoryMvu() {
  let snapshot = { initialized_lorebooks: {}, stat_data: {} };
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
      let draft = structuredClone(snapshot);
      const before = structuredClone(snapshot);
      const result = await update(draft.stat_data, draft);
      if (validate) draft = await validate(draft);
      snapshot = structuredClone(draft);
      return { before, after: structuredClone(snapshot), result };
    },
  };
}

function ids() {
  let next = 0;
  return prefix => `${prefix}_spatial_${++next}`;
}

async function fixture() {
  const idFactory = ids();
  const store = createLandlordStore({
    mvu: createMemoryMvu(),
    schema: { parseState: value => Schema.parse({ 房东系统: value }).房东系统 },
    idFactory,
  });
  await store.ensureInitialized();
  await store.recruit({
    buildingId: 'building_headquarters',
    spaceId: 'living_room',
    candidate: {
      id: 'person_route_test', name: '林夏', origin: '测试世界', role: '租客', profession: '路线测试员',
      appearance: '短发', personality: '可靠', firstThought: '准备移动。', visualIdentity: { 图标: 'route', 主色: '#6B8DC9', 纹样: 'line' },
    },
  });
  const spatial = createSpatialSyncService({ store, idFactory: () => idFactory('proposal'), clock: () => 100 });
  return { store, spatial };
}

test('已知建筑路线会生成待确认提案，确认后同步人物与空间占用', async () => {
  const { store, spatial } = await fixture();
  const [proposal] = spatial.propose([{
    personId: 'person_route_test', buildingId: 'building_headquarters', spaceId: 'garden', activity: '观察花园',
  }], { source: 'test' });
  assert.equal(proposal.status, '待确认');
  assert.equal(proposal.route.kind, '建筑内移动');
  assert.deepEqual(proposal.route.path, ['living_room', 'garden']);
  await spatial.confirm(proposal.id);
  const state = store.getState();
  assert.equal(state.人物列表.person_route_test.所在空间ID, 'garden');
  assert.equal(state.人物列表.person_route_test.状态, '观察花园');
  assert.equal(state.建筑列表.building_headquarters.空间列表.living_room.占用者.person_route_test, undefined);
  assert.equal(state.建筑列表.building_headquarters.空间列表.garden.占用者.person_route_test, '租客');
  const movementLinks = Object.values(state.联动队列).filter(item => item.来源类型 === '人物移动');
  assert.deepEqual(movementLinks.map(item => item.频道).sort(), ['建筑', '正文']);
  spatial.dispose();
});

test('无效目标和并发位置变化会进入冲突，不会覆盖新剧情', async () => {
  const { store, spatial } = await fixture();
  const [invalid] = spatial.propose([{
    personId: 'person_route_test', buildingId: 'building_headquarters', spaceId: 'secret_room', activity: '寻找密室',
  }]);
  assert.equal(invalid.status, '冲突');
  assert.equal(invalid.route.code, 'SPACE_NOT_FOUND');
  assert.equal(spatial.ignore(invalid.id).status, '已忽略');

  const [stale] = spatial.propose([{
    personId: 'person_route_test', buildingId: 'building_headquarters', spaceId: 'kitchen', activity: '准备晚餐',
  }]);
  assert.equal(stale.status, '待确认');
  await store.movePerson({
    personId: 'person_route_test', buildingId: 'building_headquarters', spaceId: 'garden', activity: '被另一段剧情移动',
    expectedFrom: { buildingId: 'building_headquarters', spaceId: 'living_room' },
  });
  await assert.rejects(spatial.confirm(stale.id), /位置已经被其他剧情更新/);
  assert.equal(spatial.get(stale.id).status, '冲突');
  assert.equal(store.getState().人物列表.person_route_test.所在空间ID, 'garden');
  spatial.dispose();
});

test('跨楼层和已接管建筑之间使用明确的通行类型', async () => {
  const { store, spatial } = await fixture();
  let state = store.getState();
  const crossFloor = planSpatialMove(state, {
    personId: 'person_route_test', buildingId: 'building_headquarters', spaceId: 'room_owner',
  });
  assert.equal(crossFloor.ok, true);
  assert.equal(crossFloor.kind, '跨楼层通行');

  await store.acquireBuilding('building_hospital_candidate');
  state = store.getState();
  const crossBuilding = planSpatialMove(state, {
    personId: 'person_route_test', buildingId: 'building_hospital_candidate', spaceId: 'hospital_ward',
  });
  assert.equal(crossBuilding.ok, true);
  assert.equal(crossBuilding.kind, '跨建筑交通');
  spatial.dispose();
});
