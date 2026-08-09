import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { compileTenantAutonomy } from '../scripts/src/tenants/autonomy-engine.js';

function createAutonomyState() {
  const state = createDefaultLandlordState();
  state.人物列表.person_photo = {
    姓名: '林夏', 来源世界: '近未来都市', 身份类型: '租客', 职业: '空间摄影师',
    所在建筑ID: 'building_headquarters', 所在空间ID: 'room_owner', 外貌: '银灰短发',
    性格: '敏锐而好奇', 状态: '正在休息', 内心: '想看看建筑里别的光线', 感知度: 100,
    视觉身份: { 图标: 'camera', 主色: '#6B8DC9', 纹样: 'grid' }, 关系: {},
  };
  state.建筑列表.building_headquarters.空间列表.room_owner.占用者.person_photo = '租客';
  return state;
}

test('租客会从真实建筑空间中提出职业化自主行动', () => {
  const state = createAutonomyState();
  const before = structuredClone(state);
  const center = compileTenantAutonomy(state, 'building_headquarters');
  assert.equal(center.proposals.length, 1);
  const proposal = center.proposals[0];
  assert.equal(proposal.personId, 'person_photo');
  assert.notEqual(proposal.destination.id, 'room_owner');
  assert.ok(state.建筑列表.building_headquarters.空间列表[proposal.destination.id]);
  assert.match(proposal.activity, /采集.+光影与生活样本/);
  assert.match(proposal.summary, /不是永久搬家/);
  assert.equal(proposal.expectedFrom.spaceId, 'room_owner');
  assert.deepEqual(state, before, '自主行动编译不能修改 MVU');
});

test('不同职业和性格会得到可解释且稳定的行动提案', () => {
  const state = createAutonomyState();
  state.人物列表.person_healer = {
    姓名: '白榆', 来源世界: '现代都市', 身份类型: '租客', 职业: '心理治疗师',
    所在建筑ID: 'building_headquarters', 所在空间ID: 'garden', 外貌: '黑发',
    性格: '安静谨慎', 状态: '正在散步', 内心: '想确认住户是否放松', 感知度: 100,
    视觉身份: { 图标: 'heart', 主色: '#55B7A5', 纹样: 'soft' }, 关系: {},
  };
  state.建筑列表.building_headquarters.空间列表.garden.占用者.person_healer = '租客';
  const first = compileTenantAutonomy(state, 'building_headquarters');
  const second = compileTenantAutonomy(structuredClone(state), 'building_headquarters');
  assert.equal(first.signature, second.signature);
  assert.equal(first.proposals.length, 2);
  assert.match(first.proposals.find(item => item.personId === 'person_healer').activity, /检查.+真正放松/);
  assert.ok(first.proposals.every(item => item.reasons.length >= 1));
});

test('没有其他空间时不会制造无法执行的自主行动', () => {
  const state = createAutonomyState();
  const building = state.建筑列表.building_headquarters;
  building.空间列表 = { room_owner: building.空间列表.room_owner };
  assert.equal(compileTenantAutonomy(state, 'building_headquarters').proposals.length, 0);
  assert.throws(() => compileTenantAutonomy(state, 'missing_building'), /建筑不存在/);
});
