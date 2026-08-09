import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { createTenantIdentityService } from '../scripts/src/services/tenant-identity-service.js';

function fixture() {
  const state = createDefaultLandlordState();
  state.人物列表.tenant_alice = {
    姓名: '爱丽丝', 来源世界: '奇境', 身份类型: '租客', 职业: '冒险者',
    所在建筑ID: 'building_headquarters', 所在空间ID: 'living_room', 状态: '喝下午茶',
    视觉身份: { 图标: 'rabbit', 主色: '#6B8DC9', 纹样: 'cards' },
  };
  return state;
}

test('同一租客在四个系统中共用稳定身份键与实时位置', () => {
  const state = fixture();
  const service = createTenantIdentityService({ store: { getState: () => state } });
  const first = service.get('tenant_alice');
  const second = service.get('tenant_alice');
  assert.deepEqual(first, second);
  assert.match(first.avatarKey, /^tenant_[a-z0-9]+$/);
  assert.match(first.contactId, /^landlord_wechat_/);
  assert.equal(first.spaceName, '客厅');
  assert.equal(service.project('tenant_alice', '微信').avatarKey, first.avatarKey);
  assert.equal(service.project('tenant_alice', '建筑').markerId, first.markerId);
  assert.equal(service.project('tenant_alice', '正文').location, '房东总部公寓·客厅');
  assert.match(service.project('tenant_alice', '新闻').descriptor, /奇境.*冒险者/);
  assert.equal(service.listForBuilding('building_headquarters').length, 1);
});
