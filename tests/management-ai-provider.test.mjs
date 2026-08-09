import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';

globalThis.z = z;
const { createManagementAiProvider } = await import('../scripts/src/ai/management-ai-provider.js');

test.after(() => {
  delete globalThis.z;
});

function direction(id) {
  return {
    id,
    name: `方向${id}`,
    buildingName: `新建筑${id}`,
    description: '保留现有基础并加入新的生活空间。',
    highlight: '人物与建筑会产生新的碰撞。',
    summary: '这是确认前的接管预览。',
    tags: ['轻经营', '高自由度'],
    theme: { 主色: '#55B7A5', 辅色: '#F7D6E0', 纹理: 'test' },
    opportunities: ['改造空间', '招募人物'],
  };
}

test('经营 AI 提供器只有显式启用后才允许调用酒馆助手', async () => {
  let enabled = false;
  let calls = 0;
  const tavern = {
    has: name => name === 'generateRaw',
    generateStructured: async () => {
      calls += 1;
      return { directions: [direction('a'), direction('b'), direction('c')] };
    },
  };
  const provider = createManagementAiProvider({ tavern, isEnabled: () => enabled, logger: { info() {} } });
  assert.equal(provider.available(), true);
  await assert.rejects(
    provider.run('takeover', { building: { type: '医院' } }, { signal: new AbortController().signal }),
    /尚未由玩家启用/,
  );
  assert.equal(calls, 0);

  enabled = true;
  assert.equal(provider.available(), true);
  const result = await provider.run(
    'takeover',
    { building: { type: '医院', name: '白塔社区医院' } },
    { signal: new AbortController().signal, taskId: 'task_test', attempt: 1 },
  );
  assert.equal(calls, 1);
  assert.equal(result.source, 'ai');
  assert.equal(result.directions.length, 3);
});

test('经营 AI 使用独立 generateRaw 结构化请求并通过 Zod 校验', async () => {
  let received;
  const tavern = {
    has: () => true,
    generateStructured: async config => {
      received = config;
      return { directions: [direction('a'), direction('b'), direction('c')] };
    },
  };
  const provider = createManagementAiProvider({ tavern, isEnabled: () => true, logger: { info() {} } });
  await provider.run(
    'takeover',
    { building: { id: 'hospital', type: '医院' } },
    { signal: new AbortController().signal, taskId: 'task_schema', attempt: 1 },
  );

  assert.equal(received.mode, 'raw');
  assert.equal(received.max_chat_history, 0);
  assert.equal(received.should_stream, false);
  assert.equal(received.schemaName, 'landlord_takeover_preview');
  assert.equal(received.schema.type, 'object');
  assert.equal(received.ordered_prompts.length, 2);
  assert.match(received.ordered_prompts[0].content, /只生成预览方案/);
  assert.match(received.ordered_prompts[1].content, /hospital/);

  const invalid = createManagementAiProvider({
    tavern: { has: () => true, generateStructured: async () => ({ directions: [direction('only-one')] }) },
    isEnabled: () => true,
    logger: { info() {} },
  });
  await assert.rejects(
    invalid.run('takeover', {}, { signal: new AbortController().signal }),
    error => error?.name === 'ZodError',
  );
});

test('经营 AI 在请求开始前响应取消信号', async () => {
  const controller = new AbortController();
  controller.abort();
  const provider = createManagementAiProvider({
    tavern: { has: () => true, generateStructured: () => assert.fail('取消后不应生成') },
    isEnabled: () => true,
    logger: { info() {} },
  });
  await assert.rejects(
    provider.run('takeover', {}, { signal: controller.signal }),
    error => error?.name === 'AbortError',
  );
});
