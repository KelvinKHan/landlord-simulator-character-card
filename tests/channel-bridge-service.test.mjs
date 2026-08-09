import assert from 'node:assert/strict';
import test from 'node:test';
import { createChannelBridgeService, createLegacyChannelPorts } from '../scripts/src/services/channel-bridge-service.js';

function fixture() {
  return ['正文', '微信', '新闻', '建筑'].map((channel, index) => ({
    id: `link_${index}`,
    事件ID: 'event_1', 频道: channel, 标题: '林夏加入了白塔', 摘要: '林夏已经安置到旧住院部。',
    建筑ID: 'hospital', 空间ID: 'ward', 人物ID: 'linxia', 来源类型: '人物加入', 状态: '待分发', 创建时间: '刚刚',
  }));
}

test('四频道草稿使用同一事件和租客身份，未确认时绝不投递', async () => {
  const items = fixture();
  const consumed = [];
  const calls = [];
  const events = {
    list: ({ channel, status } = {}) => items.filter(item => (!channel || item.频道 === channel) && (!status || item.状态 === status)),
    buildContext: channel => `<landlord_link channel="${channel}">林夏加入白塔</landlord_link>`,
    consume: async id => consumed.push(id),
  };
  const ports = {
    capabilities: () => ({ 正文: true, 微信: true, 新闻: true, 建筑: true }),
    story: async value => calls.push(value), wechat: async value => calls.push(value), news: async value => calls.push(value), building: async value => calls.push(value),
  };
  const bridge = createChannelBridgeService({
    events,
    identities: { get: () => ({ name: '林夏', buildingName: '白塔生活馆', contactId: 'landlord_wechat_linxia' }) },
    ports,
  });
  assert.equal(bridge.preview('微信')[0].sender, '林夏');
  assert.equal(bridge.preview('微信')[0].conversationName, '白塔生活馆·经营群');
  assert.equal(bridge.preview('新闻')[0].headline.source, '房东经营中枢');
  assert.match(bridge.preview('正文')[0].content, /landlord_link/);
  await assert.rejects(bridge.dispatch('link_1'), /显式确认/);
  assert.equal(calls.length, 0);
  await bridge.dispatch('link_1', { confirmed: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(consumed, ['link_1']);
  await assert.rejects(bridge.dispatchMany(['link_0', 'link_2']), /显式确认/);
  const batch = await bridge.dispatchMany(['link_0', 'link_2'], { confirmed: true });
  assert.deepEqual({ total: batch.total, successful: batch.successful, failed: batch.failed }, { total: 2, successful: 2, failed: 0 });
  assert.equal(calls.length, 3);
  assert.deepEqual(consumed, ['link_1', 'link_0', 'link_2']);
});

test('旧微信和新闻适配器只在显式调用时写入现有模块', async () => {
  const messages = [];
  const emitted = [];
  const injections = [];
  const phone = { newsSystem: { newsData: { headlines: [] }, saveNewsToVariable() {} }, emit: (...args) => emitted.push(args) };
  const globals = {
    ChatDB: {
      getOrCreateGroupChat: async name => ({ id: 'group_1', name }),
      addMessage: async (conversationId, sender, content) => { messages.push({ conversationId, sender, content }); return messages.at(-1); },
    },
    PhoneSystem: phone,
    injectPrompts: (prompts, options) => injections.push({ prompts, options }),
  };
  const ports = createLegacyChannelPorts({ getLegacy: name => globals[name], logger: { warn() {} } });
  assert.deepEqual(ports.capabilities(), { 正文: true, 微信: true, 新闻: true, 建筑: true });
  await ports.wechat({ conversationName: '白塔·经营群', sender: '林夏', content: '我已经到了。' });
  await ports.news({ headline: { tag: '人物加入', title: '新成员', summary: '林夏加入', source: '房东经营中枢', time: '刚刚' } });
  await ports.story({ deliveryId: 'link_story', content: '<landlord_link>新成员加入</landlord_link>' });
  assert.deepEqual(messages, [{ conversationId: 'group_1', sender: '林夏', content: '我已经到了。' }]);
  assert.equal(phone.newsSystem.newsData.headlines[0].title, '新成员');
  assert.equal(emitted[0][0], 'news-updated');
  assert.equal(injections[0].prompts[0].id, 'landlord_link_link_story');
  assert.equal(injections[0].prompts[0].depth, 0);
  assert.equal(injections[0].prompts[0].role, 'system');
  assert.deepEqual(injections[0].options, { once: true });
});
