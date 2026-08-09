import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';
import { createOperationJournal } from '../scripts/src/services/operation-journal-service.js';

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

function createIds() {
  let next = 0;
  return prefix => `${prefix}_${++next}`;
}

function renovationPlan(name, style) {
  return {
    id: name,
    name,
    style,
    palette: { 主色: '#FF9EAA' },
    materials: { 墙面: '柔光涂料' },
    furniture: { 沙发: '云朵沙发' },
    lighting: '柔和灯带',
    atmosphere: '松弛',
    resultDescription: `客厅完成了${name}改造。`,
  };
}

async function createFixture() {
  const schema = { parseState: value => Schema.parse({ 房东系统: value }).房东系统 };
  const ids = createIds();
  const store = createLandlordStore({ mvu: createMemoryMvu(), schema, idFactory: ids });
  await store.ensureInitialized();
  const history = createOperationJournal({ store, idFactory: () => ids('operation'), clock: () => 123456 });
  return { store, history };
}

test('经营回溯只撤销本次操作改动，并保留不相关的新状态', async () => {
  const { store, history } = await createFixture();
  const before = store.getState();
  const originalRenovation = structuredClone(before.建筑列表.building_headquarters.空间列表.living_room.装修);

  await history.perform({ kind: 'renovation', label: '装修客厅' }, () =>
    store.applyRenovation({
      buildingId: 'building_headquarters',
      spaceId: 'living_room',
      plan: renovationPlan('柔光客厅', '柔光现代'),
    }),
  );
  assert.equal(history.summary().canUndo, true);
  assert.equal(history.list()[0].changeCount > 0, true);
  assert.equal(Object.keys(store.getState().联动队列).length, 4);

  await store.setRunMode('真实');
  assert.equal(history.summary().canUndo, true, '不相关的运行模式变化不应阻塞装修撤销');
  await history.undo();
  const undone = store.getState();
  assert.deepEqual(undone.建筑列表.building_headquarters.空间列表.living_room.装修, originalRenovation);
  assert.equal(undone.运行模式, '真实');
  assert.equal(Object.keys(undone.事件列表).length, 0);
  assert.equal(Object.keys(undone.联动队列).length, 0);
  assert.equal(history.summary().canRedo, true);

  await history.redo();
  const redone = store.getState();
  assert.equal(redone.建筑列表.building_headquarters.空间列表.living_room.装修.风格, '柔光现代');
  assert.equal(redone.运行模式, '真实');
  assert.equal(Object.keys(redone.联动队列).length, 4);
  history.dispose();
});

test('同一状态路径被其他脚本改动后，经营回溯会拒绝覆盖', async () => {
  const { store, history } = await createFixture();
  await history.perform({ kind: 'renovation', label: '第一次装修' }, () =>
    store.applyRenovation({
      buildingId: 'building_headquarters',
      spaceId: 'living_room',
      plan: renovationPlan('第一次装修', '一期风格'),
    }),
  );
  await store.applyRenovation({
    buildingId: 'building_headquarters',
    spaceId: 'living_room',
    plan: renovationPlan('外部再次装修', '二期风格'),
  });
  assert.equal(history.summary().canUndo, false);
  assert.equal(history.summary().blockedUndo, true);
  await assert.rejects(history.undo(), /无法安全回溯/);
  assert.equal(store.getState().建筑列表.building_headquarters.空间列表.living_room.装修.风格, '二期风格');
  history.dispose();
});
