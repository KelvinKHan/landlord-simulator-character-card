import assert from 'node:assert/strict';
import test from 'node:test';
import { TASK_PRIORITY, TASK_STATUS, TaskScheduler } from '../scripts/src/core/task-scheduler.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => (resolve = done));
  return { promise, resolve };
}

async function waitFor(predicate, timeout = 1000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeout) throw new Error('等待调度器状态超时');
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

test('任务严格串行执行，并按优先级排列等待队列', async () => {
  const scheduler = new TaskScheduler();
  const gate = deferred();
  const order = [];

  scheduler.addTask({ name: '运行中', execute: async () => gate.promise });
  scheduler.addTask({ name: '低优先级', priority: TASK_PRIORITY.LOW, execute: async () => order.push('low') });
  scheduler.addTask({ name: '高优先级', priority: TASK_PRIORITY.HIGH, execute: async () => order.push('high') });

  assert.deepEqual(scheduler.getQueueStatus().queue.map(task => task.name), ['高优先级', '低优先级']);
  gate.resolve();
  await waitFor(() => scheduler.getHistory(3).length === 3);
  assert.deepEqual(order, ['high', 'low']);
});

test('失败任务被记录，但不会阻塞后续任务', async () => {
  const scheduler = new TaskScheduler();
  const originalError = console.error;
  console.error = () => {};
  try {
    scheduler.addTask({ name: '失败', execute: async () => Promise.reject(new Error('expected')) });
    scheduler.addTask({ name: '成功', execute: async () => 'ok' });
    await waitFor(() => scheduler.getHistory(2).length === 2);
  } finally {
    console.error = originalError;
  }

  const history = scheduler.getHistory(2);
  assert.equal(history[0].status, TASK_STATUS.COMPLETED);
  assert.equal(history[1].status, TASK_STATUS.FAILED);
  assert.equal(history[1].error, 'expected');
});
