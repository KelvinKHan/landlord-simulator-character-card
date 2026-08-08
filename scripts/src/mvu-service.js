import { getHostGlobal } from './core/host.js';

const latestMessage = Object.freeze({ type: 'message', message_id: -1 });

export function createMvuService() {
  return Object.freeze({
    isAvailable() {
      return typeof getHostGlobal('Mvu')?.getMvuData === 'function';
    },

    getLatestSnapshot() {
      const mvu = getHostGlobal('Mvu');
      if (typeof mvu?.getMvuData !== 'function') return null;
      return mvu.getMvuData(latestMessage) ?? null;
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
  });
}
