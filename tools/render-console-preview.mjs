#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePortfolio } from '../scripts/src/buildings/compiler.js';
import { createBuildingLayout } from '../scripts/src/buildings/layout-engine.js';
import { compileBuildingOperations } from '../scripts/src/buildings/operations-engine.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { managementMockRecipes } from '../scripts/src/mock/management-recipes.js';
import { compileTenantEmbodiment } from '../scripts/src/tenants/embodiment-engine.js';
import { renderConsole } from '../scripts/src/ui/console/templates.js';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDirectory, '..');
const outputDirectory = process.argv[2] ?? '/tmp/landlord-console-preview';
const styles = await fs.readFile(path.join(projectRoot, 'scripts/modules/landlord-console/styles.css'), 'utf8');
const state = createDefaultLandlordState();
state.人物列表.preview_person_linxia = { 姓名: '林夏', 来源世界: '近未来都市', 身份类型: '租客', 职业: '空间摄影师', 所在建筑ID: 'building_headquarters', 所在空间ID: 'living_room', 外貌: '银灰短发', 性格: '敏锐而松弛', 状态: '正在观察客厅', 内心: '这里的光很适合留下第一张照片', 感知度: 100, 视觉身份: { 图标: 'camera', 主色: '#6B8DC9', 纹样: 'grid' }, 关系: {} };
state.人物列表.preview_person_shaoqing = { 姓名: '邵青', 来源世界: '东方幻想', 身份类型: '租客', 职业: '灵植师', 所在建筑ID: 'building_headquarters', 所在空间ID: 'living_room', 外貌: '墨绿长发', 性格: '安静好奇', 状态: '研究现代家具', 内心: '这些器物没有灵力却很方便', 感知度: 100, 视觉身份: { 图标: 'leaf', 主色: '#55B7A5', 纹样: 'leaves' }, 关系: {} };
state.建筑列表.building_headquarters.空间列表.living_room.占用者 = { preview_person_linxia: '租客', preview_person_shaoqing: '租客' };
state.建筑列表.building_headquarters.空间列表.living_room.装修 = { 风格: '跨世界会客厅', 配色: { 主色: '#E8E4FF', 点缀: '#55B7A5' }, 材质: { 墙面: '半透明灵质玻璃', 地面: '暖木' }, 家具: { 主沙发: '云朵沙发', 展示台: '漂浮陈列台' }, 照明: '自然柔光与灵光', 氛围: '梦幻而舒适', 完成度: 100 };
const portfolio = compilePortfolio(state);
const current = portfolio.headquarters;
const hospital = portfolio.available.find(building => building.type === '医院');
const ownerRoom = current.floors.flatMap(floor => floor.spaces).find(space => space.id === 'room_owner');
const takeoverPreview = await managementMockRecipes.takeover({ building: hospital });
const renovationPreview = await managementMockRecipes.renovation({ building: current, space: ownerRoom });
const recruitmentPreview = await managementMockRecipes.recruitment({ building: current });
const taskCenter = {
  mode: 'local',
  capabilities: [{ mode: 'local', available: true }, { mode: 'ai', available: false }],
  tasks: [
    { id: 'preview_task_takeover', kind: 'takeover', mode: 'local', status: 'confirmed', attempt: 1, maxAttempts: 2, error: null },
    { id: 'preview_task_renovation', kind: 'renovation', mode: 'local', status: 'ready', attempt: 1, maxAttempts: 2, error: null },
  ],
};
const linkCenter = {
  counts: { 正文: 1, 微信: 1, 新闻: 1, 建筑: 1 },
  capabilities: { 正文: true, 微信: true, 新闻: true, 建筑: true },
  pending: [
    { id: 'preview_link_story', 频道: '正文', 标题: '总部客厅完成改造', 摘要: '新的空间变化等待在正文中显露。' },
    { id: 'preview_link_wechat', 频道: '微信', 标题: '新成员加入', 摘要: '联系人和建筑位置已经同步。' },
  ],
  previewDrafts: [
    { deliveryId: 'preview_link_story', eventId: 'preview_event', channel: '正文', status: '待分发', kind: 'story-context', title: '总部客厅完成改造', summary: '新的空间变化等待在正文中显露。', content: '<landlord_link event="preview_event">\n- [装修完成] 总部客厅完成改造：新的空间变化等待在正文中显露。\n</landlord_link>' },
    { deliveryId: 'preview_link_wechat', eventId: 'preview_event', channel: '微信', status: '待分发', kind: 'wechat-message', title: '新成员加入', summary: '联系人和建筑位置已经同步。', conversationName: '房东总部公寓·经营群', sender: '房东系统', content: '联系人和建筑位置已经同步。' },
  ],
};
const identityCenter = { residents: [] };
const historyCenter = {
  busy: false,
  count: 3,
  appliedCount: 2,
  canUndo: true,
  canRedo: true,
  undoLabel: '装修客厅',
  redoLabel: '招募林夏',
  blockedUndo: false,
  entries: [
    { id: 'op_3', kind: 'recruitment', label: '招募林夏', changeCount: 8, affectedRoots: ['人物列表', '建筑列表'], createdAt: Date.now(), status: '已撤销' },
    { id: 'op_2', kind: 'renovation', label: '装修客厅', changeCount: 12, affectedRoots: ['建筑列表', '事件列表', '联动队列'], createdAt: Date.now() - 60_000, status: '已应用' },
    { id: 'op_1', kind: 'exploration', label: '探索房东总部公寓', changeCount: 2, affectedRoots: ['建筑列表'], createdAt: Date.now() - 120_000, status: '已应用' },
  ],
};
const twinBuilding = structuredClone(current);
const twinRoom = twinBuilding.floors.flatMap(floor => floor.spaces).find(space => space.id === ownerRoom.id);
const twinPlan = renovationPreview.plans[1];
twinRoom.renovation = {
  风格: twinPlan.style,
  配色: twinPlan.palette,
  材质: twinPlan.materials,
  家具: twinPlan.furniture,
  照明: twinPlan.lighting,
  氛围: twinPlan.atmosphere,
  完成度: 100,
};
const twin = createBuildingLayout(twinBuilding);
const spatialCenter = {
  people: [
    { id: 'preview_person_linxia', name: '林夏', status: '正在看窗外', buildingName: current.name, spaceName: '客厅', color: '#6B8DC9' },
    { id: 'preview_person_shaoqing', name: '邵青', status: '研究电梯', buildingName: current.name, spaceName: '花园', color: '#55B7A5' },
  ],
  spaces: current.floors.flatMap(floor => floor.spaces).map(space => ({ ...space, floorName: current.floors.find(floor => floor.spaces.some(item => item.id === space.id))?.name ?? '' })),
  counts: { 待确认: 1, 冲突: 1, 已应用: 2, 已忽略: 0, 写入中: 0 },
  proposals: [
    { id: 'spatial_preview_ready', personId: 'preview_person_linxia', buildingId: current.id, spaceId: 'garden', activity: '观察花园里的异世界植物', status: '待确认', reason: '经过 2 段已知连接', route: { personName: '林夏', destinationName: '花园', kind: '建筑内移动', path: ['living_room', 'garden'] } },
    { id: 'spatial_preview_conflict', personId: 'preview_person_shaoqing', buildingId: current.id, spaceId: 'unknown_room', activity: '寻找不存在的密室', status: '冲突', reason: '目标空间尚未被发现', route: { personName: '邵青', destinationName: '未知密室', path: [] } },
  ],
};
const pulse = compileBuildingOperations(state, current.id);
const tenantLife = compileTenantEmbodiment(state, current.id);

const pages = {
  portfolio: { ui: { section: 'portfolio' }, task: null },
  'portfolio-dark': { ui: { section: 'portfolio' }, task: null, theme: 'dark' },
  building: { ui: { section: 'building' }, task: null },
  pulse: { ui: { section: 'pulse', selectedPulseSceneId: pulse.scenes[0]?.id }, task: null },
  tenants: { ui: { section: 'tenants', selectedReactionId: tenantLife.residents[0]?.id }, task: null },
  takeover: {
    ui: { section: 'takeover', targetBuilding: hospital, selectedOptionId: 'multiverse-medical', busy: false },
    task: { status: 'ready', preview: takeoverPreview },
  },
  renovation: {
    ui: { section: 'renovation', selectedSpaceId: ownerRoom.id, selectedOptionId: 'world-collision', busy: false },
    task: { status: 'ready', preview: renovationPreview },
  },
  recruitment: {
    ui: {
      section: 'recruitment',
      selectedSpaceId: 'living_room',
      selectedOptionId: recruitmentPreview.candidates[0].id,
      busy: false,
    },
    task: { status: 'ready', preview: recruitmentPreview },
  },
  tasks: { ui: { section: 'tasks' }, task: null },
  history: { ui: { section: 'history' }, task: null },
  spatial: { ui: { section: 'spatial', selectedMovePersonId: 'preview_person_linxia', selectedMoveSpaceId: 'garden' }, task: null },
  events: { ui: { section: 'events' }, task: null },
  twin: { ui: { section: 'twin', twinLayer: 'layout' }, task: null },
  'twin-pulse': { ui: { section: 'twin', twinLayer: 'pulse', focusedFloorId: 'floor_1', twinSpaceId: 'living_room' }, task: null },
  'twin-tenants': { ui: { section: 'twin', twinLayer: 'tenants', focusedFloorId: 'floor_1', twinSpaceId: 'living_room' }, task: null },
};

await fs.mkdir(outputDirectory, { recursive: true });

for (const [name, page] of Object.entries(pages)) {
  const rendered = renderConsole({ state, portfolio, current, ui: { notice: null, ...page.ui }, task: page.task, taskCenter, linkCenter, identityCenter, historyCenter, spatialCenter, tenantLife, pulse, twin });
  const html = page.theme ? rendered.replace('class="lmo-backdrop"', `class="lmo-backdrop" data-theme="${page.theme}"`) : rendered;
  await fs.writeFile(
    path.join(outputDirectory, `${name}.html`),
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>房东经营中枢 · ${name}</title><style>html,body{margin:0;min-height:100%;background:#171521}${styles}</style></head><body><div id="landlord-console-root">${html}</div></body></html>`,
    'utf8',
  );
}

console.log(`经营中枢视觉预览已生成：${outputDirectory}`);
