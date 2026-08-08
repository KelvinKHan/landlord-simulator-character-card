import assert from 'node:assert/strict';
import test from 'node:test';
import { createMvuService } from '../scripts/src/mvu-service.js';

test('MVU 服务延迟读取最新状态并支持安全路径访问', () => {
  const host = {};
  host.parent = host;
  globalThis.window = host;
  try {
    const service = createMvuService();
    assert.equal(service.isAvailable(), false);
    assert.deepEqual(service.getLatestState(), {});
    assert.equal(service.read('世界.时间', '未知'), '未知');

    host.Mvu = {
      getMvuData: target => {
        assert.deepEqual(target, { type: 'message', message_id: 'latest' });
        return { stat_data: { 世界: { 时间: '晚上' }, 租客列表: { 小林: {} } } };
      },
    };

    assert.equal(service.isAvailable(), true);
    assert.equal(service.read('世界.时间'), '晚上');
    assert.deepEqual(service.read(['租客列表', '小林']), {});
    assert.equal(service.read('不存在', '回退值'), '回退值');
  } finally {
    delete globalThis.window;
  }
});

test('MVU 服务在事务校验通过后一次性替换最新楼层数据', async () => {
  const host = {};
  host.parent = host;
  globalThis.window = host;
  try {
    let stored = { stat_data: { 世界: { 时间: '上午' } }, initialized_lorebooks: {} };
    host.Mvu = {
      getMvuData: target => {
        // 真实 MVU 会把 latest 就地改成实际楼层号；用这个行为防止
        // target 被冻结或在多次调用之间复用的回归。
        target.message_id = 4;
        return stored;
      },
      replaceMvuData: async (next, target) => {
        assert.deepEqual(target, { type: 'message', message_id: 'latest' });
        target.message_id = 4;
        stored = next;
      },
    };

    const service = createMvuService();
    const transaction = await service.transaction(
      state => {
        state.世界.时间 = '下午';
        state.房东系统 = { 运行模式: '模拟' };
        return '完成';
      },
      {
        validate: snapshot => {
          assert.equal(snapshot.stat_data.世界.时间, '下午');
          return snapshot;
        },
      },
    );

    assert.equal(transaction.before.stat_data.世界.时间, '上午');
    assert.equal(transaction.after.stat_data.世界.时间, '下午');
    assert.equal(transaction.result, '完成');
    assert.deepEqual(stored.stat_data.房东系统, { 运行模式: '模拟' });
  } finally {
    delete globalThis.window;
  }
});
