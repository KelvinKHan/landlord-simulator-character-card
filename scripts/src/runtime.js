import { createTavernHelperService } from './tavern-helper-service.js';

const RUNTIME_KEY = 'LandlordSimulator';

function parentWindow() {
  return window.parent ?? window;
}

function findGlobal(name) {
  return globalThis[name] ?? parentWindow()[name];
}

function notifyError(message) {
  const toast = findGlobal('toastr');
  if (toast?.error) toast.error(message);
}

function notifyWarning(message) {
  const toast = findGlobal('toastr');
  if (toast?.warning) toast.warning(message);
}

async function waitForMvu() {
  const wait = findGlobal('waitGlobalInitialized');
  if (typeof wait !== 'function') {
    throw new Error('waitGlobalInitialized 不可用，无法按 MVU 官方方式等待初始化');
  }
  await wait('Mvu');
}

async function waitForDomReady() {
  const jquery = findGlobal('$');
  if (typeof jquery === 'function') {
    await new Promise(resolve => jquery(resolve));
    return;
  }
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
}

class LandlordRuntime {
  constructor(version) {
    this.version = version;
    this.status = 'created';
    this.modules = new Map();
    this.services = {
      tavern: createTavernHelperService(),
    };
    this.listeners = new Map();
    this.externalSubscriptions = [];
  }

  on(type, listener) {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
    return () => bucket.delete(listener);
  }

  async emit(type, payload) {
    const bucket = this.listeners.get(type);
    if (!bucket) return;
    await Promise.allSettled([...bucket].map(listener => listener(payload)));
  }

  bindTavernEvents() {
    const eventOnApi = findGlobal('eventOn');
    const events = findGlobal('tavern_events');
    if (typeof eventOnApi !== 'function' || !events?.CHAT_CHANGED) return;

    const subscription = eventOnApi(events.CHAT_CHANGED, chatId => {
      void this.emit('chat:changed', { chatId });
    });
    if (subscription?.stop) this.externalSubscriptions.push(subscription);
  }

  async loadModule(definition) {
    const state = {
      id: definition.id,
      name: definition.name,
      status: 'loading',
      critical: Boolean(definition.critical),
      cleanup: definition.cleanup ?? [],
      error: null,
    };
    this.modules.set(definition.id, state);

    try {
      await definition.load();
      if (definition.afterLoad === 'wait-for-mvu') await waitForMvu();
      if (definition.afterLoad === 'wait-for-dom-ready') await waitForDomReady();
      state.status = 'loaded';
      await this.emit('module:loaded', { ...state });
    } catch (error) {
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : String(error);
      console.error(`[房东模拟器] 模块「${definition.name}」加载失败`, error);
      await this.emit('module:failed', { ...state });
      if (state.critical) throw error;
    }
  }

  async boot(definitions) {
    this.status = 'loading';
    this.bindTavernEvents();

    for (const definition of definitions) {
      await this.loadModule(definition);
    }

    const failedModules = [...this.modules.values()].filter(module => module.status === 'failed');
    this.status = 'ready';
    if (failedModules.length > 0) {
      notifyWarning(`房东模拟器已有 ${failedModules.length} 个非核心模块加载失败，可在控制台查看详情`);
    }
    console.info(
      `[房东模拟器] 多合一运行时 ${this.version} 已加载，共 ${this.modules.size} 个模块，失败 ${failedModules.length} 个`,
    );
    await this.emit('runtime:ready', this.getStatus());
    return this;
  }

  getStatus() {
    const modules = [...this.modules.values()].map(module => ({ ...module }));
    const failedModules = modules.filter(module => module.status === 'failed');
    return {
      version: this.version,
      status: this.status,
      degraded: failedModules.length > 0,
      loadedCount: modules.filter(module => module.status === 'loaded').length,
      failedCount: failedModules.length,
      failedModules: failedModules.map(module => module.id),
      modules,
    };
  }

  async dispose(reason = 'reload') {
    if (this.status === 'disposed') return;
    this.status = 'disposing';

    for (const subscription of this.externalSubscriptions.splice(0)) {
      try {
        subscription.stop();
      } catch (error) {
        console.warn('[房东模拟器] 取消事件监听失败', error);
      }
    }

    const loadedModules = [...this.modules.values()].reverse();
    for (const module of loadedModules) {
      for (const cleanupName of module.cleanup) {
        const cleanup = findGlobal(cleanupName);
        if (typeof cleanup !== 'function') continue;
        try {
          await cleanup();
        } catch (error) {
          console.warn(`[房东模拟器] 清理 ${module.name} 失败`, error);
        }
      }
    }

    this.listeners.clear();
    this.status = 'disposed';
    console.info(`[房东模拟器] 多合一运行时已卸载：${reason}`);
  }
}

export async function startLandlordRuntime({ version, modules }) {
  const host = parentWindow();
  const previous = host[RUNTIME_KEY];
  if (previous?.dispose) await previous.dispose('bundle-reload');

  const runtime = new LandlordRuntime(version);
  host[RUNTIME_KEY] = runtime;

  try {
    return await runtime.boot(modules);
  } catch (error) {
    runtime.status = 'failed';
    notifyError('房东模拟器核心模块加载失败，请查看控制台');
    throw error;
  }
}
