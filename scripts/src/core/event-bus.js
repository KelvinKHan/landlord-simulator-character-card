export class EventBus {
  #listeners = new Map();

  on(type, listener) {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
    return () => this.off(type, listener);
  }

  off(type, listener) {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) this.#listeners.delete(type);
  }

  emit(type, payload) {
    for (const listener of this.#listeners.get(type) ?? []) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[房东模拟器] 事件「${type}」处理失败`, error);
      }
    }
  }

  clear() {
    this.#listeners.clear();
  }
}
