import assert from 'node:assert/strict';
import test from 'node:test';

const host = {};
host.parent = host;
globalThis.window = host;
globalThis.document = { readyState: 'complete' };

const { startLandlordRuntime } = await import('../scripts/src/runtime.js');
const { createTavernHelperService } = await import('../scripts/src/tavern-helper-service.js');

async function silenceExpectedErrors(run) {
  const original = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = original;
  }
}

test.afterEach(async () => {
  if (host.LandlordSimulator?.dispose) await host.LandlordSimulator.dispose('test-cleanup');
  for (const key of Object.keys(host)) {
    if (key !== 'parent') delete host[key];
  }
});

test('按清单顺序加载，并在非核心模块失败后继续', async () => {
  const order = [];
  const runtime = await silenceExpectedErrors(() =>
    startLandlordRuntime({
      version: 'test',
      modules: [
        { id: 'first', name: '第一项', load: async () => order.push('first') },
        {
          id: 'optional',
          name: '非核心项',
          load: async () => {
            order.push('optional');
            throw new Error('expected');
          },
        },
        { id: 'last', name: '最后一项', load: async () => order.push('last') },
      ],
    }),
  );

  assert.deepEqual(order, ['first', 'optional', 'last']);
  assert.deepEqual(runtime.getStatus(), {
    version: 'test',
    status: 'ready',
    degraded: true,
    loadedCount: 2,
    failedCount: 1,
    failedModules: ['optional'],
    services: ['tavern', 'mvu'],
    modules: [
      { id: 'first', name: '第一项', status: 'loaded', critical: false, cleanup: [], error: null },
      { id: 'optional', name: '非核心项', status: 'failed', critical: false, cleanup: [], error: 'expected' },
      { id: 'last', name: '最后一项', status: 'loaded', critical: false, cleanup: [], error: null },
    ],
  });
});

test('标准模块通过上下文声明服务，并在卸载时自动回收', async () => {
  const cleanupOrder = [];
  const service = { value: 42 };
  const runtime = await startLandlordRuntime({
    version: 'test',
    modules: [
      {
        id: 'modern',
        name: '标准模块',
        load: async () => ({
          activate(context) {
            assert.equal(context.module.id, 'modern');
            assert.equal(typeof context.tavern.has, 'function');
            context.services.register('example.service', service, { legacyGlobal: 'ExampleService' });
            context.lifecycle.onDispose(() => cleanupOrder.push('lifecycle'));
            return () => cleanupOrder.push('activation');
          },
        }),
      },
    ],
  });

  assert.equal(runtime.getService('example.service'), service);
  assert.equal(host.ExampleService, service);
  await runtime.dispose('test');
  assert.deepEqual(cleanupOrder, ['activation', 'lifecycle']);
  assert.equal(runtime.getService('example.service'), null);
  assert.equal(host.ExampleService, undefined);
});

test('核心模块失败时停止后续加载并标记运行时失败', async () => {
  const cleanupOrder = [];
  let reachedLaterModule = false;
  await assert.rejects(
    silenceExpectedErrors(() =>
      startLandlordRuntime({
        version: 'test',
        modules: [
          {
            id: 'started',
            name: '已启动模块',
            load: async () => ({ activate: () => () => cleanupOrder.push('started-cleanup') }),
          },
          { id: 'critical', name: '核心项', critical: true, load: async () => Promise.reject(new Error('stop')) },
          { id: 'later', name: '不应加载', load: async () => (reachedLaterModule = true) },
        ],
      }),
    ),
    /stop/,
  );

  assert.equal(reachedLaterModule, false);
  assert.deepEqual(cleanupOrder, ['started-cleanup']);
  assert.equal(host.LandlordSimulator.status, 'failed');
});

test('模块启动到一半失败时回滚已经注册的服务', async () => {
  const runtime = await silenceExpectedErrors(() =>
    startLandlordRuntime({
      version: 'test',
      modules: [
        {
          id: 'broken',
          name: '半成品模块',
          load: async () => ({
            activate(context) {
              context.services.register('temporary.service', {}, { legacyGlobal: 'TemporaryService' });
              throw new Error('activation failed');
            },
          }),
        },
      ],
    }),
  );

  assert.equal(runtime.getService('temporary.service'), null);
  assert.equal(host.TemporaryService, undefined);
  assert.equal(runtime.getStatus().failedCount, 1);
});

test('卸载时取消酒馆事件，并按模块逆序清理', async () => {
  const calls = [];
  host.tavern_events = { CHAT_CHANGED: 'chat-changed' };
  host.eventOn = () => ({ stop: () => calls.push('event-stop') });
  host.cleanupFirst = () => calls.push('first-cleanup');
  host.cleanupLast = () => calls.push('last-cleanup');

  const runtime = await startLandlordRuntime({
    version: 'test',
    modules: [
      { id: 'first', name: '第一项', cleanup: ['cleanupFirst'], load: async () => {} },
      { id: 'last', name: '最后一项', cleanup: ['cleanupLast'], load: async () => {} },
    ],
  });
  await runtime.dispose('test');

  assert.deepEqual(calls, ['event-stop', 'last-cleanup', 'first-cleanup']);
});

test('酒馆助手 AI 服务默认静默生成，并解析结构化结果', async () => {
  let receivedConfig;
  host.generateRaw = async config => {
    receivedConfig = config;
    return '{"候选人":["小林"]}';
  };

  const service = createTavernHelperService();
  const result = await service.generateStructured({
    schemaName: 'tenant_candidates',
    schema: { type: 'object' },
    prompt: '生成租客',
  });

  assert.deepEqual(result, { 候选人: ['小林'] });
  assert.equal(receivedConfig.should_silence, true);
  assert.equal(receivedConfig.json_schema.name, 'tenant_candidates');
});
