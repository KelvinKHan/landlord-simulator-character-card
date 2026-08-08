import { EventBus } from './event-bus.js';

export const TASK_TYPES = Object.freeze({
  NEWS: 'news',
  TENANT_ANALYZE: 'tenant_analyze',
  TENANT_SYNC: 'tenant_sync',
  CUSTOM: 'custom',
});

export const TASK_PRIORITY = Object.freeze({
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
});

export const TASK_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

function createTask(options, id) {
  return {
    id,
    type: options.type ?? TASK_TYPES.CUSTOM,
    name: options.name ?? '未命名任务',
    priority: options.priority ?? TASK_PRIORITY.NORMAL,
    data: options.data ?? {},
    execute: options.execute,
    status: TASK_STATUS.PENDING,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    result: null,
    error: null,
  };
}

export class TaskScheduler {
  constructor({ historyLimit = 50 } = {}) {
    this.historyLimit = historyLimit;
    this.queue = [];
    this.history = [];
    this.isProcessing = false;
    this.currentTask = null;
    this.events = new EventBus();
    this.TASK_TYPES = TASK_TYPES;
    this.PRIORITY = TASK_PRIORITY;
    this.TASK_STATUS = TASK_STATUS;
  }

  init() {
    this.clearQueue();
    this.history = [];
    return this;
  }

  addTask(options = {}) {
    const task = createTask(options, this.#generateTaskId());
    const insertionIndex = this.queue.findIndex(item => item.priority > task.priority);
    if (insertionIndex === -1) this.queue.push(task);
    else this.queue.splice(insertionIndex, 0, task);

    this.events.emit('task-added', task);
    this.#emitQueueUpdate();
    void this.#processNext();
    return task.id;
  }

  cancelTask(taskId) {
    const index = this.queue.findIndex(task => task.id === taskId);
    if (index === -1) return false;
    const [task] = this.queue.splice(index, 1);
    this.#finishCancelledTask(task);
    this.#emitQueueUpdate();
    return true;
  }

  cancelTasksByType(type) {
    const cancelled = this.queue.filter(task => task.type === type);
    this.queue = this.queue.filter(task => task.type !== type);
    for (const task of cancelled) this.#finishCancelledTask(task);
    if (cancelled.length > 0) this.#emitQueueUpdate();
    return cancelled;
  }

  clearQueue() {
    for (const task of this.queue) this.#finishCancelledTask(task);
    this.queue = [];
    this.#emitQueueUpdate();
  }

  getQueueStatus() {
    return {
      isProcessing: this.isProcessing,
      currentTask: this.currentTask
        ? {
            id: this.currentTask.id,
            type: this.currentTask.type,
            name: this.currentTask.name,
            startedAt: this.currentTask.startedAt,
          }
        : null,
      queueLength: this.queue.length,
      queue: this.queue.map(({ id, type, name, priority, createdAt }) => ({ id, type, name, priority, createdAt })),
    };
  }

  getHistory(limit = 20) {
    return this.history.slice(0, limit).map(task => ({
      id: task.id,
      type: task.type,
      name: task.name,
      status: task.status,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      error: task.error,
      duration:
        task.completedAt && task.startedAt
          ? (task.completedAt.getTime() - task.startedAt.getTime()) / 1000
          : null,
    }));
  }

  on(type, listener) {
    return this.events.on(type, listener);
  }

  off(type, listener) {
    this.events.off(type, listener);
  }

  emit(type, payload) {
    this.events.emit(type, payload);
  }

  dispose() {
    this.clearQueue();
    this.events.clear();
  }

  async #processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    const task = this.queue.shift();
    this.currentTask = task;
    this.isProcessing = true;
    task.status = TASK_STATUS.RUNNING;
    task.startedAt = new Date();
    this.events.emit('task-started', task);
    this.#emitQueueUpdate();

    try {
      if (typeof task.execute === 'function') task.result = await task.execute(task.data);
      task.status = TASK_STATUS.COMPLETED;
      this.events.emit('task-completed', task);
    } catch (error) {
      task.status = TASK_STATUS.FAILED;
      task.error = error instanceof Error ? error.message : String(error);
      console.error(`[房东模拟器] 后台任务「${task.name}」失败`, error);
      this.events.emit('task-failed', task);
    } finally {
      task.completedAt = new Date();
      this.#remember(task);
      this.currentTask = null;
      this.isProcessing = false;
      this.#emitQueueUpdate();
      void this.#processNext();
    }
  }

  #finishCancelledTask(task) {
    task.status = TASK_STATUS.CANCELLED;
    task.completedAt = new Date();
    this.#remember(task);
    this.events.emit('task-cancelled', task);
  }

  #remember(task) {
    this.history.unshift(task);
    if (this.history.length > this.historyLimit) this.history.length = this.historyLimit;
  }

  #emitQueueUpdate() {
    this.events.emit('queue-updated', this.getQueueStatus());
  }

  #generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
