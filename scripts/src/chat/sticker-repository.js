function getAll(store) {
  return new Promise(resolve => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => resolve([]);
  });
}

export class WorkshopStickerRepository {
  constructor({ databaseFactory, now = () => Date.now(), cacheTtl = 30_000, logger = console }) {
    this.databaseFactory = databaseFactory;
    this.now = now;
    this.cacheTtl = cacheTtl;
    this.logger = logger;
    this.cache = null;
    this.cacheTime = 0;
  }

  async getStickers({ force = false } = {}) {
    const now = this.now();
    if (!force && this.cache && now - this.cacheTime < this.cacheTtl) return this.cache;
    this.cache = await this.#load();
    this.cacheTime = now;
    return this.cache;
  }

  clearCache() {
    this.cache = null;
    this.cacheTime = 0;
  }

  async #load() {
    if (!this.databaseFactory?.open) return [];
    return new Promise(resolve => {
      let createdEmptyDatabase = false;
      const request = this.databaseFactory.open('WorkshopStickersDB');
      request.onupgradeneeded = () => {
        createdEmptyDatabase = true;
      };
      request.onerror = () => resolve([]);
      request.onsuccess = async event => {
        const database = event.target.result;
        if (createdEmptyDatabase || !database.objectStoreNames.contains('stickers')) {
          database.close();
          resolve([]);
          return;
        }
        try {
          const stickers = await getAll(database.transaction('stickers', 'readonly').objectStore('stickers'));
          database.close();
          resolve(stickers);
        } catch (error) {
          database.close();
          this.logger.warn('读取创意工坊表情包失败', error);
          resolve([]);
        }
      };
    });
  }
}
