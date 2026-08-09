function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function defaultIdFactory(kind) {
  return `${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function publicTask(task) {
  return Object.freeze(clone(task));
}

function createDeferred() {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function assertPositiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new TypeError(`${name}必须是大于 0 的整数`);
  return number;
}

export function createRecipeTaskProvider({ id = 'local', recipes, source = 'local-mock' }) {
  if (!recipes || typeof recipes !== 'object') throw new TypeError('任务配方必须是对象');
  return Object.freeze({
    id,
    available: () => true,
    supports: kind => typeof recipes[kind] === 'function',
    async run(kind, input, context) {
      const recipe = recipes[kind];
      if (typeof recipe !== 'function') throw new Error(`任务提供器 ${id} 不支持：${kind}`);
      const preview = await recipe(clone(input), context);
      return { source, ...clone(preview) };
    },
  });
}

export function createTaskCenter({
  providers,
  defaultMode = 'local',
  concurrency = 1,
  timeoutMs = 45_000,
  maxAttempts = 2,
  idFactory = defaultIdFactory,
  clock = () => Date.now(),
}) {
  if (!providers || typeof providers !== 'object') throw new TypeError('任务中心需要至少一个提供器');
  const providerMap = new Map(Object.entries(providers).filter(([, provider]) => provider?.run));
  if (providerMap.size === 0) throw new TypeError('任务中心没有可用提供器');
  if (!providerMap.has(defaultMode)) throw new Error(`默认任务模式不存在：${defaultMode}`);

  const limit = assertPositiveInteger(concurrency, '并发数');
  const defaultAttempts = assertPositiveInteger(maxAttempts, '最大尝试次数');
  const tasks = new Map();
  const listeners = new Set();
  const queue = [];
  const waiters = new Map();
  const controllers = new Map();
  let activeCount = 0;
  let selectedMode = defaultMode;
  let disposed = false;

  function getProvider(mode, kind) {
    const provider = providerMap.get(mode);
    if (!provider) throw new Error(`任务模式不存在：${mode}`);
    if (provider.available?.() === false) throw new Error(`任务模式 ${mode} 当前不可用`);
    if (provider.supports?.(kind) === false) throw new Error(`任务模式 ${mode} 不支持：${kind}`);
    return provider;
  }

  function assertModeAvailable(mode) {
    const provider = providerMap.get(mode);
    if (!provider) throw new Error(`任务模式不存在：${mode}`);
    if (provider.available?.() === false) throw new Error(`任务模式 ${mode} 当前不可用`);
    return provider;
  }

  function publish(task) {
    task.updatedAt = clock();
    const snapshot = publicTask(task);
    for (const listener of listeners) listener(snapshot);
    return snapshot;
  }

  function settle(task) {
    const deferred = waiters.get(task.id);
    if (!deferred) return;
    waiters.delete(task.id);
    deferred.resolve(publicTask(task));
  }

  function get(taskId) {
    const task = tasks.get(taskId);
    return task ? publicTask(task) : null;
  }

  async function invokeProvider(task, provider) {
    const controller = new AbortController();
    controllers.set(task.id, controller);
    let timer = null;
    const timeout = task.timeoutMs > 0
      ? new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort('timeout');
            const error = new Error(`任务超过 ${task.timeoutMs}ms 未完成`);
            error.code = 'TASK_TIMEOUT';
            reject(error);
          }, task.timeoutMs);
        })
      : null;
    try {
      const request = Promise.resolve(
        provider.run(task.kind, clone(task.input), {
          signal: controller.signal,
          attempt: task.attempt,
          taskId: task.id,
          metadata: clone(task.metadata),
        }),
      );
      return await (timeout ? Promise.race([request, timeout]) : request);
    } finally {
      if (timer) clearTimeout(timer);
      if (controllers.get(task.id) === controller) controllers.delete(task.id);
    }
  }

  async function execute(task) {
    let provider;
    try {
      provider = getProvider(task.mode, task.kind);
    } catch (error) {
      task.status = 'failed';
      task.error = errorMessage(error);
      publish(task);
      settle(task);
      return;
    }

    while (task.attempt < task.maxAttempts && task.status !== 'cancelled') {
      task.attempt += 1;
      task.status = task.attempt === 1 ? 'running' : 'retrying';
      task.error = null;
      publish(task);
      try {
        const preview = await invokeProvider(task, provider);
        if (task.status === 'cancelled') break;
        task.preview = clone(preview);
        task.status = 'ready';
        publish(task);
        settle(task);
        return;
      } catch (error) {
        if (task.status === 'cancelled') break;
        task.error = errorMessage(error);
        if (task.attempt >= task.maxAttempts) {
          task.status = 'failed';
          publish(task);
          settle(task);
          return;
        }
        task.status = 'waiting-retry';
        publish(task);
      }
    }
    settle(task);
  }

  function drain() {
    if (disposed) return;
    while (activeCount < limit && queue.length > 0) {
      const task = queue.shift();
      if (!task || task.status === 'cancelled') continue;
      activeCount += 1;
      void execute(task).finally(() => {
        activeCount -= 1;
        drain();
      });
    }
  }

  function enqueue(task) {
    const deferred = createDeferred();
    waiters.set(task.id, deferred);
    task.status = 'queued';
    queue.push(task);
    publish(task);
    drain();
    return deferred.promise;
  }

  function submit(kind, input, options = {}) {
    if (disposed) throw new Error('任务中心已经关闭');
    const mode = options.mode ?? selectedMode;
    getProvider(mode, kind);
    const now = clock();
    const task = {
      id: idFactory('task'),
      kind,
      mode,
      status: 'created',
      input: clone(input),
      metadata: clone(options.metadata ?? {}),
      preview: null,
      error: null,
      attempt: 0,
      maxAttempts: assertPositiveInteger(options.maxAttempts ?? defaultAttempts, '最大尝试次数'),
      timeoutMs: Math.max(0, Number(options.timeoutMs ?? timeoutMs) || 0),
      createdAt: now,
      updatedAt: now,
    };
    tasks.set(task.id, task);
    return Object.freeze({ id: task.id, result: enqueue(task) });
  }

  return Object.freeze({
    get mode() {
      return selectedMode;
    },

    get,

    list({ status = null, mode = null } = {}) {
      return [...tasks.values()]
        .filter(task => !status || task.status === status)
        .filter(task => !mode || task.mode === mode)
        .map(publicTask);
    },

    capabilities() {
      return [...providerMap.entries()].map(([mode, provider]) =>
        Object.freeze({ mode, available: provider.available?.() !== false, id: provider.id ?? mode }),
      );
    },

    setMode(mode) {
      assertModeAvailable(mode);
      selectedMode = mode;
      return selectedMode;
    },

    submit,

    async run(kind, input, options = {}) {
      return await submit(kind, input, options).result;
    },

    cancel(taskId) {
      const task = tasks.get(taskId);
      if (!task || !['queued', 'running', 'retrying', 'waiting-retry', 'ready'].includes(task.status)) return false;
      task.status = 'cancelled';
      task.error = null;
      const controller = controllers.get(taskId);
      if (controller) controller.abort('cancelled');
      publish(task);
      settle(task);
      return true;
    },

    async retry(taskId, options = {}) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`任务不存在：${taskId}`);
      if (!['failed', 'cancelled'].includes(task.status)) throw new Error(`任务当前不可重试：${task.status}`);
      task.attempt = 0;
      task.error = null;
      task.preview = null;
      if (options.mode) task.mode = options.mode;
      if (options.timeoutMs != null) task.timeoutMs = Math.max(0, Number(options.timeoutMs) || 0);
      if (options.maxAttempts != null) task.maxAttempts = assertPositiveInteger(options.maxAttempts, '最大尝试次数');
      getProvider(task.mode, task.kind);
      return await enqueue(task);
    },

    async confirm(taskId, apply) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`任务不存在：${taskId}`);
      if (task.status !== 'ready') throw new Error(`任务尚不可确认：${task.status}`);
      if (typeof apply !== 'function') throw new TypeError('确认任务必须提供应用函数');
      task.status = 'applying';
      publish(task);
      try {
        await apply(clone(task.preview), publicTask(task));
        task.status = 'confirmed';
        task.error = null;
      } catch (error) {
        task.status = 'ready';
        task.error = errorMessage(error);
        publish(task);
        throw error;
      }
      return publish(task);
    },

    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('任务订阅者必须是函数');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const task of tasks.values()) {
        if (['queued', 'running', 'retrying', 'waiting-retry'].includes(task.status)) {
          task.status = 'cancelled';
          controllers.get(task.id)?.abort('disposed');
          publish(task);
          settle(task);
        }
      }
      queue.length = 0;
      listeners.clear();
    },
  });
}
