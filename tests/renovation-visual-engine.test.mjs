import assert from 'node:assert/strict';
import test from 'node:test';
import { compileBuilding } from '../scripts/src/buildings/compiler.js';
import { createBuildingLayout } from '../scripts/src/buildings/layout-engine.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { createRenovationVisual } from '../scripts/src/renovation/visual-engine.js';

test('装修具现化把任意语义方案稳定编译为安全视觉令牌', () => {
  const plan = {
    style: '万界魔法实验室',
    palette: { 主色: '#232136', 点缀: '#c4a7e7', 非法色: 'url(javascript:alert(1))' },
    materials: { 地面: '发光符文石材', 墙面: '可替换展示模块' },
    furniture: { center: '可重组模块沙发', display: '世界收藏展示墙' },
    lighting: '可随人物来源变化的情景灯带',
    atmosphere: '神秘、丰富、充满碰撞感',
  };
  const first = createRenovationVisual(plan, { fallbackAccent: '#ff9eaa' });
  const second = createRenovationVisual(structuredClone(plan), { fallbackAccent: '#ff9eaa' });
  assert.deepEqual(first, second);
  assert.equal(first.material, 'arcane');
  assert.equal(first.lightingMode, 'dynamic');
  assert.equal(first.css.base, '#232136');
  assert.equal(first.css.accent, '#C4A7E7');
  assert.ok(first.colors.every(color => /^#[0-9A-F]{6}$/.test(color.value)));
  assert.deepEqual(first.furniture.map(item => item.marker), ['座', '展']);
  assert.match(first.signature, /^renovation_[a-z0-9]+$/);
});

test('确认后的装修状态会直接改变数字孪生房间视觉', () => {
  const state = createDefaultLandlordState();
  const room = state.建筑列表.building_headquarters.空间列表.living_room;
  const before = createBuildingLayout(compileBuilding('building_headquarters', state.建筑列表.building_headquarters, state.人物列表));
  const beforeNode = before.floors.flatMap(floor => floor.nodes).find(node => node.id === 'living_room');
  room.装修 = {
    风格: '静谧未来',
    配色: { 主色: '#F8FAFC', 点缀: '#6B8DC9', 光色: '#67E8F9' },
    材质: { 地面: '无缝浅灰地坪', 墙面: '金属微孔吸音板' },
    家具: { wall: '情景信息墙', hidden: '自动收纳模块' },
    照明: '无主灯天光模拟系统',
    氛围: '清爽、安静、秩序感',
    完成度: 100,
  };
  const after = createBuildingLayout(compileBuilding('building_headquarters', state.建筑列表.building_headquarters, state.人物列表));
  const afterNode = after.floors.flatMap(floor => floor.nodes).find(node => node.id === 'living_room');
  assert.notEqual(afterNode.visual.signature, beforeNode.visual.signature);
  assert.equal(afterNode.visual.material, 'metal');
  assert.equal(afterNode.visual.lightingMode, 'cool');
  assert.equal(afterNode.visual.furniture.length, 2);
});
