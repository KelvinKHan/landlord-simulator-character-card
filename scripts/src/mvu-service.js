import { getHostGlobal } from './core/host.js';

function latestMessageTarget() {
  // MVU 会把 `latest` 就地解析为实际楼层编号，因此这里必须每次提供
  // 一个新的可写对象，不能复用或冻结同一份 target。
  return { type: 'message', message_id: 'latest' };
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function requireMvu(method) {
  const mvu = getHostGlobal('Mvu');
  if (typeof mvu?.[method] !== 'function') {
    throw new Error(`MVU 接口 ${method} 不可用，请检查 MVU 是否已经完成初始化`);
  }
  return mvu;
}

export function createMvuService() {
  return Object.freeze({
    isAvailable() {
      return typeof getHostGlobal('Mvu')?.getMvuData === 'function';
    },

    getLatestSnapshot() {
      const mvu = getHostGlobal('Mvu');
      if (typeof mvu?.getMvuData !== 'function') return null;
      return mvu.getMvuData(latestMessageTarget()) ?? null;
    },

    getLatestState() {
      return this.getLatestSnapshot()?.stat_data ?? {};
    },

    read(path, fallback = undefined) {
      const segments = Array.isArray(path) ? path : String(path).split('.').filter(Boolean);
      let value = this.getLatestState();
      for (const segment of segments) {
        if (value == null || typeof value !== 'object' || !(segment in value)) return fallback;
        value = value[segment];
      }
      return value;
    },

    async replaceLatestSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') throw new TypeError('MVU 快照必须是对象');
      await requireMvu('replaceMvuData').replaceMvuData(snapshot, latestMessageTarget());
    },

    async transaction(update, { validate } = {}) {
      if (typeof update !== 'function') throw new TypeError('MVU 事务必须提供更新函数');
      const current = this.getLatestSnapshot();
      if (!current) throw new Error('当前消息尚未初始化 MVU 数据');

      const before = clone(current);
      const draft = clone(current);
      if (!draft.stat_data || typeof draft.stat_data !== 'object') draft.stat_data = {};
      const result = await update(draft.stat_data, draft);
      const validated = typeof validate === 'function' ? await validate(draft) : draft;
      if (!validated || typeof validated !== 'object') throw new Error('MVU 事务校验没有返回有效快照');

      await this.replaceLatestSnapshot(validated);
      return Object.freeze({ before, after: clone(validated), result });
    },
  });
}
