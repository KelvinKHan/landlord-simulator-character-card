function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function defaultIdFactory(kind) {
  return `${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createMockTaskService({ recipes, idFactory = defaultIdFactory }) {
  const tasks = new Map();
  const listeners = new Set();

  function publish(task) {
    const snapshot = Object.freeze(clone(task));
    for (const listener of listeners) listener(snapshot);
    return snapshot;
  }

  function get(taskId) {
    const task = tasks.get(taskId);
    return task ? Object.freeze(clone(task)) : null;
  }

  return Object.freeze({
    mode: 'mock',

    get,

    list() {
      return [...tasks.values()].map(task => Object.freeze(clone(task)));
    },

    async run(kind, input) {
      const recipe = recipes[kind];
      if (typeof recipe !== 'function') throw new Error(`没有注册模拟任务：${kind}`);
      const id = idFactory('task');
      const task = { id, kind, status: 'running', input: clone(input), preview: null, error: null };
      tasks.set(id, task);
      publish(task);
      try {
        const preview = await recipe(clone(input));
        if (task.status === 'cancelled') return get(id);
        task.preview = clone(preview);
        task.status = 'ready';
      } catch (error) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : String(error);
      }
      return publish(task);
    },

    cancel(taskId) {
      const task = tasks.get(taskId);
      if (!task || !['running', 'ready'].includes(task.status)) return false;
      task.status = 'cancelled';
      publish(task);
      return true;
    },

    async confirm(taskId, apply) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`任务不存在：${taskId}`);
      if (task.status !== 'ready') throw new Error(`任务尚不可确认：${task.status}`);
      if (typeof apply !== 'function') throw new TypeError('确认任务必须提供应用函数');
      task.status = 'applying';
      publish(task);
      try {
        await apply(clone(task.preview));
        task.status = 'confirmed';
      } catch (error) {
        task.status = 'ready';
        task.error = error instanceof Error ? error.message : String(error);
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
  });
}
