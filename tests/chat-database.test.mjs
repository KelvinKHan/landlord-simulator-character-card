import assert from 'node:assert/strict';
import test from 'node:test';
import { indexedDB } from 'fake-indexeddb';
import { ChatDatabase } from '../scripts/src/chat/chat-database.js';

const LEGACY_PUBLIC_METHODS = [
  'init',
  'generateId',
  'createConversation',
  'getConversations',
  'getConversation',
  'getOrCreateGroupChat',
  'getOrCreatePrivateChat',
  'updateConversation',
  'syncGroupMembers',
  'addMessage',
  'getMessages',
  'getRecentMessages',
  'markAsSynced',
  'deleteMessage',
  'deleteLastMessages',
  'deleteConversation',
  'getGameTime',
  'formatGameTime',
  'getTenantList',
  'exportData',
  'importData',
  'clearCurrentChatData',
  'getStats',
];

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('TenantChatDB');
    request.onsuccess = () => resolve();
    request.onerror = event => reject(event.target.error);
    request.onblocked = () => reject(new Error('测试数据库仍被占用'));
  });
}

function createDatabase(state) {
  let clock = 1_000;
  return new ChatDatabase({
    databaseFactory: indexedDB,
    getGameState: () => state,
    now: () => clock++,
    random: () => 0.5,
  });
}

test('重构数据库保留旧聊天模块依赖的完整公开接口', () => {
  for (const method of LEGACY_PUBLIC_METHODS) {
    assert.equal(typeof ChatDatabase.prototype[method], 'function', `缺少兼容方法：${method}`);
  }
});

test('聊天数据库覆盖会话、消息、撤回、聊天隔离和导入导出', async () => {
  await deleteTestDatabase();
  const state = {
    世界: { 年份: '2026', 日期: '8月8日', 星期: '星期六', 时间: '晚上' },
    租客列表: { 小林: {}, 阿澄: {} },
  };
  const database = createDatabase(state);
  const deletionEvents = [];
  let clearEvents = 0;
  database.on('conversation:deleting', ({ conversation }) => deletionEvents.push(conversation.id));
  database.on('all:clearing', () => (clearEvents += 1));

  try {
    await database.init('chat-a');
    const group = await database.getOrCreateGroupChat('公寓群');
    assert.deepEqual(group.members, ['小林', '阿澄']);
    assert.equal((await database.getOrCreateGroupChat('公寓群')).id, group.id);

    const privateChat = await database.getOrCreatePrivateChat('小林');
    assert.equal((await database.getOrCreatePrivateChat('小林')).id, privateChat.id);

    const first = await database.addMessage(privateChat.id, '<user>', '在吗？');
    const second = await database.addMessage(privateChat.id, '小林', '在。', { isImportant: true });
    assert.deepEqual(
      (await database.getRecentMessages(privateChat.id, 1)).map(message => message.id),
      [second.id],
    );
    assert.equal((await database.markAsSynced(first.id)).syncedToLore, true);

    const removed = await database.deleteLastMessages(privateChat.id, 1);
    assert.deepEqual(removed.map(message => message.id), [second.id]);
    assert.equal((await database.getConversation(privateChat.id)).lastMessage.content, '在吗？');
    assert.deepEqual(await database.getStats(), {
      chatId: 'chat-a',
      conversationCount: 2,
      messageCount: 1,
    });

    const temporary = await database.createConversation({ type: 'private', name: '临时', members: ['临时'] });
    await database.deleteConversation(temporary.id);
    assert.deepEqual(deletionEvents, [temporary.id]);

    const exported = await database.exportData();
    await database.init('chat-b');
    assert.deepEqual(await database.getConversations(), []);
    assert.deepEqual(await database.importData(exported), { conversations: 2, messages: 1 });
    assert.equal(clearEvents, 1);
    assert.deepEqual(await database.getStats(), {
      chatId: 'chat-b',
      conversationCount: 2,
      messageCount: 1,
    });

    await database.init('chat-a');
    assert.deepEqual(await database.getStats(), {
      chatId: 'chat-a',
      conversationCount: 2,
      messageCount: 1,
    });

    await database.init('chat-b');
    await database.importData(exported, { merge: true });
    assert.deepEqual(await database.getStats(), {
      chatId: 'chat-b',
      conversationCount: 4,
      messageCount: 2,
    });

    await database.clearCurrentChatData();
    assert.equal(clearEvents, 2);
    assert.deepEqual(deletionEvents, [temporary.id]);
  } finally {
    database.dispose();
    await deleteTestDatabase();
  }
});
