const DATABASE_NAME = 'TenantChatDB';
const DATABASE_VERSION = 1;
const CONVERSATIONS = 'conversations';
const MESSAGES = 'messages';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject(event.target.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = event => reject(event.target.error);
    transaction.onabort = event => reject(event.target.error ?? transaction.error);
  });
}

function clone(value) {
  return structuredClone(value);
}

function assertImportData(data) {
  if (data?.version !== 1) throw new Error('不支持的数据版本');
  if (!Array.isArray(data.conversations) || !Array.isArray(data.messages)) {
    throw new Error('聊天数据缺少 conversations 或 messages 数组');
  }
}

export class ChatDatabase {
  constructor({ databaseFactory, getGameState, now = () => Date.now(), random = Math.random, logger = console }) {
    if (!databaseFactory?.open) throw new Error('浏览器 IndexedDB 不可用');
    this.databaseFactory = databaseFactory;
    this.getGameState = getGameState;
    this.now = now;
    this.random = random;
    this.logger = logger;
    this.db = null;
    this.currentChatId = null;
    this.opening = null;
  }

  async init(chatId) {
    this.currentChatId = chatId ?? 'default';
    if (this.db) return this.db;
    if (!this.opening) this.opening = this.#open();
    try {
      this.db = await this.opening;
      return this.db;
    } finally {
      this.opening = null;
    }
  }

  generateId(prefix) {
    return `${prefix}_${this.now()}_${this.random().toString(36).slice(2, 11)}`;
  }

  async createConversation({ type, name, members = [] }) {
    const gameTime = this.getGameTime();
    const conversation = {
      id: this.generateId('conv'),
      chatId: this.currentChatId,
      type,
      name,
      members,
      createdAt: gameTime,
      updatedAt: gameTime,
      lastMessage: null,
    };
    await this.#write(CONVERSATIONS, store => store.add(conversation));
    return conversation;
  }

  async getConversations() {
    const transaction = this.#transaction(CONVERSATIONS);
    const result = await requestResult(transaction.objectStore(CONVERSATIONS).index('chatId').getAll(this.currentChatId));
    return result ?? [];
  }

  async getConversation(conversationId) {
    const transaction = this.#transaction(CONVERSATIONS);
    return requestResult(transaction.objectStore(CONVERSATIONS).get(conversationId));
  }

  async getOrCreateGroupChat(groupName) {
    const existing = (await this.getConversations()).find(
      conversation => conversation.type === 'group' && conversation.name === groupName,
    );
    return (
      existing ??
      this.createConversation({ type: 'group', name: groupName, members: this.getTenantList() })
    );
  }

  async getOrCreatePrivateChat(tenantName) {
    const existing = (await this.getConversations()).find(
      conversation => conversation.type === 'private' && conversation.members.includes(tenantName),
    );
    return existing ?? this.createConversation({ type: 'private', name: tenantName, members: [tenantName] });
  }

  async updateConversation(conversationId, updates) {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return null;
    const updated = { ...conversation, ...updates, updatedAt: this.getGameTime() };
    await this.#write(CONVERSATIONS, store => store.put(updated));
    return updated;
  }

  async syncGroupMembers(conversationId) {
    return this.updateConversation(conversationId, { members: this.getTenantList() });
  }

  async addMessage(conversationId, sender, content, options = {}) {
    const gameTime = this.getGameTime();
    const message = {
      id: this.generateId('msg'),
      conversationId,
      sender,
      content,
      gameTime,
      syncedToLore: false,
      isImportant: options.isImportant ?? false,
      createdAt: this.now(),
      ...(options.stickerImage ? { stickerImage: options.stickerImage } : {}),
    };
    const transaction = this.#transaction([CONVERSATIONS, MESSAGES], 'readwrite');
    const done = transactionDone(transaction);
    const conversationStore = transaction.objectStore(CONVERSATIONS);
    const conversation = await requestResult(conversationStore.get(conversationId));
    if (conversation) {
      conversation.lastMessage = { sender, content, gameTime };
      conversation.updatedAt = gameTime;
      conversationStore.put(conversation);
    }
    transaction.objectStore(MESSAGES).add(message);
    await done;
    return message;
  }

  async getMessages(conversationId, limit = 100) {
    const transaction = this.#transaction(MESSAGES);
    const result = await requestResult(
      transaction.objectStore(MESSAGES).index('conversationId').getAll(conversationId),
    );
    const messages = (result ?? []).sort((left, right) => left.createdAt - right.createdAt);
    return messages.length > limit ? messages.slice(-limit) : messages;
  }

  getRecentMessages(conversationId, count = 20) {
    return this.getMessages(conversationId, count);
  }

  async markAsSynced(messageId) {
    const transaction = this.#transaction(MESSAGES, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(MESSAGES);
    const message = await requestResult(store.get(messageId));
    if (!message) {
      await done;
      return null;
    }
    message.syncedToLore = true;
    store.put(message);
    await done;
    return message;
  }

  async deleteMessage(messageId) {
    await this.#write(MESSAGES, store => store.delete(messageId));
    return true;
  }

  async deleteLastMessages(conversationId, count = 1) {
    const messages = await this.getMessages(conversationId, Infinity);
    const deleteCount = Math.max(0, Number(count) || 0);
    if (messages.length === 0 || deleteCount === 0) return [];

    const removed = messages.slice(-deleteCount);
    const remaining = messages.slice(0, -deleteCount);
    const transaction = this.#transaction([MESSAGES, CONVERSATIONS], 'readwrite');
    const done = transactionDone(transaction);
    const messageStore = transaction.objectStore(MESSAGES);
    const conversationStore = transaction.objectStore(CONVERSATIONS);
    for (const message of removed) messageStore.delete(message.id);

    const conversation = await requestResult(conversationStore.get(conversationId));
    if (conversation) {
      const lastMessage = remaining.at(-1);
      conversation.lastMessage = lastMessage
        ? { sender: lastMessage.sender, content: lastMessage.content, gameTime: lastMessage.gameTime }
        : null;
      conversation.updatedAt = this.getGameTime();
      conversationStore.put(conversation);
    }
    await done;
    return removed;
  }

  async deleteConversation(conversationId) {
    const messages = await this.getMessages(conversationId, Infinity);
    const transaction = this.#transaction([CONVERSATIONS, MESSAGES], 'readwrite');
    const done = transactionDone(transaction);
    const messageStore = transaction.objectStore(MESSAGES);
    for (const message of messages) messageStore.delete(message.id);
    transaction.objectStore(CONVERSATIONS).delete(conversationId);
    await done;
    return true;
  }

  getGameTime() {
    try {
      const world = this.getGameState?.()?.世界;
      if (world && typeof world === 'object') return { ...world };
    } catch (error) {
      this.logger.warn('获取游戏时间失败', error);
    }
    return { 年份: '未知', 日期: '未知', 星期: '未知', 时间: '未知' };
  }

  formatGameTime(gameTime) {
    if (!gameTime) return '未知时间';
    return `${gameTime.日期} ${gameTime.星期} ${gameTime.时间}`;
  }

  getTenantList() {
    try {
      const tenants = this.getGameState?.()?.租客列表;
      return tenants && typeof tenants === 'object' ? Object.keys(tenants) : [];
    } catch (error) {
      this.logger.warn('获取租客列表失败', error);
      return [];
    }
  }

  async exportData() {
    const conversations = await this.getConversations();
    const messages = (await Promise.all(conversations.map(item => this.getMessages(item.id, Infinity)))).flat();
    return JSON.stringify(
      {
        version: 1,
        chatId: this.currentChatId,
        exportedAt: new Date(this.now()).toISOString(),
        conversations,
        messages,
      },
      null,
      2,
    );
  }

  async importData(jsonString, { merge = false } = {}) {
    const data = JSON.parse(jsonString);
    assertImportData(data);
    if (!merge) await this.clearCurrentChatData();

    const conversations = clone(data.conversations);
    const messages = clone(data.messages);
    const remappedConversationIds = new Map();
    const shouldRemapIds = merge || data.chatId !== this.currentChatId;
    for (const conversation of conversations) {
      conversation.chatId = this.currentChatId;
      if (shouldRemapIds) {
        const oldId = conversation.id;
        conversation.id = this.generateId('conv');
        remappedConversationIds.set(oldId, conversation.id);
      }
    }
    for (const message of messages) {
      message.conversationId = remappedConversationIds.get(message.conversationId) ?? message.conversationId;
      if (shouldRemapIds) message.id = this.generateId('msg');
    }

    const transaction = this.#transaction([CONVERSATIONS, MESSAGES], 'readwrite');
    const done = transactionDone(transaction);
    const conversationStore = transaction.objectStore(CONVERSATIONS);
    const messageStore = transaction.objectStore(MESSAGES);
    for (const conversation of conversations) conversationStore.put(conversation);
    for (const message of messages) messageStore.put(message);
    await done;
    return { conversations: conversations.length, messages: messages.length };
  }

  async clearCurrentChatData() {
    for (const conversation of await this.getConversations()) {
      await this.deleteConversation(conversation.id);
    }
  }

  async getStats() {
    const conversations = await this.getConversations();
    const messageGroups = await Promise.all(conversations.map(item => this.getMessages(item.id, Infinity)));
    return {
      chatId: this.currentChatId,
      conversationCount: conversations.length,
      messageCount: messageGroups.reduce((total, messages) => total + messages.length, 0),
    };
  }

  dispose() {
    this.db?.close();
    this.db = null;
    this.opening = null;
    this.currentChatId = null;
  }

  #transaction(stores, mode = 'readonly') {
    if (!this.db) throw new Error('ChatDatabase 尚未初始化');
    return this.db.transaction(stores, mode);
  }

  async #write(storeName, operation) {
    const transaction = this.#transaction(storeName, 'readwrite');
    const done = transactionDone(transaction);
    operation(transaction.objectStore(storeName));
    await done;
  }

  #open() {
    return new Promise((resolve, reject) => {
      const request = this.databaseFactory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onerror = event => reject(event.target.error);
      request.onsuccess = event => resolve(event.target.result);
      request.onupgradeneeded = event => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(CONVERSATIONS)) {
          const store = database.createObjectStore(CONVERSATIONS, { keyPath: 'id' });
          store.createIndex('chatId', 'chatId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('chatId_type', ['chatId', 'type'], { unique: false });
        }
        if (!database.objectStoreNames.contains(MESSAGES)) {
          const store = database.createObjectStore(MESSAGES, { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('conv_time', ['conversationId', 'createdAt'], { unique: false });
        }
      };
    });
  }
}
