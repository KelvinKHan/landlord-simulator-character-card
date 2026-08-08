import { ChatSync } from '../src/chat/chat-sync.js';

export function activate(context) {
  const database = context.services.require('chat.database');
  const sync = new ChatSync({
    database,
    tavern: context.tavern,
    getContext: () => context.legacy.get('SillyTavern')?.getContext?.() ?? null,
    storage: context.host.sessionStorage,
    document: context.document,
    EventConstructor: context.host.Event,
    setTimer: context.host.setTimeout.bind(context.host),
    clearTimer: context.host.clearTimeout.bind(context.host),
    logger: context.logger,
  });
  context.lifecycle.onDispose(
    database.on('conversation:deleting', ({ conversation }) => sync.deleteFromChatLore(conversation)),
  );
  context.lifecycle.onDispose(database.on('all:clearing', () => sync.clearAllChatLore()));
  context.services.register('chat.sync', sync, { legacyGlobal: 'ChatSync' });
  context.logger.info('聊天正文联动服务已就绪');
  return () => sync.dispose();
}
