import { ChatCore } from '../src/chat/chat-core.js';

export function activate(context) {
  const hostFetch = context.host.fetch?.bind(context.host);
  if (!hostFetch) throw new Error('聊天核心无法访问 fetch');
  const regexFilter = context.legacy.get('getRegexedString');
  const core = new ChatCore({
    database: context.services.require('chat.database'),
    mvu: context.mvu,
    getTenantAnalyzer: () => context.legacy.get('TenantAnalyzer'),
    getPhoneSystem: () => context.legacy.get('PhoneSystem'),
    getStoryMessages: () => context.legacy.get('SillyTavern')?.getContext?.()?.chat ?? [],
    regexFilter: typeof regexFilter === 'function' ? regexFilter : null,
    request: hostFetch,
    createAbortController: () => new context.host.AbortController(),
    logger: context.logger,
  });
  context.services.register('chat.core', core, { legacyGlobal: 'ChatCore' });
  context.logger.info('聊天核心服务已就绪');
  return () => core.dispose();
}
