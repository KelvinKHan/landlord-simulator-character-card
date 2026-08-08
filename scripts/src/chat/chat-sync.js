const DEFAULT_CONFIG = Object.freeze({
  CHAT_LORE_PREFIX: '[租客微信]',
  GROUP_ENTRY_NAME: '[群聊记录]',
  SUMMARY_MAX_LENGTH: 800,
  instantSyncEnabled: true,
  SYNC_DEBOUNCE_MS: 500,
  WORLDBOOK_NAME: null,
});

function createWorldbookEntry(entryName, targetName, content) {
  return {
    name: entryName,
    enabled: true,
    content,
    strategy: {
      type: 'constant',
      keys: [entryName, `${targetName}微信`, `${targetName}聊天记录`],
      keys_secondary: { logic: 'and_any', keys: [] },
      scan_depth: 'same_as_global',
    },
    position: { type: 'at_depth', role: 'system', depth: 4, order: 100 },
    probability: 100,
  };
}

export class ChatSync {
  constructor({
    database,
    tavern,
    getContext,
    storage,
    document,
    EventConstructor,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    logger = console,
  }) {
    this.database = database;
    this.tavern = tavern;
    this.getContext = getContext;
    this.storage = storage;
    this.document = document;
    this.EventConstructor = EventConstructor;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG };
    this.lastSyncedMessageId = null;
    this.syncInProgress = false;
    this.syncingConversations = new Set();
    this.syncDebounceTimers = Object.create(null);
    this.worldbookChatId = null;
  }

  instantSync(conversationId) {
    if (!this.config.instantSyncEnabled) return;
    if (this.syncDebounceTimers[conversationId]) this.clearTimer(this.syncDebounceTimers[conversationId]);
    this.syncDebounceTimers[conversationId] = this.setTimer(async () => {
      try {
        await this.syncToChatLore(conversationId);
      } finally {
        delete this.syncDebounceTimers[conversationId];
      }
    }, this.config.SYNC_DEBOUNCE_MS);
  }

  async deleteFromChatLore(conversationOrId) {
    try {
      const conversation =
        typeof conversationOrId === 'string'
          ? await this.database.getConversation(conversationOrId)
          : conversationOrId;
      if (!conversation) return false;
      const worldbook = await this.ensureChatLore();
      if (!worldbook || !this.tavern.has('updateWorldbookWith')) return false;
      const entryName = `${this.config.CHAT_LORE_PREFIX}${
        conversation.type === 'group' ? '群聊记录' : conversation.members[0]
      }`;
      await this.tavern.updateWorldbook(worldbook, entries => entries.filter(entry => entry.name !== entryName));
      return true;
    } catch (error) {
      this.logger.error('删除聊天世界书条目失败', error);
      return false;
    }
  }

  async clearAllChatLore() {
    try {
      const worldbook = await this.ensureChatLore();
      if (!worldbook || !this.tavern.has('updateWorldbookWith')) return false;
      await this.tavern.updateWorldbook(worldbook, entries =>
        entries.filter(entry => !entry.name?.startsWith(this.config.CHAT_LORE_PREFIX)),
      );
      return true;
    } catch (error) {
      this.logger.error('清空聊天世界书失败', error);
      return false;
    }
  }

  async syncToChatLore(conversationId) {
    if (this.syncingConversations.has(conversationId)) return false;
    this.syncingConversations.add(conversationId);
    this.syncInProgress = true;
    try {
      const conversation = await this.database.getConversation(conversationId);
      if (!conversation) throw new Error('会话不存在');
      const messages = await this.database.getRecentMessages(conversationId, 30);
      if (messages.length === 0) return true;
      const targetName = conversation.type === 'group' ? '群聊记录' : conversation.members[0];
      if (!(await this.updateChatLore(targetName, this.generateChatSummary(conversation, messages)))) return false;
      await Promise.all(
        messages.filter(message => !message.syncedToLore).map(message => this.database.markAsSynced(message.id)),
      );
      this.lastSyncedMessageId = messages.at(-1).id;
      return true;
    } catch (error) {
      this.logger.error('同步聊天世界书失败', error);
      return false;
    } finally {
      this.syncingConversations.delete(conversationId);
      this.syncInProgress = this.syncingConversations.size > 0;
    }
  }

  generateChatSummary(conversation, messages) {
    const isGroup = conversation.type === 'group';
    const latestTime = messages.at(-1)?.gameTime;
    let summary = '【微信聊天记录摘要】\n';
    summary += `更新时间: ${latestTime ? `${latestTime.日期 || '?'} ${latestTime.时间 || ''}` : '未知时间'}\n`;
    if (isGroup) {
      summary += `群聊: ${conversation.name}\n参与者: ${conversation.members.join('、')}\n`;
    } else {
      summary += `私聊对象: ${conversation.members[0]}\n`;
    }
    summary += '---\n';

    let currentDate = '';
    for (const message of messages.slice(-(isGroup ? 10 : 8))) {
      const date = message.gameTime?.日期 || '';
      if (date && date !== currentDate) {
        summary += `\n【${date}】\n`;
        currentDate = date;
      }
      const sender = message.sender === '<user>' ? '房东' : message.sender;
      const content = String(message.content ?? '');
      summary += `[${message.gameTime?.时间 || ''}] ${sender}: ${
        content.length > 80 ? `${content.slice(0, 80)}...` : content
      }\n`;
    }

    if (summary.length <= this.config.SUMMARY_MAX_LENGTH) return summary;
    const keepStart = 200;
    const keepEnd = this.config.SUMMARY_MAX_LENGTH - keepStart - 50;
    return `${summary.slice(0, keepStart)}\n...(中间消息已省略)...\n${summary.slice(-keepEnd)}`;
  }

  async updateChatLore(targetName, content) {
    try {
      const worldbook = await this.ensureChatLore();
      if (!worldbook) return false;
      const entryName = `${this.config.CHAT_LORE_PREFIX}${targetName}`;
      if (this.tavern.has('updateWorldbookWith')) {
        await this.tavern.updateWorldbook(worldbook, entries => {
          const nextEntry = createWorldbookEntry(entryName, targetName, content);
          const index = entries.findIndex(entry => entry.name === entryName);
          if (index >= 0) entries[index] = { ...entries[index], ...nextEntry };
          else entries.push(nextEntry);
          return entries;
        });
        return true;
      }

      const context = this.getContext?.();
      if (context?.executeSlashCommandsWithOptions) {
        const escaped = content.replaceAll('"', '\\"').replaceAll('\n', '\\n');
        await context.executeSlashCommandsWithOptions(
          `/createentry file="${worldbook}" key="${entryName}" "${escaped}"`,
          { handleParserErrors: false },
        );
        return true;
      }
      if (context?.setVariable) {
        context.setVariable(`wechat_${targetName.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}`, content);
        return true;
      }
    } catch (error) {
      this.logger.error('更新聊天世界书失败', error);
    }
    return false;
  }

  async ensureChatLore() {
    const context = this.getContext?.();
    const chatId = context?.chatId ?? context?.chat_id ?? 'default';
    if (this.config.WORLDBOOK_NAME && this.worldbookChatId === chatId) return this.config.WORLDBOOK_NAME;
    this.config.WORLDBOOK_NAME = null;
    this.worldbookChatId = chatId;

    try {
      const worldbook = await this.tavern.getOrCreateChatWorldbook('current');
      if (worldbook) {
        this.config.WORLDBOOK_NAME = worldbook;
        return worldbook;
      }
    } catch (error) {
      this.logger.warn('酒馆助手无法创建聊天世界书，尝试斜杠命令', error);
    }

    if (!context?.executeSlashCommandsWithOptions) return null;
    const fallbackName = `微信记录_${String(chatId).slice(0, 8)}`;
    try {
      await context.executeSlashCommandsWithOptions(`/createbook ${fallbackName}`, {
        handleParserErrors: false,
      });
    } catch {
      // 世界书可能已经存在。
    }
    this.config.WORLDBOOK_NAME = fallbackName;
    return fallbackName;
  }

  checkTenantChanges() {
    const current = this.database.getTenantList();
    const cached = this.getCachedTenantList();
    const changes = {
      added: current.filter(name => !cached.includes(name)),
      removed: cached.filter(name => !current.includes(name)),
      updated: [],
    };
    this.setCachedTenantList(current);
    return changes;
  }

  getCachedTenantList() {
    try {
      return JSON.parse(this.storage?.getItem(this.#tenantCacheKey()) ?? '[]');
    } catch {
      return [];
    }
  }

  setCachedTenantList(list) {
    try {
      this.storage?.setItem(this.#tenantCacheKey(), JSON.stringify(list));
    } catch {
      // 隐私模式下存储可能不可用，不影响聊天主流程。
    }
  }

  onMessageSent(conversationId) {
    this.instantSync(conversationId);
  }

  onConversationDeleting(conversationId) {
    return this.deleteFromChatLore(conversationId);
  }

  onAllChatsClearing() {
    return this.clearAllChatLore();
  }

  async syncAll() {
    let successCount = 0;
    for (const conversation of await this.database.getConversations()) {
      if (await this.syncToChatLore(conversation.id)) successCount += 1;
    }
    return successCount;
  }

  async getStatus() {
    let totalMessages = 0;
    let syncedMessages = 0;
    for (const conversation of await this.database.getConversations()) {
      const messages = await this.database.getMessages(conversation.id, Infinity);
      totalMessages += messages.length;
      syncedMessages += messages.filter(message => message.syncedToLore).length;
    }
    return {
      totalMessages,
      syncedMessages,
      unsyncedMessages: totalMessages - syncedMessages,
      instantSyncEnabled: this.config.instantSyncEnabled,
      lastSyncedMessageId: this.lastSyncedMessageId,
      worldbookName: this.config.WORLDBOOK_NAME,
    };
  }

  setConfig(key, value) {
    if (!(key in this.config)) return false;
    this.config[key] = value;
    return true;
  }

  async listChatLoreEntries() {
    try {
      const worldbook = await this.ensureChatLore();
      if (!worldbook || !this.tavern.has('getWorldbook')) return [];
      return (await this.tavern.getWorldbook(worldbook)).filter(entry =>
        entry.name?.startsWith(this.config.CHAT_LORE_PREFIX),
      );
    } catch (error) {
      this.logger.error('读取聊天世界书失败', error);
      return [];
    }
  }

  forceSyncNow(conversationId) {
    if (this.syncDebounceTimers[conversationId]) {
      this.clearTimer(this.syncDebounceTimers[conversationId]);
      delete this.syncDebounceTimers[conversationId];
    }
    return this.syncToChatLore(conversationId);
  }

  async generateStoryPrompt(conversationId, topic) {
    const conversation = await this.database.getConversation(conversationId);
    if (!conversation) return null;
    const summary = this.generateChatSummary(
      conversation,
      await this.database.getRecentMessages(conversationId, 10),
    );
    const subject = topic || (conversation.type === 'group' ? '大家讨论的内容' : '聊天内容');
    const memory =
      conversation.type === 'group'
        ? `（你想起刚才在业主群里的聊天：${subject}）`
        : `（你想起刚才和${conversation.members[0]}的微信聊天：${subject}）`;
    return `${memory}\n[系统提示：以下是最近的${
      conversation.type === 'group' ? '群聊' : '私聊'
    }记录，请在正文中自然地体现或提及]\n${summary}`;
  }

  async injectToInput(conversationId, topic) {
    const prompt = await this.generateStoryPrompt(conversationId, topic);
    const textarea = this.document?.querySelector('#send_textarea');
    if (!prompt || !textarea) return false;
    textarea.value += `${textarea.value ? '\n\n' : ''}${prompt}`;
    textarea.dispatchEvent(new this.EventConstructor('input', { bubbles: true }));
    return true;
  }

  dispose() {
    for (const timer of Object.values(this.syncDebounceTimers)) this.clearTimer(timer);
    this.syncDebounceTimers = Object.create(null);
    this.syncingConversations.clear();
    this.syncInProgress = false;
  }

  #tenantCacheKey() {
    const context = this.getContext?.();
    return `chat_sync_tenant_cache:${context?.chatId ?? context?.chat_id ?? 'default'}`;
  }
}
