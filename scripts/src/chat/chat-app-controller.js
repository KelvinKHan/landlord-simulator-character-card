import {
  DEFAULT_GROUP_NAME,
  renderAppShell,
  renderChatRoom,
  renderConversationItem,
  renderMessage,
  renderSettings,
  renderStickerGrid,
  renderTenantSelector,
} from './chat-app-view.js';

const EMPTY_LIST = `
  <div class="empty-state">
    <img src="https://api.iconify.design/ri:chat-smile-3-line.svg">
    <div class="empty-state-text">暂无消息<br>点击右上角 + 开始私聊</div>
  </div>`;
const EMPTY_MESSAGES = `
  <div class="empty-state">
    <img src="https://api.iconify.design/ri:chat-1-line.svg">
    <div class="empty-state-text">打个招呼吧</div>
  </div>`;

function sortConversations(conversations) {
  return [...conversations].sort((left, right) => {
    if (left.type === 'group' && right.type !== 'group') return -1;
    if (right.type === 'group' && left.type !== 'group') return 1;
    return (right.updatedAt?.时间 || '').localeCompare(left.updatedAt?.时间 || '');
  });
}

export class ChatAppController {
  constructor({
    database,
    core,
    sync,
    phoneSystem,
    stickerRepository,
    dataOperations,
    getContext,
    getHostJquery = () => null,
    styles = '',
    alert = () => {},
    logger = console,
  }) {
    this.database = database;
    this.core = core;
    this.sync = sync;
    this.phoneSystem = phoneSystem;
    this.stickerRepository = stickerRepository;
    this.dataOperations = dataOperations;
    this.getContext = getContext;
    this.getHostJquery = getHostJquery;
    this.styles = styles;
    this.alert = alert;
    this.logger = logger;
    this.currentIframeDoc = null;
    this.cachedUserAvatarPath = null;
    this.stickers = [];
    this.state = {
      currentView: 'list',
      currentConversation: null,
      conversations: [],
      messages: [],
      isInitialized: false,
      lastChatId: null,
    };
  }

  async init(forceReinit = false) {
    const chatId = this.#getCurrentChatId();
    if (this.state.isInitialized && !forceReinit && this.state.lastChatId === chatId) return;
    await this.database.init(chatId);
    await this.database.getOrCreateGroupChat(DEFAULT_GROUP_NAME);
    this.state.isInitialized = true;
    this.state.lastChatId = chatId;
    this.state.currentView = 'list';
    this.state.currentConversation = null;
    this.cachedUserAvatarPath = null;
    this.logger.info('聊天 APP 初始化完成', chatId);
  }

  getState() {
    return this.state;
  }

  getIframeDoc() {
    return this.currentIframeDoc;
  }

  async open() {
    const doc = this.phoneSystem.iframeWindow?.document;
    if (!doc) throw new Error('小手机界面尚未就绪');
    const appContainer = doc.getElementById('app-container');
    if (!appContainer) throw new Error('小手机缺少 app-container');
    this.currentIframeDoc = doc;
    this.#setPhoneChrome(true);
    this.#ensureStyles();
    await this.init();
    appContainer.innerHTML = `<div id="chat-app-wrapper" style="width:100%;height:100%">${renderAppShell()}</div>`;
    this.#bindListEvents();
    await this.renderChatList();
  }

  close() {
    const doc = this.currentIframeDoc ?? this.phoneSystem.iframeWindow?.document;
    if (doc) {
      const appContainer = doc.getElementById('app-container');
      if (appContainer) {
        appContainer.innerHTML = '';
        appContainer.style.pointerEvents = 'none';
      }
      const homeScreen = doc.getElementById('home-screen');
      if (homeScreen) homeScreen.style.display = 'block';
      const statusBar = doc.getElementById('status-bar');
      statusBar?.classList.remove('dark');
      statusBar?.classList.add('light');
    }
    this.state.currentView = 'list';
    this.state.currentConversation = null;
    this.currentIframeDoc = null;
  }

  async renderChatList() {
    const container = this.currentIframeDoc?.getElementById('chat-list');
    if (!container) return;
    try {
      this.state.conversations = sortConversations(await this.database.getConversations());
      container.innerHTML = this.state.conversations.length
        ? this.state.conversations.map(renderConversationItem).join('')
        : EMPTY_LIST;
      container.querySelectorAll('.chat-list-item').forEach(item => {
        item.addEventListener('click', () => void this.openChatRoom(item.dataset.convId));
      });
    } catch (error) {
      this.logger.error('渲染会话列表失败', error);
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">加载失败</div></div>';
    }
  }

  async openChatRoom(conversationId) {
    const conversation = await this.database.getConversation(conversationId);
    const appContainer = this.currentIframeDoc?.getElementById('app-container');
    if (!conversation || !appContainer) return;
    this.state.currentConversation = conversation;
    this.state.currentView = 'room';
    appContainer.innerHTML = `<div class="chat-app" id="chat-app-container">${renderChatRoom(conversation)}</div>`;
    await this.renderMessages();
    this.#bindRoomEvents();
  }

  async renderMessages() {
    const container = this.currentIframeDoc?.getElementById('chat-messages');
    const conversation = this.state.currentConversation;
    if (!container || !conversation) return;
    try {
      this.state.messages = await this.database.getMessages(conversation.id, 100);
      const userAvatar = this.#getUserAvatarPath();
      container.innerHTML = this.state.messages.length
        ? this.state.messages.map(message => renderMessage(message, conversation.type === 'group', userAvatar)).join('')
        : EMPTY_MESSAGES;
      container.scrollTop = container.scrollHeight;
    } catch (error) {
      this.logger.error('渲染消息失败', error);
    }
  }

  async sendMessage() {
    const doc = this.currentIframeDoc;
    const conversation = this.state.currentConversation;
    const input = doc?.getElementById('chat-input');
    const sendButton = doc?.getElementById('btn-send');
    const content = input?.value.trim();
    if (!doc || !conversation || !input || !sendButton || !content) return;
    this.#setSending(true, input, sendButton);
    try {
      await this.core.sendUserMessage(conversation.id, content);
      input.value = '';
      await this.renderMessages();
      doc.getElementById('typing-indicator')?.classList.add('show');
      if (conversation.type === 'group') await this.core.generateGroupReply(conversation.id, content);
      else await this.core.generatePrivateReply(conversation.id, content);
      await this.sync.instantSync(conversation.id);
      await this.renderMessages();
    } catch (error) {
      this.logger.error('发送消息失败', error);
      this.alert(`发送失败: ${error.message}`);
    } finally {
      this.#setSending(false, input, sendButton);
      doc.getElementById('typing-indicator')?.classList.remove('show');
      input.focus();
    }
  }

  async renderStickerPicker() {
    const grid = this.currentIframeDoc?.getElementById('sticker-picker-grid');
    if (!grid) return;
    this.stickers = await this.stickerRepository.getStickers();
    grid.innerHTML = renderStickerGrid(this.stickers);
    grid.querySelectorAll('.sticker-picker-item').forEach(item => {
      item.addEventListener('click', () => {
        const sticker = this.stickers.find(candidate => String(candidate.id) === item.dataset.stickerId);
        if (sticker) void this.sendStickerMessage(sticker);
      });
    });
  }

  async toggleStickerPicker() {
    const panel = this.currentIframeDoc?.getElementById('sticker-picker-panel');
    const button = this.currentIframeDoc?.getElementById('btn-sticker-toggle');
    if (!panel) return;
    const shouldShow = !panel.classList.contains('show');
    panel.classList.toggle('show', shouldShow);
    button?.classList.toggle('sticker-btn-active', shouldShow);
    if (shouldShow) await this.renderStickerPicker();
  }

  async sendStickerMessage(sticker) {
    const conversation = this.state.currentConversation;
    if (!conversation) return;
    this.#closeStickerPicker();
    try {
      const content = `[表情包：${sticker.description || sticker.name || '表情包'}]`;
      await this.core.sendUserMessage(conversation.id, content, { stickerImage: sticker.imageData || '' });
      await this.renderMessages();
      await this.sync.instantSync(conversation.id);
    } catch (error) {
      this.logger.error('发送表情包失败', error);
      this.alert(`发送失败: ${error.message}`);
    }
  }

  async retractMessage(messageId) {
    const conversation = this.state.currentConversation;
    if (!conversation) return;
    try {
      await this.database.deleteMessage(messageId);
      await this.renderMessages();
      await this.sync.instantSync(conversation.id);
    } catch (error) {
      this.logger.error('撤回消息失败', error);
      this.alert(`撤回失败: ${error.message}`);
    }
  }

  async retractLastMessages(count = 2) {
    const conversation = this.state.currentConversation;
    if (!conversation) return [];
    try {
      const deleted = await this.database.deleteLastMessages(conversation.id, count);
      await this.renderMessages();
      await this.sync.instantSync(conversation.id);
      return deleted;
    } catch (error) {
      this.logger.error('批量撤回失败', error);
      this.alert(`撤回失败: ${error.message}`);
      return [];
    }
  }

  async showListView() {
    const container = this.currentIframeDoc?.getElementById('app-container');
    if (!container) return;
    this.state.currentView = 'list';
    this.state.currentConversation = null;
    container.innerHTML = `<div id="chat-app-wrapper" style="width:100%;height:100%">${renderAppShell()}</div>`;
    this.#bindListEvents();
    await this.renderChatList();
  }

  async showSettings() {
    const container = this.currentIframeDoc?.getElementById('chat-app-container');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', renderSettings(await this.database.getStats()));
    const doc = this.currentIframeDoc;
    doc.getElementById('btn-settings-back')?.addEventListener('click', () => doc.getElementById('chat-settings-panel')?.remove());
    doc.getElementById('btn-export-data')?.addEventListener('click', () => void this.exportData());
    doc.getElementById('btn-import-data')?.addEventListener('click', () => this.importData());
    doc.getElementById('btn-sync-members')?.addEventListener('click', () => void this.syncMembers());
    doc.getElementById('btn-clear-data')?.addEventListener('click', () => void this.clearData());
  }

  async showTenantSelector() {
    const container = this.currentIframeDoc?.getElementById('chat-app-container');
    if (!container) return;
    const conversations = await this.database.getConversations();
    container.insertAdjacentHTML('beforeend', renderTenantSelector(this.database.getTenantList(), conversations));
    const doc = this.currentIframeDoc;
    doc.getElementById('btn-selector-back')?.addEventListener('click', () => doc.getElementById('tenant-selector')?.remove());
    doc.querySelectorAll('.tenant-item').forEach(item => {
      item.addEventListener('click', () => void this.createPrivateChat(item.dataset.name));
    });
  }

  async createPrivateChat(tenantName) {
    const conversation = await this.database.getOrCreatePrivateChat(tenantName);
    this.currentIframeDoc?.getElementById('tenant-selector')?.remove();
    await this.openChatRoom(conversation.id);
  }

  async exportData() {
    return this.dataOperations.exportBackup();
  }

  importData() {
    return this.dataOperations.chooseBackupToImport({
      onImported: async () => {
        this.currentIframeDoc?.getElementById('chat-settings-panel')?.remove();
        await this.renderChatList();
      },
    });
  }

  async syncMembers() {
    return this.dataOperations.syncGroupMembers();
  }

  async clearData() {
    if (!(await this.dataOperations.clearAll())) return false;
    this.currentIframeDoc?.getElementById('chat-settings-panel')?.remove();
    await this.renderChatList();
    return true;
  }

  dispose() {
    const doc = this.currentIframeDoc ?? this.phoneSystem.iframeWindow?.document;
    this.close();
    doc?.getElementById('chat-app-styles')?.remove();
    this.stickerRepository.clearCache();
  }

  #getCurrentChatId() {
    try {
      const context = this.getContext?.();
      return context?.chatId || context?.chat_id || 'default_chat';
    } catch {
      return 'default_chat';
    }
  }

  #getUserAvatarPath() {
    if (this.cachedUserAvatarPath) return this.cachedUserAvatarPath;
    try {
      const jquery = this.getHostJquery();
      const selectors = [
        '[is_user="true"] .avatar img',
        '#user_avatar_block .avatar-container.selected img',
        '#user_avatar img',
      ];
      for (const selector of selectors) {
        const value = jquery?.(selector).first?.().attr?.('src') ?? jquery?.(selector).attr?.('src');
        if (value) return (this.cachedUserAvatarPath = value);
      }
    } catch (error) {
      this.logger.warn('获取用户头像失败', error);
    }
    return null;
  }

  #setPhoneChrome(isOpen) {
    const doc = this.currentIframeDoc;
    const appContainer = doc?.getElementById('app-container');
    const homeScreen = doc?.getElementById('home-screen');
    const statusBar = doc?.getElementById('status-bar');
    if (homeScreen) homeScreen.style.display = isOpen ? 'none' : 'block';
    if (appContainer) {
      appContainer.style.display = isOpen ? 'block' : 'none';
      appContainer.style.pointerEvents = isOpen ? 'auto' : 'none';
    }
    statusBar?.classList.toggle('light', !isOpen);
    statusBar?.classList.toggle('dark', isOpen);
  }

  #ensureStyles() {
    const doc = this.currentIframeDoc;
    if (!doc || doc.getElementById('chat-app-styles')) return;
    const style = doc.createElement('style');
    style.id = 'chat-app-styles';
    style.textContent = this.styles;
    doc.head.appendChild(style);
  }

  #bindListEvents() {
    const doc = this.currentIframeDoc;
    doc?.getElementById('btn-go-home')?.addEventListener('click', () => this.phoneSystem.goHome());
    doc?.getElementById('btn-new-chat')?.addEventListener('click', () => void this.showTenantSelector());
    doc?.getElementById('btn-chat-settings')?.addEventListener('click', () => void this.showSettings());
  }

  #bindRoomEvents() {
    const doc = this.currentIframeDoc;
    doc?.getElementById('btn-back-to-list')?.addEventListener('click', () => void this.showListView());
    doc?.getElementById('btn-send')?.addEventListener('click', () => void this.sendMessage());
    doc?.getElementById('btn-sticker-toggle')?.addEventListener('click', () => void this.toggleStickerPicker());
    const input = doc?.getElementById('chat-input');
    input?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void this.sendMessage();
      }
    });
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 100)}px`;
    });
    input?.addEventListener('focus', () => this.#closeStickerPicker());
    doc?.getElementById('chat-messages')?.addEventListener('click', event => {
      const button = event.target.closest?.('.msg-retract-btn');
      if (button?.dataset.msgId) {
        event.stopPropagation();
        void this.retractMessage(button.dataset.msgId);
      }
    });
  }

  #closeStickerPicker() {
    this.currentIframeDoc?.getElementById('sticker-picker-panel')?.classList.remove('show');
    this.currentIframeDoc?.getElementById('btn-sticker-toggle')?.classList.remove('sticker-btn-active');
  }

  #setSending(isSending, input, button) {
    input.disabled = isSending;
    button.disabled = isSending;
    button.textContent = isSending ? '...' : '发送';
    button.classList.toggle('loading', isSending);
  }
}
