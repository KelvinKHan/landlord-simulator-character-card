import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';
import { compileTenantEmbodiment } from '../scripts/src/tenants/embodiment-engine.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');

test.after(() => delete globalThis.z);

function addPerson(state, id, { name, origin, profession, personality, spaceId }) {
  state.人物列表[id] = {
    姓名: name, 来源世界: origin, 身份类型: '租客', 职业: profession, 所在建筑ID: 'building_headquarters', 所在空间ID: spaceId,
    外貌: '待补充', 性格: personality, 状态: '正常', 内心: '正在观察环境', 感知度: 100,
    视觉身份: { 图标: 'person', 主色: id === 'person_photo' ? '#6B8DC9' : '#55B7A5', 纹样: 'dots' }, 生活状态: {}, 关系: {},
  };
  state.建筑列表.building_headquarters.空间列表[spaceId].占用者[id] = '租客';
}

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

test('同一空间会按人物职业、性格与世界来源产生不同具身反应', () => {
  const state = createDefaultLandlordState();
  addPerson(state, 'person_photo', { name: '林夏', origin: '近未来都市', profession: '空间摄影师', personality: '安静敏锐', spaceId: 'living_room' });
  addPerson(state, 'person_spirit', { name: '邵青', origin: '东方幻想', profession: '灵植师', personality: '温柔好奇', spaceId: 'living_room' });
  const report = compileTenantEmbodiment(state, 'building_headquarters');
  assert.equal(report.residents.length, 2);
  assert.equal(report.encounters.length, 1);
  const photo = report.residents.find(item => item.personId === 'person_photo');
  const spirit = report.residents.find(item => item.personId === 'person_spirit');
  assert.notDeepEqual(photo.preferenceTags, spirit.preferenceTags);
  assert.notEqual(photo.reaction, spirit.reaction);
  assert.equal(report.encounters[0].spaceName, '客厅');
});

test('具身引擎会给出比当前房间更契合的真实空间建议', () => {
  const state = createDefaultLandlordState();
  addPerson(state, 'person_photo', { name: '林夏', origin: '现代都市', profession: '自然摄影师', personality: '安静敏锐', spaceId: 'public_bath' });
  const report = compileTenantEmbodiment(state, 'building_headquarters');
  const reaction = report.residents[0];
  assert.ok(reaction.alternatives.length >= 1);
  assert.ok(reaction.alternatives.every(item => item.fit > reaction.fit && item.delta > 0));
  assert.ok(reaction.preferenceTags.includes('自然与生命感'));
});

test('人物感受必须确认且位置未变化才写入三频道与 MVU', async () => {
  const state = createDefaultLandlordState();
  addPerson(state, 'person_photo', { name: '林夏', origin: '现代都市', profession: '空间摄影师', personality: '安静敏锐', spaceId: 'living_room' });
  const schema = { parseState: value => Schema.parse({ 房东系统: value }).房东系统 };
  let next = 0;
  const store = createLandlordStore({ mvu: createMemoryMvu(state), schema, idFactory: prefix => `${prefix}_embodied_${++next}` });
  const reaction = compileTenantEmbodiment(store.getState(), 'building_headquarters').residents[0];
  assert.equal(store.getState().人物列表.person_photo.生活状态.反应键, '');
  await store.recordTenantReaction({ personId: 'person_photo', reaction });
  const after = store.getState();
  assert.equal(after.人物列表.person_photo.生活状态.反应键, reaction.id);
  assert.equal(after.人物列表.person_photo.生活状态.空间契合度, reaction.fit);
  assert.equal(Object.keys(after.联动队列).length, 3);
  assert.deepEqual(new Set(Object.values(after.联动队列).map(item => item.频道)), new Set(['正文', '微信', '建筑']));

  const stale = compileTenantEmbodiment(after, 'building_headquarters').residents[0];
  await store.movePerson({ personId: 'person_photo', buildingId: 'building_headquarters', spaceId: 'garden' });
  await assert.rejects(store.recordTenantReaction({ personId: 'person_photo', reaction: stale }), /位置已经变化/);
});
