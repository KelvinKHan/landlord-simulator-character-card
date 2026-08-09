import assert from 'node:assert/strict';
import test from 'node:test';
import { compileContextCapsule } from '../scripts/src/services/context-capsule-service.js';
import { createChannelBridgeService } from '../scripts/src/services/channel-bridge-service.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';

test('上下文胶囊只编译当前建筑事实并严格服从字符预算', () => {
  const state = createDefaultLandlordState();
  state.人物列表.person_capsule = {
    姓名: '林夏', 来源世界: '现代都市', 身份类型: '租客', 职业: '摄影师', 所在建筑ID: 'building_headquarters', 所在空间ID: 'living_room',
    外貌: '短发', 性格: '安静敏锐', 状态: '观察中', 内心: '喜欢这里的光', 感知度: 100,
    视觉身份: { 图标: 'person', 主色: '#6B8DC9', 纹样: 'dots' }, 生活状态: {}, 关系: {},
  };
  state.建筑列表.building_headquarters.空间列表.living_room.占用者.person_capsule = '租客';
  const capsule = compileContextCapsule(state, 'building_headquarters', { maxChars: 1200 });
  assert.ok(capsule.chars <= 1200);
  assert.match(capsule.content, /房东总部公寓/);
  assert.match(capsule.content, /林夏/);
  assert.doesNotMatch(capsule.content, /白塔社区医院/);
  assert.doesNotMatch(capsule.content, /云端创意写字楼/);
  assert.match(capsule.content, /不要替玩家自动确认/);
  assert.match(capsule.signature, /^capsule_/);
});

test('上下文胶囊只有显式确认后才会调用一次性正文注入端口', async () => {
  const state = createDefaultLandlordState();
  const capsule = compileContextCapsule(state, 'building_headquarters');
  const injected = [];
  const bridge = createChannelBridgeService({
    events: { list: () => [] },
    ports: {
      capabilities: () => ({ 正文: true, 微信: false, 新闻: false, 建筑: true }),
      story: async draft => { injected.push(draft); return { promptId: draft.deliveryId, once: true, depth: 0 }; },
    },
  });
  await assert.rejects(bridge.injectContextCapsule(capsule), /显式确认/);
  assert.equal(injected.length, 0);
  const result = await bridge.injectContextCapsule(capsule, { confirmed: true });
  assert.equal(injected.length, 1);
  assert.equal(injected[0].kind, 'state-context-capsule');
  assert.equal(result.result.once, true);
  assert.equal(result.result.depth, 0);
});
