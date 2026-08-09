#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePortfolio } from '../scripts/src/buildings/compiler.js';
import { createBuildingLayout } from '../scripts/src/buildings/layout-engine.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { managementMockRecipes } from '../scripts/src/mock/management-recipes.js';
import { renderConsole } from '../scripts/src/ui/console/templates.js';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDirectory, '..');
const outputDirectory = process.argv[2] ?? '/tmp/landlord-console-preview';
const styles = await fs.readFile(path.join(projectRoot, 'scripts/modules/landlord-console/styles.css'), 'utf8');
const state = createDefaultLandlordState();
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
};
const identityCenter = { residents: [] };
const twin = createBuildingLayout(current);

const pages = {
  portfolio: { ui: { section: 'portfolio' }, task: null },
  'portfolio-dark': { ui: { section: 'portfolio' }, task: null, theme: 'dark' },
  building: { ui: { section: 'building' }, task: null },
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
  events: { ui: { section: 'events' }, task: null },
  twin: { ui: { section: 'twin' }, task: null },
};

await fs.mkdir(outputDirectory, { recursive: true });

for (const [name, page] of Object.entries(pages)) {
  const rendered = renderConsole({ state, portfolio, current, ui: { notice: null, ...page.ui }, task: page.task, taskCenter, linkCenter, identityCenter, twin });
  const html = page.theme ? rendered.replace('class="lmo-backdrop"', `class="lmo-backdrop" data-theme="${page.theme}"`) : rendered;
  await fs.writeFile(
    path.join(outputDirectory, `${name}.html`),
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>房东经营中枢 · ${name}</title><style>html,body{margin:0;min-height:100%;background:#171521}${styles}</style></head><body><div id="landlord-console-root">${html}</div></body></html>`,
    'utf8',
  );
}

console.log(`经营中枢视觉预览已生成：${outputDirectory}`);
