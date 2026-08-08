import { getHostGlobal } from './core/host.js';

function findApi(name) {
  const value = getHostGlobal(name);
  return typeof value === 'function' ? value : null;
}

function requireApi(name) {
  const api = findApi(name);
  if (!api) {
    throw new Error(`酒馆助手接口 ${name} 不可用，请检查酒馆助手版本和脚本加载状态`);
  }
  return api;
}

function assertTextResult(result) {
  if (typeof result !== 'string') {
    throw new Error('本次 AI 请求返回了工具调用结果，而不是可解析的文本');
  }
  return result;
}

export function createTavernHelperService() {
  return {
    has(name) {
      return Boolean(findApi(name));
    },

    async getRecentMessages(limit = 12) {
      const messages = await Promise.resolve(
        requireApi('getChatMessages')('0-{{lastMessageId}}', {
          role: 'all',
          hide_state: 'unhidden',
          include_swipes: false,
        }),
      );
      return messages.slice(-Math.max(1, limit));
    },

    async generateWithStoryContext(config) {
      const result = await requireApi('generate')({
        ...config,
        should_silence: true,
      });
      return assertTextResult(result);
    },

    async generateIsolated(config) {
      const result = await requireApi('generateRaw')({
        ...config,
        should_silence: true,
      });
      return assertTextResult(result);
    },

    async generateStructured({ schemaName, schema, mode = 'raw', ...config }) {
      const generator = mode === 'story' ? this.generateWithStoryContext : this.generateIsolated;
      const text = await generator.call(this, {
        ...config,
        json_schema: {
          name: schemaName,
          value: schema,
        },
      });
      return JSON.parse(text);
    },

    async getCurrentCharacterWorldbook() {
      const getNames = requireApi('getCharWorldbookNames');
      const binding = getNames('current');
      if (!binding?.primary) return [];
      return await requireApi('getWorldbook')(binding.primary);
    },

    async getWorldbook(name) {
      return await requireApi('getWorldbook')(name);
    },

    async updateWorldbook(name, updater) {
      return await requireApi('updateWorldbookWith')(name, updater);
    },

    async getOrCreateChatWorldbook(scope = 'current') {
      const api = findApi('getOrCreateChatWorldbook') ?? findApi('getOrCreateChatLorebook');
      if (!api) return null;
      return await api(scope);
    },
  };
}
