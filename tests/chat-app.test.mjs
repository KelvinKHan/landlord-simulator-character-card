import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { ChatAppController } from '../scripts/src/chat/chat-app-controller.js';
import { escapeHtml, renderConversationItem, renderMessage } from '../scripts/src/chat/chat-app-view.js';
import { ChatDataOperations } from '../scripts/src/chat/chat-data-operations.js';

const LEGACY_PUBLIC_METHODS = ['init', 'getState', 'getIframeDoc', 'retractMessage', 'retractLastMessages'];

function createFixture() {
  let chatId = 'chat-a';
  const conversations = [
    {
      id: 'group',
      type: 'group',
      name: '公寓业主群',
      members: ['小林'],
      updatedAt: { 时间: '09:00' },
      lastMessage: null,
    },
  ];
  const messages = new Map([['group', []]]);
  const calls = { init: [], groups: [], sent: [], generated: [], synced: [], deleted: [] };
  const { document } = parseHTML(`<!doctype html><html><head></head><body>
    <div id="status-bar" class="light"></div>
    <div id="home-screen"></div>
    <div id="app-container"></div>
  </body></html>`);
  const database = {
    init: async id => calls.init.push(id),
    getOrCreateGroupChat: async name => {
      calls.groups.push(name);
      return conversations[0];
    },
    getConversations: async () => conversations,
    getConversation: async id => conversations.find(item => item.id === id),
    getMessages: async id => messages.get(id) ?? [],
    getTenantList: () => ['小林'],
    deleteMessage: async id => {
      calls.deleted.push(id);
      messages.set('group', messages.get('group').filter(message => message.id !== id));
    },
    deleteLastMessages: async (id, count) => {
      const current = messages.get(id);
      const deleted = current.slice(-count);
      messages.set(id, current.slice(0, -count));
      return deleted;
    },
  };
  const core = {
    sendUserMessage: async (conversationId, content, extras = {}) => {
      const message = { id: `message-${calls.sent.length}`, sender: '<user>', content, ...extras };
      calls.sent.push(message);
      messages.get(conversationId).push(message);
      return message;
    },
    generateGroupReply: async conversationId => {
      calls.generated.push('group');
      messages.get(conversationId).push({ id: 'reply', sender: '小林', content: '收到' });
    },
    generatePrivateReply: async () => calls.generated.push('private'),
  };
  const controller = new ChatAppController({
    database,
    core,
    sync: { instantSync: async id => calls.synced.push(id) },
    phoneSystem: { iframeWindow: { document }, goHome: () => {} },
    stickerRepository: { getStickers: async () => [], clearCache: () => {} },
    dataOperations: {
      exportBackup: async () => true,
      chooseBackupToImport: () => null,
      syncGroupMembers: async () => true,
      clearAll: async () => false,
    },
    getContext: () => ({ chatId }),
    styles: '.chat-app { display: flex; }',
    alert: () => {},
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });
  return { controller, document, database, calls, messages, setChatId: id => (chatId = id) };
}

test('重构聊天 APP 保留旧脚本公开接口', () => {
  for (const method of LEGACY_PUBLIC_METHODS) {
    assert.equal(typeof ChatAppController.prototype[method], 'function', `缺少兼容方法：${method}`);
  }
});

test('初始化按 SillyTavern 聊天隔离，并为每个聊天确保默认群聊', async () => {
  const { controller, calls, setChatId } = createFixture();
  await controller.init();
  await controller.init();
  setChatId('chat-b');
  await controller.init();
  assert.deepEqual(calls.init, ['chat-a', 'chat-b']);
  assert.deepEqual(calls.groups, ['公寓业主群', '公寓业主群']);
  assert.equal(controller.getState().lastChatId, 'chat-b');
});

test('打开 APP 会渲染手机界面、注入样式并列出群聊', async () => {
  const { controller, document } = createFixture();
  await controller.open();
  assert.equal(controller.getIframeDoc(), document);
  assert.match(document.getElementById('chat-app-styles').textContent, /display: flex/);
  assert.equal(document.getElementById('home-screen').style.display, 'none');
  assert.equal(document.querySelector('.chat-item-name').textContent, '公寓业主群');
  assert.ok(document.getElementById('status-bar').classList.contains('dark'));
});

test('群聊发送会依次保存用户消息、调用 AI、同步世界书并刷新界面', async () => {
  const { controller, document, calls } = createFixture();
  await controller.open();
  await controller.openChatRoom('group');
  document.getElementById('chat-input').value = '今晚聚餐吗？';
  await controller.sendMessage();
  assert.equal(calls.sent[0].content, '今晚聚餐吗？');
  assert.deepEqual(calls.generated, ['group']);
  assert.deepEqual(calls.synced, ['group']);
  assert.equal(document.querySelectorAll('.chat-message').length, 2);
  assert.equal(document.getElementById('btn-send').disabled, false);
});

test('表情包不会触发 AI 回复，但会保存图片并同步世界书', async () => {
  const { controller, calls } = createFixture();
  await controller.open();
  await controller.openChatRoom('group');
  await controller.sendStickerMessage({ name: '开心', description: '欢呼', imageData: 'data:image/png;base64,AA==' });
  assert.equal(calls.sent[0].content, '[表情包：欢呼]');
  assert.equal(calls.sent[0].stickerImage, 'data:image/png;base64,AA==');
  assert.deepEqual(calls.generated, []);
  assert.deepEqual(calls.synced, ['group']);
});

test('撤回消息会删除数据库记录并重新同步当前会话', async () => {
  const { controller, calls, messages } = createFixture();
  messages.get('group').push({ id: 'old-message', sender: '<user>', content: '旧消息' });
  await controller.open();
  await controller.openChatRoom('group');
  await controller.retractMessage('old-message');
  assert.deepEqual(calls.deleted, ['old-message']);
  assert.deepEqual(calls.synced, ['group']);
  assert.deepEqual(messages.get('group'), []);
});

test('所有来自聊天数据的 HTML 都会转义', () => {
  assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  assert.doesNotMatch(
    renderConversationItem({ id: 'x', type: 'private', name: '<script>x</script>', lastMessage: null }),
    /<script>/,
  );
  assert.doesNotMatch(
    renderMessage({ id: 'm', sender: '租客', content: '<svg onload=x>', gameTime: {} }, true),
    /<svg/,
  );
});

test('备份操作会生成日期文件名并及时释放临时地址', async () => {
  const calls = { clicked: 0, revoked: [], alerts: [] };
  const anchor = { click: () => calls.clicked++ };
  const operations = new ChatDataOperations({
    database: { exportData: async () => '{"version":1}' },
    hostDocument: { createElement: () => anchor },
    BlobConstructor: Blob,
    URLApi: {
      createObjectURL: () => 'blob:backup',
      revokeObjectURL: value => calls.revoked.push(value),
    },
    alert: message => calls.alerts.push(message),
    now: () => new Date('2026-08-08T00:00:00.000Z'),
  });
  assert.equal(await operations.exportBackup(), true);
  assert.equal(anchor.download, 'tenant_chat_backup_2026-08-08.json');
  assert.equal(calls.clicked, 1);
  assert.deepEqual(calls.revoked, ['blob:backup']);
  assert.deepEqual(calls.alerts, ['导出成功！']);
});

test('导入与清空操作封装确认流程，并在成功后回调界面', async () => {
  const calls = { imported: [], cleared: 0, groups: [], callbacks: 0 };
  const input = { click: () => {} };
  const operations = new ChatDataOperations({
    database: {
      importData: async (text, options) => {
        calls.imported.push({ text, options });
        return { conversations: 1, messages: 2 };
      },
      clearCurrentChatData: async () => calls.cleared++,
      getOrCreateGroupChat: async name => calls.groups.push(name),
    },
    hostDocument: { createElement: () => input },
    BlobConstructor: Blob,
    URLApi: {},
    alert: () => {},
    confirm: () => true,
  });
  operations.chooseBackupToImport({ onImported: async () => calls.callbacks++ });
  await input.onchange({ target: { files: [{ text: async () => '{"version":1}' }] } });
  assert.deepEqual(calls.imported, [{ text: '{"version":1}', options: { merge: true } }]);
  assert.equal(calls.callbacks, 1);
  assert.equal(await operations.clearAll(), true);
  assert.equal(calls.cleared, 1);
  assert.deepEqual(calls.groups, ['公寓业主群']);
});
