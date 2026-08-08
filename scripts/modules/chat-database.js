import { ChatDatabase } from '../src/chat/chat-database.js';

export function activate(context) {
  const database = new ChatDatabase({
    databaseFactory: context.host.indexedDB,
    getGameState: () => context.mvu.getLatestState(),
    logger: context.logger,
  });
  context.services.register('chat.database', database, { legacyGlobal: 'ChatDB' });
  context.logger.info('聊天数据库服务已就绪');
  return () => database.dispose();
}
