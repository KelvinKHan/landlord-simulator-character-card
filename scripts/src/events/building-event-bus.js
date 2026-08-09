function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

const channels = Object.freeze(['正文', '微信', '新闻', '建筑']);

export function createBuildingEventBus({ store }) {
  if (!store || typeof store.getState !== 'function') throw new TypeError('建筑事件总线需要状态服务');
  const listeners = new Set();

  function list({ channel = null, status = null, limit = Infinity } = {}) {
    if (channel && !channels.includes(channel)) throw new Error(`未知联动频道：${channel}`);
    return Object.entries(store.getState().联动队列 ?? {})
      .map(([id, item]) => Object.freeze({ id, ...clone(item) }))
      .filter(item => !channel || item.频道 === channel)
      .filter(item => !status || item.状态 === status)
      .slice(-Math.max(0, Number(limit) || 0));
  }

  function counts() {
    const result = Object.fromEntries(channels.map(channel => [channel, 0]));
    for (const item of list({ status: '待分发' })) result[item.频道] += 1;
    return Object.freeze(result);
  }

  function buildContext(channel, { limit = 5, includeRead = false } = {}) {
    const items = list({ channel, status: includeRead ? null : '待分发', limit });
    if (items.length === 0) return '';
    return [
      `<landlord_link channel="${channel}">`,
      ...items.map(item => `- [${item.来源类型}] ${item.标题}：${item.摘要}`),
      '</landlord_link>',
    ].join('\n');
  }

  const unsubscribeStore = store.subscribe(event => {
    const snapshot = Object.freeze({ label: event.label, counts: counts(), pending: list({ status: '待分发' }) });
    for (const listener of listeners) listener(snapshot);
  });

  return Object.freeze({
    channels,
    list,
    counts,
    buildContext,
    async consume(deliveryId) {
      await store.setDeliveryStatus(deliveryId, '已读取');
      return list().find(item => item.id === deliveryId) ?? null;
    },
    async ignore(deliveryId) {
      await store.setDeliveryStatus(deliveryId, '已忽略');
      return list().find(item => item.id === deliveryId) ?? null;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('事件总线订阅者必须是函数');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
      unsubscribeStore();
    },
  });
}
