import { createTavernHelperService } from './tavern-helper-service.js';
import { createMvuService } from './mvu-service.js';
import { getHostDocument, getHostGlobal, getHostWindow } from './core/host.js';

const RUNTIME_KEY = 'LandlordSimulator';

function notifyError(message) {
  const toast = getHostGlobal('toastr');
  if (toast?.error) toast.error(message);
}

function notifyWarning(message) {
  const toast = getHostGlobal('toastr');
  if (toast?.warning) toast.warning(message);
}

async function waitForMvu() {
  const wait = getHostGlobal('waitGlobalInitialized');
  if (typeof wait !== 'function') {
    throw new Error('waitGlobalInitialized 不可用，无法按 MVU 官方方式等待初始化');
  }
  await wait('Mvu');
}

async function waitForDomReady() {
  const jquery = getHostGlobal('$');
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
    this.moduleDisposers = new Map();
    this.services = Object.create(null);
    this.services.tavern = createTavernHelperService();
    this.services.mvu = createMvuService();
    this.legacyServiceGlobals = new Map();
    this.listeners = new Map();
    this.externalSubscriptions = [];
  }

  registerService(name, service, { legacyGlobal = null } = {}) {
    if (Object.hasOwn(this.services, name)) throw new Error(`运行时服务重复注册：${name}`);
    this.services[name] = service;

    if (legacyGlobal) {
      const host = getHostWindow();
      host[legacyGlobal] = service;
      this.legacyServiceGlobals.set(name, { legacyGlobal, service });
    }

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (this.services[name] === service) delete this.services[name];
      const legacy = this.legacyServiceGlobals.get(name);
      if (legacy?.service === service) {
        if (getHostWindow()[legacy.legacyGlobal] === service) delete getHostWindow()[legacy.legacyGlobal];
        this.legacyServiceGlobals.delete(name);
      }
    };
  }

  getService(name) {
    return this.services[name] ?? null;
  }

  requireService(name, requester = '未知模块') {
    const service = this.getService(name);
    if (!service) throw new Error(`模块「${requester}」缺少运行时服务：${name}`);
    return service;
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
    const eventOnApi = getHostGlobal('eventOn');
    const events = getHostGlobal('tavern_events');
    if (typeof eventOnApi !== 'function' || !events?.CHAT_CHANGED) return;

    const subscription = eventOnApi(events.CHAT_CHANGED, chatId => {
      void this.emit('chat:changed', { chatId });
    });
    if (subscription?.stop) this.externalSubscriptions.push(subscription);
  }

  async loadModule(definition) {
    const disposers = [];
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
      const loadedModule = await definition.load();
      if (typeof loadedModule?.activate === 'function') {
        const context = this.createModuleContext(definition, disposers);
        const activation = await loadedModule.activate(context);
        if (typeof activation === 'function') disposers.push(activation);
        else if (typeof activation?.dispose === 'function') disposers.push(() => activation.dispose());
      } else if (typeof loadedModule?.dispose === 'function') {
        disposers.push(loadedModule.dispose);
      } else {
        // 原卡脚本本身就是可直接执行的酒馆助手模块。这里不改写它的 UI、CSS
        // 或事件逻辑，只为统一运行时登记能力，便于状态查看和依赖审计。
        const capability = Object.freeze({
          kind: 'faithful-source',
          moduleId: definition.id,
          moduleName: definition.name,
        });
        for (const serviceName of definition.provides ?? []) {
          disposers.push(this.registerService(serviceName, capability));
        }
      }
      if (disposers.length > 0) this.moduleDisposers.set(definition.id, disposers);
      if (definition.afterLoad === 'wait-for-mvu') await waitForMvu();
      if (definition.afterLoad === 'wait-for-dom-ready') await waitForDomReady();
      state.status = 'loaded';
      await this.emit('module:loaded', { ...state });
    } catch (error) {
      await this.disposeCallbacks(disposers, definition.name);
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : String(error);
      console.error(`[房东模拟器] 模块「${definition.name}」加载失败`, error);
      await this.emit('module:failed', { ...state });
      if (state.critical) throw error;
    }
  }

  createModuleContext(definition, disposers) {
    const registerDisposer = disposer => {
      if (typeof disposer !== 'function') throw new TypeError(`模块「${definition.name}」注册了无效清理函数`);
      disposers.push(disposer);
      return disposer;
    };
    const logger = Object.freeze({
      debug: (...args) => console.debug(`[房东模拟器:${definition.id}]`, ...args),
      info: (...args) => console.info(`[房东模拟器:${definition.id}]`, ...args),
      warn: (...args) => console.warn(`[房东模拟器:${definition.id}]`, ...args),
      error: (...args) => console.error(`[房东模拟器:${definition.id}]`, ...args),
    });

    return Object.freeze({
      module: Object.freeze({ id: definition.id, name: definition.name }),
      host: getHostWindow(),
      document: getHostDocument(),
      logger,
      tavern: this.requireService('tavern', definition.name),
      mvu: this.requireService('mvu', definition.name),
      services: Object.freeze({
        get: name => this.getService(name),
        require: name => this.requireService(name, definition.name),
        register: (name, service, options) => registerDisposer(this.registerService(name, service, options)),
      }),
      events: Object.freeze({
        on: (type, listener) => registerDisposer(this.on(type, listener)),
        emit: (type, payload) => this.emit(type, payload),
      }),
      legacy: Object.freeze({
        get: name => getHostGlobal(name) ?? null,
        require: name => {
          const value = getHostGlobal(name);
          if (value == null) throw new Error(`模块「${definition.name}」缺少过渡期全局依赖：${name}`);
          return value;
        },
      }),
      lifecycle: Object.freeze({ onDispose: registerDisposer }),
    });
  }

  async disposeCallbacks(disposers, moduleName) {
    for (const dispose of [...disposers].reverse()) {
      try {
        await dispose();
      } catch (error) {
        console.warn(`[房东模拟器] 卸载 ${moduleName} 失败`, error);
      }
    }
    disposers.length = 0;
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
      services: Object.keys(this.services),
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
      const moduleDisposers = this.moduleDisposers.get(module.id) ?? [];
      await this.disposeCallbacks(moduleDisposers, module.name);
      for (const cleanupName of module.cleanup) {
        const cleanup = getHostGlobal(cleanupName);
        if (typeof cleanup !== 'function') continue;
        try {
          await cleanup();
        } catch (error) {
          console.warn(`[房东模拟器] 清理 ${module.name} 失败`, error);
        }
      }
    }

    this.moduleDisposers.clear();
    for (const [name, { legacyGlobal, service }] of this.legacyServiceGlobals) {
      if (getHostWindow()[legacyGlobal] === service) delete getHostWindow()[legacyGlobal];
      delete this.services[name];
    }
    this.legacyServiceGlobals.clear();
    this.listeners.clear();
    this.status = 'disposed';
    console.info(`[房东模拟器] 多合一运行时已卸载：${reason}`);
  }
}

export async function startLandlordRuntime({ version, modules }) {
  const host = getHostWindow();
  const previous = host[RUNTIME_KEY];
  if (previous?.dispose) await previous.dispose('bundle-reload');

  const runtime = new LandlordRuntime(version);
  host[RUNTIME_KEY] = runtime;

  try {
    return await runtime.boot(modules);
  } catch (error) {
    await runtime.dispose('boot-failed');
    runtime.status = 'failed';
    notifyError('房东模拟器核心模块加载失败，请查看控制台');
    throw error;
  }
}
