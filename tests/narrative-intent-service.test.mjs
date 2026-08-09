import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';

globalThis.z = z;
const { createNarrativeIntentService, extractNarrativeIntentsLocally } = await import('../scripts/src/services/narrative-intent-service.js');

test.after(() => delete globalThis.z);

function fixture() {
  const state = createDefaultLandlordState();
  state.人物列表.person_linxia = {
    姓名: '林夏', 来源世界: '现代都市', 身份类型: '租客', 职业: '摄影师', 所在建筑ID: 'building_headquarters', 所在空间ID: 'living_room',
    外貌: '短发', 性格: '敏锐', 状态: '正常', 内心: '观察中', 感知度: 100,
    视觉身份: { 图标: 'person', 主色: '#6B8DC9', 纹样: 'dots' }, 生活状态: {}, 关系: {},
  };
  state.建筑列表.building_headquarters.空间列表.living_room.占用者.person_linxia = '租客';
  return state;
}

test('本地剧情解析只使用现有人物与空间 ID，并保留活动描述', () => {
  const result = extractNarrativeIntentsLocally('林夏走进花园，正在观察异世界植物。随后回到客厅，准备整理照片。', fixture());
  assert.equal(result.mode, 'local');
  assert.equal(result.intents.length, 2);
  assert.deepEqual(result.intents.map(item => item.personId), ['person_linxia', 'person_linxia']);
  assert.deepEqual(result.intents.map(item => item.spaceId), ['garden', 'living_room']);
  assert.match(result.intents[0].activity, /正在观察异世界植物/);
  assert.match(result.intents[1].activity, /准备整理照片/);
});

test('无法确定人物的移动句会进入待辨认，不会猜造 ID', () => {
  const result = extractNarrativeIntentsLocally('神秘访客走进花园。林夏看着窗外。', fixture());
  assert.equal(result.intents.length, 0);
  assert.equal(result.unresolved.length, 1);
  assert.match(result.unresolved[0], /神秘访客/);
});

test('AI 提取未显式启用时绝不调用生成接口', async () => {
  let calls = 0;
  const state = fixture();
  const service = createNarrativeIntentService({
    store: { getState: () => structuredClone(state) },
    tavern: { has: () => true, generateStructured: async () => { calls += 1; return { intents: [], unresolved: [] }; } },
    isAiEnabled: () => false,
  });
  await assert.rejects(service.extract('林夏走进花园。', { mode: 'ai' }), /尚未由玩家启用/);
  assert.equal(calls, 0);
});
