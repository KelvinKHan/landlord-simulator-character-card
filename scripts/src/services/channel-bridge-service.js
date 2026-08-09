function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function createLegacyChannelPorts({ getLegacy, logger = console }) {
  if (typeof getLegacy !== 'function') throw new TypeError('旧模块适配器需要延迟全局读取函数');
  return Object.freeze({
    capabilities() {
      const chatDb = getLegacy('ChatDB');
      const phone = getLegacy('PhoneSystem');
      return Object.freeze({
        正文: true,
        微信: Boolean(chatDb?.getOrCreateGroupChat && chatDb?.addMessage),
        新闻: Boolean(phone?.newsSystem?.newsData && phone?.emit),
        建筑: true,
      });
    },

    async story(draft) {
      // 正文频道只返回可注入上下文，不擅自修改聊天或世界书。
      return draft;
    },

    async wechat(draft) {
      const chatDb = getLegacy('ChatDB');
      if (!chatDb?.getOrCreateGroupChat || !chatDb?.addMessage) throw new Error('微信数据库尚未就绪');
      const conversation = await chatDb.getOrCreateGroupChat(draft.conversationName);
      const message = await chatDb.addMessage(conversation.id, draft.sender, draft.content, { isImportant: true });
      try {
        await getLegacy('ChatSync')?.onMessageSent?.(conversation.id);
      } catch (error) {
        logger.warn?.('[LandlordBridge] 微信草稿已写入，但正文同步失败', error);
      }
      return message;
    },

    async news(draft) {
      const phone = getLegacy('PhoneSystem');
      const newsSystem = phone?.newsSystem;
      if (!newsSystem?.newsData || !phone?.emit) throw new Error('新闻系统尚未就绪');
      const existing = Array.isArray(newsSystem.newsData.headlines) ? newsSystem.newsData.headlines : [];
      newsSystem.newsData.headlines = [clone(draft.headline), ...existing].slice(0, 20);
      newsSystem.newsData.lastUpdate = new Date();
      newsSystem.saveNewsToVariable?.();
      phone.emit('news-updated', newsSystem.newsData);
      return draft.headline;
    },

    async building(draft) {
      return draft;
    },
  });
}

export function createChannelBridgeService({ events, identities, ports }) {
  if (!events || typeof events.list !== 'function') throw new TypeError('频道桥接服务需要事件总线');
  if (!ports || typeof ports.capabilities !== 'function') throw new TypeError('频道桥接服务需要投递端口');

  function find(deliveryId) {
    const item = events.list().find(entry => entry.id === deliveryId);
    if (!item) throw new Error(`联动项不存在：${deliveryId}`);
    return item;
  }

  function draft(deliveryId) {
    const item = find(deliveryId);
    const person = item.人物ID ? identities?.get(item.人物ID) : null;
    const base = { deliveryId: item.id, eventId: item.事件ID, channel: item.频道, title: item.标题, summary: item.摘要, buildingId: item.建筑ID, spaceId: item.空间ID };
    if (item.频道 === '正文') return Object.freeze({ ...base, kind: 'story-context', content: events.buildContext('正文', { limit: 8 }) });
    if (item.频道 === '微信') return Object.freeze({ ...base, kind: 'wechat-message', conversationName: `${person?.buildingName ?? '房东经营'}·经营群`, sender: person?.name ?? '房东系统', content: item.摘要, contactId: person?.contactId ?? 'landlord_system' });
    if (item.频道 === '新闻') return Object.freeze({ ...base, kind: 'news-headline', headline: Object.freeze({ tag: item.来源类型, title: item.标题, summary: item.摘要, source: '房东经营中枢', time: item.创建时间 }) });
    return Object.freeze({ ...base, kind: 'building-event' });
  }

  return Object.freeze({
    capabilities: () => ports.capabilities(),
    draft,
    preview(channel) {
      return events.list({ channel, status: '待分发' }).map(item => draft(item.id));
    },
    async dispatch(deliveryId, { confirmed = false } = {}) {
      if (!confirmed) throw new Error('投递联动草稿必须由玩家显式确认');
      const prepared = draft(deliveryId);
      const capability = ports.capabilities()[prepared.channel];
      if (!capability) throw new Error(`${prepared.channel}频道尚未就绪`);
      const method = { 正文: 'story', 微信: 'wechat', 新闻: 'news', 建筑: 'building' }[prepared.channel];
      const result = await ports[method](prepared);
      await events.consume(deliveryId);
      return Object.freeze({ draft: prepared, result: clone(result) });
    },
  });
}
