import assert from 'node:assert/strict';
import test from 'node:test';
import { compileBuildingMemories } from '../scripts/src/buildings/memory-engine.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';

function createMemoryState() {
  const state = createDefaultLandlordState();
  state.人物列表.person_linxia = {
    姓名: '林夏', 来源世界: '近未来都市', 身份类型: '租客', 职业: '空间摄影师',
    所在建筑ID: 'building_headquarters', 所在空间ID: 'living_room', 外貌: '银灰短发',
    性格: '敏锐', 状态: '正在生活', 内心: '想记录这里', 感知度: 100,
    视觉身份: { 图标: 'camera', 主色: '#6B8DC9', 纹样: 'grid' }, 关系: {},
  };
  state.事件列表.event_renovation = { 标题: '客厅焕然一新', 类型: '装修完成', 建筑ID: 'building_headquarters', 空间ID: 'living_room', 状态: '已完成', 摘要: '客厅完成跨世界改造。', 发生时间: '昨天', 参与者: {} };
  state.事件列表.event_relationship = { 标题: '林夏的共同生活', 类型: '关系场景', 建筑ID: 'building_headquarters', 空间ID: 'living_room', 状态: '已完成', 摘要: '一次跨世界生活实验。', 发生时间: '刚刚', 参与者: { person_linxia: '参与者' } };
  state.事件列表.event_takeover = { 标题: '总部开始经营', 类型: '建筑接管', 建筑ID: 'building_headquarters', 空间ID: '', 状态: '已完成', 摘要: '建筑级事件。', 发生时间: '更早', 参与者: {} };
  state.事件列表.event_other = { 标题: '医院事件', 类型: '建筑场景', 建筑ID: 'building_hospital_candidate', 空间ID: 'hospital_lobby', 状态: '已完成', 摘要: '不属于总部。', 发生时间: '刚刚', 参与者: {} };
  return state;
}

test('空间记忆只收集当前建筑事件并按真实空间归档', () => {
  const state = createMemoryState();
  const before = structuredClone(state);
  const memory = compileBuildingMemories(state, 'building_headquarters');
  const livingRoom = memory.spaces.find(space => space.id === 'living_room');

  assert.equal(memory.totalEvents, 3);
  assert.equal(memory.activeSpaces, 1);
  assert.equal(livingRoom.count, 2);
  assert.equal(livingRoom.latest.title, '林夏的共同生活');
  assert.equal(livingRoom.dominantType, '关系场景');
  assert.deepEqual(livingRoom.latest.participantNames, ['林夏']);
  assert.equal(memory.unplaced.length, 1);
  assert.equal(memory.unplaced[0].title, '总部开始经营');
  assert.deepEqual(state, before, '空间记忆编译不能修改 MVU');
});

test('同一事件状态会得到稳定签名和边界内回声强度', () => {
  const state = createMemoryState();
  const first = compileBuildingMemories(state, 'building_headquarters');
  const second = compileBuildingMemories(structuredClone(state), 'building_headquarters');
  assert.equal(first.signature, second.signature);
  assert.ok(first.spaces.every(space => space.resonance >= 0 && space.resonance <= 100));
  assert.throws(() => compileBuildingMemories(state, 'missing_building'), /建筑不存在/);
});
