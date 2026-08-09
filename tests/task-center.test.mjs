import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecipeTaskProvider, createTaskCenter } from '../scripts/src/services/task-center.js';

function ids() {
  let value = 0;
  return prefix => `${prefix}_center_${++value}`;
}

test('统一任务中心默认只运行本地提供器并保留预览确认边界', async () => {
  globalThis.generate = () => assert.fail('本地模式不应调用 generate');
  globalThis.generateRaw = () => assert.fail('本地模式不应调用 generateRaw');
  try {
    const center = createTaskCenter({
      providers: {
        local: createRecipeTaskProvider({
          recipes: { takeover: async input => ({ received: input.name, choices: ['A', 'B'] }) },
        }),
        ai: {
          id: 'blocked-ai',
          available: () => false,
          run: () => assert.fail('不可用的 AI 提供器不应执行'),
        },
      },
      defaultMode: 'local',
      idFactory: ids(),
    });

    assert.equal(center.mode, 'local');
    assert.deepEqual(center.capabilities(), [
      { mode: 'local', available: true, id: 'local' },
      { mode: 'ai', available: false, id: 'blocked-ai' },
    ]);
    assert.throws(() => center.setMode('ai'), /当前不可用/);

    const task = await center.run('takeover', { name: '医院' }, { metadata: { buildingId: 'hospital' } });
    assert.equal(task.status, 'ready');
    assert.equal(task.mode, 'local');
    assert.equal(task.preview.received, '医院');
    assert.equal(task.preview.source, 'local-mock');
    assert.equal(task.metadata.buildingId, 'hospital');

    let applied = null;
    const confirmed = await center.confirm(task.id, preview => {
      applied = preview.choices[0];
    });
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(applied, 'A');
  } finally {
    delete globalThis.generate;
    delete globalThis.generateRaw;
  }
});

test('统一任务中心会自动重试失败任务并保留尝试次数', async () => {
  let calls = 0;
  const center = createTaskCenter({
    providers: {
      local: {
        id: 'flaky-local',
        run: async () => {
          calls += 1;
          if (calls < 2) throw new Error('临时失败');
          return { source: 'test', value: 42 };
        },
      },
    },
    maxAttempts: 2,
    idFactory: ids(),
  });
  const transitions = [];
  center.subscribe(task => transitions.push(task.status));

  const task = await center.run('renovation', {});
  assert.equal(task.status, 'ready');
  assert.equal(task.attempt, 2);
  assert.equal(task.preview.value, 42);
  assert.deepEqual(transitions, ['queued', 'running', 'waiting-retry', 'retrying', 'ready']);
});

test('统一任务中心支持运行中取消且忽略迟到结果', async () => {
  let finish;
  const center = createTaskCenter({
    providers: {
      local: {
        id: 'slow-local',
        run: () => new Promise(resolve => {
          finish = resolve;
        }),
      },
    },
    idFactory: ids(),
  });

  const submission = center.submit('recruitment', {});
  assert.equal(center.get(submission.id).status, 'running');
  assert.equal(center.cancel(submission.id), true);
  const cancelled = await submission.result;
  assert.equal(cancelled.status, 'cancelled');
  finish({ source: 'late', candidates: ['不应写入'] });
  await Promise.resolve();
  assert.equal(center.get(submission.id).status, 'cancelled');
  assert.equal(center.get(submission.id).preview, null);
});

test('统一任务中心支持超时失败后手动重试', async () => {
  let shouldTimeout = true;
  const center = createTaskCenter({
    providers: {
      local: {
        id: 'timeout-local',
        run: () => shouldTimeout ? new Promise(() => {}) : Promise.resolve({ source: 'retry', ok: true }),
      },
    },
    maxAttempts: 1,
    timeoutMs: 10,
    idFactory: ids(),
  });

  const failed = await center.run('takeover', {});
  assert.equal(failed.status, 'failed');
  assert.match(failed.error, /超过 10ms/);
  shouldTimeout = false;
  const retried = await center.retry(failed.id);
  assert.equal(retried.status, 'ready');
  assert.equal(retried.preview.ok, true);
});

test('统一任务中心按并发上限排队', async () => {
  const releases = [];
  let running = 0;
  let peak = 0;
  const center = createTaskCenter({
    providers: {
      local: {
        id: 'queued-local',
        run: input => new Promise(resolve => {
          running += 1;
          peak = Math.max(peak, running);
          releases.push(() => {
            running -= 1;
            resolve({ source: 'queue', id: input.id });
          });
        }),
      },
    },
    concurrency: 1,
    idFactory: ids(),
  });

  const first = center.submit('takeover', { id: 1 });
  const second = center.submit('takeover', { id: 2 });
  assert.equal(center.get(first.id).status, 'running');
  assert.equal(center.get(second.id).status, 'queued');
  releases.shift()();
  await first.result;
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(center.get(second.id).status, 'running');
  releases.shift()();
  await second.result;
  assert.equal(peak, 1);
});
