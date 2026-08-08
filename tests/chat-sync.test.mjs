import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatSync } from '../scripts/src/chat/chat-sync.js';

const LEGACY_PUBLIC_METHODS = [
  'instantSync',
  'deleteFromChatLore',
  'clearAllChatLore',
  'syncToChatLore',
  'generateChatSummary',
  'updateChatLore',
  'ensureChatLore',
  'checkTenantChanges',
  'getCachedTenantList',
  'setCachedTenantList',
  'onMessageSent',
  'onConversationDeleting',
  'onAllChatsClearing',
  'syncAll',
  'getStatus',
  'setConfig',
  'listChatLoreEntries',
  'forceSyncNow',
  'generateStoryPrompt',
  'injectToInput',
];

function createFixture() {
  let currentChatId = 'chat-a';
  const conversations = [
    { id: 'group', type: 'group', name: '公寓群', members: ['小林', '阿澄'] },
    { id: 'private', type: 'private', name: '小林', members: ['小林'] },
  ];
  const messages = new Map([
    [
      'private',
      [
        {
          id: 'message-1',
          sender: '<user>',
          content: '在吗？',
          gameTime: { 日期: '8月8日', 时间: '晚上' },
          syncedToLore: false,
        },
        {
          id: 'message-2',
          sender: '小林',
          content: '在。',
          gameTime: { 日期: '8月8日', 时间: '晚上' },
          syncedToLore: false,
        },
      ],
    ],
    ['group', []],
  ]);
  const books = new Map();
  const marked = [];
  const storage = new Map();
  const textarea = {
    value: '原输入',
    dispatchEvent: event => (textarea.lastEvent = event),
  };
  const database = {
    getConversation: async id => conversations.find(item => item.id === id),
    getConversations: async () => conversations,
    getRecentMessages: async id => messages.get(id) ?? [],
    getMessages: async id => messages.get(id) ?? [],
    markAsSynced: async id => {
      marked.push(id);
      const message = [...messages.values()].flat().find(item => item.id === id);
      if (message) message.syncedToLore = true;
      return message;
    },
    getTenantList: () => ['小林', '阿澄'],
  };
  const tavern = {
    has: name => ['updateWorldbookWith', 'getWorldbook'].includes(name),
    getOrCreateChatWorldbook: async () => {
      const name = `book-${currentChatId}`;
      if (!books.has(name)) books.set(name, []);
      return name;
    },
    updateWorldbook: async (name, updater) => books.set(name, updater(books.get(name) ?? [])),
    getWorldbook: async name => books.get(name) ?? [],
  };
  const sync = new ChatSync({
    database,
    tavern,
    getContext: () => ({ chatId: currentChatId }),
    storage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    document: { querySelector: selector => (selector === '#send_textarea' ? textarea : null) },
    EventConstructor: class TestEvent {
      constructor(type, options) {
        this.type = type;
        this.options = options;
      }
    },
  });
  return {
    sync,
    books,
    marked,
    textarea,
    setChatId: value => (currentChatId = value),
  };
}

test('重构正文联动保留旧聊天 APP 使用的公开接口', () => {
  for (const method of LEGACY_PUBLIC_METHODS) {
    assert.equal(typeof ChatSync.prototype[method], 'function', `缺少兼容方法：${method}`);
  }
});

test('聊天记录同步到当前聊天世界书，并标记消息已同步', async () => {
  const { sync, books, marked } = createFixture();
  assert.equal(await sync.syncToChatLore('private'), true);
  const [entry] = books.get('book-chat-a');
  assert.equal(entry.name, '[租客微信]小林');
  assert.match(entry.content, /房东: 在吗？/);
  assert.match(entry.content, /小林: 在。/);
  assert.deepEqual(marked, ['message-1', 'message-2']);
  assert.equal(sync.lastSyncedMessageId, 'message-2');
});

test('切换 SillyTavern 聊天后会切换世界书缓存', async () => {
  const { sync, setChatId } = createFixture();
  assert.equal(await sync.ensureChatLore(), 'book-chat-a');
  setChatId('chat-b');
  assert.equal(await sync.ensureChatLore(), 'book-chat-b');
});

test('删除与清空操作只移除聊天前缀条目', async () => {
  const { sync, books } = createFixture();
  books.set('book-chat-a', [
    { name: '[租客微信]小林' },
    { name: '[租客微信]群聊记录' },
    { name: '其他世界书内容' },
  ]);
  assert.equal(await sync.deleteFromChatLore('private'), true);
  assert.deepEqual(books.get('book-chat-a').map(entry => entry.name), ['[租客微信]群聊记录', '其他世界书内容']);
  assert.equal(await sync.clearAllChatLore(), true);
  assert.deepEqual(books.get('book-chat-a'), [{ name: '其他世界书内容' }]);
});

test('正文提示可注入输入框，并触发 input 事件', async () => {
  const { sync, textarea } = createFixture();
  assert.equal(await sync.injectToInput('private', '晚饭'), true);
  assert.match(textarea.value, /和小林的微信聊天：晚饭/);
  assert.equal(textarea.lastEvent.type, 'input');
  assert.equal(textarea.lastEvent.options.bubbles, true);
});
