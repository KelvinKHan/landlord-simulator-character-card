import chatAppStyles from '../assets/chat-app.css';
import { ChatAppController } from '../src/chat/chat-app-controller.js';
import { ChatDataOperations } from '../src/chat/chat-data-operations.js';
import { CHAT_APP_DEFINITION } from '../src/chat/chat-app-view.js';
import { WorkshopStickerRepository } from '../src/chat/sticker-repository.js';

export function activate(context) {
  const phoneSystem = context.legacy.require('PhoneSystem');
  const database = context.services.require('chat.database');
  const alert = context.host.alert.bind(context.host);
  const confirm = context.host.confirm.bind(context.host);
  const app = new ChatAppController({
    database,
    core: context.services.require('chat.core'),
    sync: context.services.require('chat.sync'),
    phoneSystem,
    stickerRepository: new WorkshopStickerRepository({
      databaseFactory: context.host.indexedDB,
      logger: context.logger,
    }),
    dataOperations: new ChatDataOperations({
      database,
      hostDocument: context.document,
      BlobConstructor: context.host.Blob,
      URLApi: context.host.URL,
      alert,
      confirm,
      logger: context.logger,
    }),
    getContext: () => context.legacy.get('SillyTavern')?.getContext?.() ?? null,
    getHostJquery: () => context.legacy.get('$'),
    styles: chatAppStyles,
    alert,
    logger: context.logger,
  });

  const openHandler = data => {
    if (data?.id === CHAT_APP_DEFINITION.id) {
      void app.open().catch(error => context.logger.error('打开聊天 APP 失败', error));
    }
  };
  const homeHandler = () => app.close();

  phoneSystem.registerApp(CHAT_APP_DEFINITION);
  const registeredApp = phoneSystem.registeredApps?.get(CHAT_APP_DEFINITION.id);
  phoneSystem.on('app-opened', openHandler);
  phoneSystem.on('go-home', homeHandler);
  context.lifecycle.onDispose(() => phoneSystem.off('app-opened', openHandler));
  context.lifecycle.onDispose(() => phoneSystem.off('go-home', homeHandler));
  context.lifecycle.onDispose(() => {
    if (phoneSystem.registeredApps?.get(CHAT_APP_DEFINITION.id) === registeredApp) {
      phoneSystem.registeredApps.delete(CHAT_APP_DEFINITION.id);
    }
  });
  context.services.register('chat.app', app, { legacyGlobal: 'ChatApp' });
  context.logger.info('聊天 APP 已注册');
  return () => app.dispose();
}
