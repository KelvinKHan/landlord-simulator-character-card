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
        assert.deepEqual(target, { type: 'message', message_id: -1 });
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
