import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatCore } from '../scripts/src/chat/chat-core.js';

const LEGACY_PUBLIC_METHODS = [
  'sendUserMessage',
  'generateGroupReply',
  'generatePrivateReply',
  'abort',
  'applyRegexFilter',
  'getEnhancedContext',
  'getStoryContext',
  'getAllPrivateChatsSummary',
  'getGroupChatSummary',
  'getMembersInfo',
  'getTenantInfo',
  'formatTenantInfo',
  'buildGroupPrompt',
  'buildPrivatePrompt',
  'formatChatHistory',
  'cleanMessageContent',
  'parseGroupReply',
  'callAPI',
  'getAPIConfig',
  'getStatus',
];

function createFixture(responseContent = '小林: 收到\n阿澄：好呀') {
  const conversations = new Map([
    ['group', { id: 'group', type: 'group', name: '公寓群', members: ['小林', '阿澄'] }],
    ['private', { id: 'private', type: 'private', name: '小林', members: ['小林'] }],
  ]);
  const saved = [];
  const requests = [];
  const database = {
    db: {},
    getConversation: async id => conversations.get(id),
    getConversations: async () => [...conversations.values()],
    getRecentMessages: async id =>
      id === 'private' ? [{ sender: '<user>', content: '在吗', gameTime: { 时间: '晚上' } }] : [],
    addMessage: async (conversationId, sender, content, extras = {}) => {
      const message = { id: `message-${saved.length}`, conversationId, sender, content, ...extras };
      saved.push(message);
      return message;
    },
    getGameTime: () => ({ 日期: '8月8日', 星期: '星期六', 时间: '晚上' }),
    formatGameTime: time => `${time.日期} ${time.星期} ${time.时间}`,
  };
  const core = new ChatCore({
    database,
    mvu: { read: path => (path.at(-1) === '小林' ? { 年龄: 20, 职业: '作家' } : { 年龄: 22 }) },
    getTenantAnalyzer: () => ({
      getBaseProfile: async name => `${name}的本色`,
      getDynamicProfile: async name => `${name}的近况`,
    }),
    getPhoneSystem: () => ({
      getSettings: () => ({
        apiConfig: {
          apiUrl: 'https://example.test',
          apiKey: 'test-key',
          model: 'test-model',
          maxTokens: 600,
          temperature: 0.7,
        },
      }),
    }),
    getStoryMessages: () => [
      { is_user: true, mes: '玩家发言<UpdateVariable>隐藏</UpdateVariable>' },
      { is_user: false, mes: '剧情回复' },
    ],
    regexFilter: null,
    request: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: responseContent } }] }),
      };
    },
    createAbortController: () => new AbortController(),
  });
  return { core, database, saved, requests };
}

test('重构聊天核心保留旧聊天 APP 使用的公开接口', () => {
  for (const method of LEGACY_PUBLIC_METHODS) {
    assert.equal(typeof ChatCore.prototype[method], 'function', `缺少兼容方法：${method}`);
  }
});

test('群聊生成使用角色、剧情和历史上下文，并保存解析后的多条回复', async () => {
  const { core, saved, requests } = createFixture();
  const replies = await core.generateGroupReply('group', '晚上吃什么？');

  assert.deepEqual(
    replies.map(message => [message.sender, message.content]),
    [
      ['小林', '收到'],
      ['阿澄', '好呀'],
    ],
  );
  assert.equal(saved.length, 2);
  assert.equal(requests[0].url, 'https://example.test/v1/chat/completions');
  assert.equal(requests[0].body.messages.length, 4);
  assert.match(requests[0].body.messages[2].content, /玩家发言/);
  assert.doesNotMatch(requests[0].body.messages[2].content, /隐藏/);
  assert.match(requests[0].body.messages[2].content, /小林的本色/);
});

test('私聊回复会清理时间戳、分隔线和角色名前缀', async () => {
  const { core } = createFixture('[14:30] 小林: 嗯嗯\n-----\n第二条');
  const replies = await core.generatePrivateReply('private', '在吗？');
  assert.deepEqual(replies.map(message => message.content), ['嗯嗯', '第二条']);
});

test('发送用户消息会过滤纯空白，并保留表情包扩展字段', async () => {
  const { core, saved } = createFixture();
  assert.equal(await core.sendUserMessage('private', '   '), null);
  const message = await core.sendUserMessage('private', '  [表情包：你好]  ', { stickerImage: 'data:image/png' });
  assert.equal(message.content, '[表情包：你好]');
  assert.equal(saved[0].stickerImage, 'data:image/png');
});

test('角色名包含正则符号时仍能正确清理前缀', () => {
  const { core } = createFixture();
  assert.equal(core.cleanMessageContent('小林(1): 你好', '小林(1)'), '你好');
});
