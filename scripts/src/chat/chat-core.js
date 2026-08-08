import {
  applyBasicPromptFilter,
  cleanMessageContent,
  formatChatHistory,
  formatTenantInfo,
  parseGroupReply,
  parsePrivateReply,
} from './chat-message-format.js';
import { buildApiMessages, buildGroupPrompt, buildPrivatePrompt, JAILBREAK_LAYERS } from './chat-prompts.js';

const defaultApiConfig = Object.freeze({
  apiUrl: '',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  maxTokens: 500,
  temperature: 0.8,
});

export class ChatCore {
  constructor({
    database,
    mvu,
    getTenantAnalyzer,
    getPhoneSystem,
    getStoryMessages,
    regexFilter,
    request,
    createAbortController,
    logger = console,
  }) {
    this.database = database;
    this.mvu = mvu;
    this.getTenantAnalyzer = getTenantAnalyzer;
    this.getPhoneSystem = getPhoneSystem;
    this.getStoryMessages = getStoryMessages;
    this.regexFilter = regexFilter;
    this.request = request;
    this.createAbortController = createAbortController;
    this.logger = logger;
    this.isGenerating = false;
    this.abortController = null;
    this.JAILBREAK_LAYERS = JAILBREAK_LAYERS;
  }

  async sendUserMessage(conversationId, content, extras = {}) {
    if (!content?.trim() || !this.database.db) return null;
    return this.database.addMessage(conversationId, '<user>', content.trim(), extras);
  }

  async generateGroupReply(conversationId, userMessage) {
    return this.#withGeneration(async () => {
      const conversation = await this.database.getConversation(conversationId);
      if (!conversation || conversation.type !== 'group') throw new Error('无效的群聊会话');
      const membersInfo = await this.getMembersInfo(conversation.members);
      const history = await this.database.getRecentMessages(conversationId, 30);
      const prompt = this.buildGroupPrompt(
        membersInfo,
        this.formatChatHistory(history),
        userMessage,
        this.database.formatGameTime(this.database.getGameTime()),
        await this.getEnhancedContext('group', conversation.members),
      );
      const replies = this.parseGroupReply(await this.callAPI(prompt), conversation.members);
      return Promise.all(
        replies.map(reply => this.database.addMessage(conversationId, reply.sender, reply.content)),
      );
    });
  }

  async generatePrivateReply(conversationId, userMessage) {
    return this.#withGeneration(async () => {
      const conversation = await this.database.getConversation(conversationId);
      if (!conversation || conversation.type !== 'private') throw new Error('无效的私聊会话');
      const tenantName = conversation.members[0];
      const history = await this.database.getRecentMessages(conversationId, 30);
      const prompt = this.buildPrivatePrompt(
        tenantName,
        await this.getTenantInfo(tenantName),
        this.formatChatHistory(history),
        userMessage,
        this.database.formatGameTime(this.database.getGameTime()),
        await this.getEnhancedContext('private', [tenantName]),
      );
      const replies = parsePrivateReply(await this.callAPI(prompt), tenantName);
      return Promise.all(replies.map(content => this.database.addMessage(conversationId, tenantName, content)));
    });
  }

  abort() {
    this.abortController?.abort();
    this.abortController = null;
    this.isGenerating = false;
  }

  applyRegexFilter(text) {
    try {
      return typeof this.regexFilter === 'function'
        ? this.regexFilter(text, 2, { isPrompt: true })
        : applyBasicPromptFilter(text);
    } catch (error) {
      this.logger.warn('正文正则过滤失败', error);
      return applyBasicPromptFilter(text);
    }
  }

  async getEnhancedContext(chatType) {
    const context = { storyContext: await this.getStoryContext() };
    if (chatType === 'group') context.privateChats = await this.getAllPrivateChatsSummary();
    if (chatType === 'private') context.groupChat = await this.getGroupChatSummary();
    return context;
  }

  async getStoryContext() {
    try {
      const recentMessages = (this.getStoryMessages?.() ?? []).slice(-5);
      const sections = recentMessages
        .filter(message => message.mes)
        .map(message => {
          const content = this.applyRegexFilter(message.mes);
          return content ? `${message.is_user ? '【玩家】' : '【剧情】'}\n${content}` : '';
        })
        .filter(Boolean);
      return sections.join('\n\n') || null;
    } catch (error) {
      this.logger.warn('获取正文上下文失败', error);
      return null;
    }
  }

  async getAllPrivateChatsSummary() {
    try {
      let summary = '';
      for (const conversation of await this.database.getConversations()) {
        if (conversation.type !== 'private') continue;
        const messages = await this.database.getRecentMessages(conversation.id, 5);
        if (messages.length === 0) continue;
        summary += `【与${conversation.members[0]}的私聊】\n`;
        for (const message of messages.slice(-3)) {
          summary += `${message.sender === '<user>' ? '房东' : message.sender}: ${message.content}\n`;
        }
        summary += '\n';
      }
      return summary || null;
    } catch (error) {
      this.logger.warn('获取私聊摘要失败', error);
      return null;
    }
  }

  async getGroupChatSummary() {
    try {
      const conversation = (await this.database.getConversations()).find(item => item.type === 'group');
      if (!conversation) return null;
      const messages = await this.database.getRecentMessages(conversation.id, 10);
      if (messages.length === 0) return null;
      return `【${conversation.name}近况】\n${messages
        .slice(-5)
        .map(message => `${message.sender === '<user>' ? '房东' : message.sender}: ${message.content}`)
        .join('\n')}\n`;
    } catch (error) {
      this.logger.warn('获取群聊摘要失败', error);
      return null;
    }
  }

  async getMembersInfo(memberNames) {
    return Object.fromEntries(
      await Promise.all(memberNames.map(async name => [name, await this.getTenantInfo(name)])),
    );
  }

  async getTenantInfo(tenantName) {
    const info = {
      name: tenantName,
      mvuData: this.mvu.read(['租客列表', tenantName], null),
      baseProfile: null,
      dynamicProfile: null,
    };
    const analyzer = this.getTenantAnalyzer?.();
    if (!analyzer) return info;
    try {
      [info.baseProfile, info.dynamicProfile] = await Promise.all([
        analyzer.getBaseProfile(tenantName),
        analyzer.getDynamicProfile(tenantName),
      ]);
    } catch (error) {
      this.logger.warn(`获取租客「${tenantName}」档案失败`, error);
    }
    return info;
  }

  formatTenantInfo(tenantName, info) {
    return formatTenantInfo(tenantName, info);
  }

  buildGroupPrompt(membersInfo, historyText, userMessage, timeText, context = {}) {
    return buildGroupPrompt({ membersInfo, historyText, userMessage, timeText, context });
  }

  buildPrivatePrompt(tenantName, tenantInfo, historyText, userMessage, timeText, context = {}) {
    return buildPrivatePrompt({ tenantName, tenantInfo, historyText, userMessage, timeText, context });
  }

  formatChatHistory(messages) {
    return formatChatHistory(messages);
  }

  cleanMessageContent(content, expectedSender = null) {
    return cleanMessageContent(content, expectedSender);
  }

  parseGroupReply(response, validMembers) {
    return parseGroupReply(response, validMembers);
  }

  async callAPI(prompt) {
    const config = this.getAPIConfig();
    if (!config.apiUrl || !config.apiKey) throw new Error('请先在手机设置中配置API');
    const apiUrl = this.#normalizeApiUrl(config.apiUrl);
    const response = await this.request(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: buildApiMessages(prompt),
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: 0.95,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }),
      signal: this.abortController?.signal,
    });
    if (!response.ok) throw new Error(`API请求失败: ${response.status} - ${await response.text()}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('API返回格式异常');
    return content;
  }

  getAPIConfig() {
    const apiConfig = this.getPhoneSystem?.()?.getSettings?.()?.apiConfig;
    if (!apiConfig?.apiKey) return { ...defaultApiConfig };
    return {
      apiUrl: apiConfig.apiUrl || '',
      apiKey: apiConfig.apiKey || '',
      model: apiConfig.model || defaultApiConfig.model,
      maxTokens: apiConfig.maxTokens || defaultApiConfig.maxTokens,
      temperature: apiConfig.temperature || defaultApiConfig.temperature,
    };
  }

  getStatus() {
    return { isGenerating: this.isGenerating };
  }

  dispose() {
    this.abort();
  }

  async #withGeneration(operation) {
    if (this.isGenerating) return null;
    this.isGenerating = true;
    this.abortController = this.createAbortController();
    try {
      return await operation();
    } finally {
      this.isGenerating = false;
      this.abortController = null;
    }
  }

  #normalizeApiUrl(value) {
    if (value.includes('/chat/completions')) return value;
    const base = value.endsWith('/') ? value : `${value}/`;
    return base.includes('/v1/') || base.endsWith('/v1/')
      ? `${base}chat/completions`
      : `${base}v1/chat/completions`;
  }
}
