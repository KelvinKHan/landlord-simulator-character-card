import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { z } from 'zod';
import { compileBuilding, compilePortfolio } from '../scripts/src/buildings/compiler.js';
import { createBuildingLayoutService } from '../scripts/src/buildings/layout-engine.js';
import { createBuildingEventBus } from '../scripts/src/events/building-event-bus.js';
import { managementMockRecipes } from '../scripts/src/mock/management-recipes.js';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';
import { createMockTaskService } from '../scripts/src/services/mock-task-service.js';
import { createOperationJournal } from '../scripts/src/services/operation-journal-service.js';
import { createSpatialSyncService } from '../scripts/src/services/spatial-sync-service.js';
import { createPerceptionService } from '../scripts/src/services/perception-service.js';
import { createChannelBridgeService } from '../scripts/src/services/channel-bridge-service.js';
import { createTenantIdentityService } from '../scripts/src/services/tenant-identity-service.js';
import { createRecipeTaskProvider, createTaskCenter } from '../scripts/src/services/task-center.js';
import { createLandlordConsole } from '../scripts/src/ui/console/controller.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');

test.after(() => {
  delete globalThis.z;
});

function createMemoryMvu() {
  let snapshot = { initialized_lorebooks: {}, stat_data: {} };
  return {
    read(path, fallback) {
      let value = snapshot.stat_data;
      for (const part of String(path).split('.')) {
        if (!value || typeof value !== 'object' || !(part in value)) return fallback;
        value = value[part];
      }
      return value;
    },
    async transaction(update, { validate } = {}) {
      const before = structuredClone(snapshot);
      let draft = structuredClone(snapshot);
      const result = await update(draft.stat_data, draft);
      if (validate) draft = await validate(draft);
      snapshot = structuredClone(draft);
      return { before, after: structuredClone(snapshot), result };
    },
  };
}

function createIds() {
  let next = 0;
  return prefix => `${prefix}_ui_${++next}`;
}

async function waitFor(assertion, timeout = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      return assertion();
    } catch {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  return assertion();
}

function click(document, selector) {
  const element = document.querySelector(selector);
  assert.ok(element, `找不到可点击元素：${selector}`);
  element.click();
}

test('经营中枢可以只用本地模拟数据完成接管、装修和招募', async () => {
  globalThis.generate = () => assert.fail('界面测试不应调用真实 generate');
  globalThis.generateRaw = () => assert.fail('界面测试不应调用真实 generateRaw');
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true });
  const schema = { parseState: value => Schema.parse({ 房东系统: value }).房东系统 };
  const store = createLandlordStore({ mvu: createMemoryMvu(), schema, idFactory: createIds() });
  const tasks = createMockTaskService({ recipes: managementMockRecipes, idFactory: createIds() });
  const events = createBuildingEventBus({ store });
  const historyIds = createIds();
  const history = createOperationJournal({ store, idFactory: () => historyIds('operation') });
  const spatialSync = createSpatialSyncService({ store, idFactory: () => historyIds('spatial') });
  const perception = createPerceptionService({ store });
  const identities = createTenantIdentityService({ store });
  const dispatchedLinks = [];
  const channelPorts = {
    capabilities: () => ({ 正文: true, 微信: true, 新闻: true, 建筑: true }),
    story: async draft => dispatchedLinks.push(draft),
    wechat: async draft => dispatchedLinks.push(draft),
    news: async draft => dispatchedLinks.push(draft),
    building: async draft => dispatchedLinks.push(draft),
  };
  const bridges = createChannelBridgeService({ events, identities, ports: channelPorts });
  const controller = createLandlordConsole({
    document: dom.window.document,
    store,
    tasks,
    events,
    history,
    spatialSync,
    perception,
    identities,
    bridges,
    layouts: createBuildingLayoutService(),
    compiler: { compileBuilding, compilePortfolio },
    logger: { error: () => {} },
  });

  try {
    await controller.open();
    assert.match(dom.window.document.body.textContent, /我的建筑版图/);
    assert.match(dom.window.document.body.textContent, /本地模拟模式/);
    assert.match(dom.window.document.body.textContent, /白塔社区医院/);

    click(dom.window.document, '[data-action="navigate"][data-section="twin"]');
    click(dom.window.document, '[data-action="focus-twin-floor"][data-floor-id="floor_1"]');
    assert.ok(dom.window.document.querySelectorAll('.lmo-twin-edges [data-edge-id]').length >= 1);
    click(dom.window.document, '[data-action="navigate"][data-section="portfolio"]');

    click(dom.window.document, '[data-action="open-takeover"][data-building-id="building_hospital_candidate"]');
    assert.match(dom.window.document.body.textContent, /建筑接管提案/);
    click(dom.window.document, '[data-action="run-takeover"]');
    await waitFor(() => assert.match(dom.window.document.body.textContent, /治愈系生活医院/));
    click(dom.window.document, '[data-action="choose-option"][data-option-id="healing-community"]');
    click(dom.window.document, '[data-action="confirm-takeover"]');
    await waitFor(() => assert.equal(store.getState().建筑列表.building_hospital_candidate.接管状态, '已接管'));
    assert.match(dom.window.document.body.textContent, /白塔治愈生活馆/);

    click(dom.window.document, '[data-action="navigate"][data-section="renovation"]');
    click(dom.window.document, '[data-action="choose-workflow-space"][data-space-id="hospital_ward"]');
    click(dom.window.document, '[data-action="run-renovation"]');
    await waitFor(() => assert.match(dom.window.document.body.textContent, /万界拼贴/));
    assert.equal(dom.window.document.querySelectorAll('.lmo-renovation-card[data-renovation-signature]').length, 3);
    click(dom.window.document, '[data-action="choose-option"][data-option-id="world-collision"]');
    click(dom.window.document, '[data-action="confirm-renovation"]');
    await waitFor(() =>
      assert.equal(
        store.getState().建筑列表.building_hospital_candidate.空间列表.hospital_ward.装修.风格,
        '跨世界折衷',
      ),
    );
    const renovationEvent = Object.values(store.getState().事件列表).find(event => event.类型 === '装修完成');
    assert.match(renovationEvent.摘要, /^旧住院部拥有了/);
    assert.doesNotMatch(renovationEvent.摘要, /undefined/);

    click(dom.window.document, '[data-action="navigate"][data-section="recruitment"]');
    click(dom.window.document, '[data-action="run-recruitment"]');
    await waitFor(() => assert.match(dom.window.document.body.textContent, /林夏/));
    click(dom.window.document, '[data-action="choose-option"][data-option-id="person_mock_医院_linxia"]');
    click(dom.window.document, '[data-action="choose-recruit-space"][data-space-id="hospital_ward"]');
    click(dom.window.document, '[data-action="confirm-recruitment"]');
    await waitFor(() => assert.equal(store.getState().人物列表.person_mock_医院_linxia.姓名, '林夏'));
    assert.match(dom.window.document.body.textContent, /林夏已经正式加入白塔治愈生活馆/);

    click(dom.window.document, '[data-action="navigate"][data-section="history"]');
    assert.match(dom.window.document.body.textContent, /经营状态有自己的时间轴/);
    assert.equal(dom.window.document.querySelectorAll('.lmo-history-list>div').length, 3);
    click(dom.window.document, '[data-action="undo-operation"]');
    await waitFor(() => assert.equal(store.getState().人物列表.person_mock_医院_linxia, undefined));
    assert.match(dom.window.document.body.textContent, /已撤销：招募林夏/);
    click(dom.window.document, '[data-action="redo-operation"]');
    await waitFor(() => assert.equal(store.getState().人物列表.person_mock_医院_linxia.姓名, '林夏'));
    assert.match(dom.window.document.body.textContent, /已重做：招募林夏/);

    click(dom.window.document, '[data-action="navigate"][data-section="tasks"]');
    assert.match(dom.window.document.body.textContent, /统一任务中心/);
    assert.match(dom.window.document.body.textContent, /切换模式不会发起生成/);
    assert.equal(dom.window.document.querySelector('[data-action="set-task-mode"][data-mode="ai"]').disabled, true);
    assert.equal(dom.window.document.querySelectorAll('.lmo-task-row').length, 3);

    click(dom.window.document, '[data-action="navigate"][data-section="events"]');
    assert.match(dom.window.document.body.textContent, /跨系统联动队列/);
    assert.equal(events.list({ status: '待分发' }).length, 12);
    click(dom.window.document, '[data-action="consume-link"]');
    await waitFor(() => assert.equal(events.list({ status: '已读取' }).length, 1));
    click(dom.window.document, '[data-action="preview-link"]');
    assert.match(dom.window.document.body.textContent, /投递前预览/);
    assert.equal(dispatchedLinks.length, 0);
    click(dom.window.document, '[data-action="dispatch-preview-links"]');
    await waitFor(() => assert.equal(events.list({ status: '已读取' }).length, 2));
    assert.equal(dispatchedLinks.length, 1);

    click(dom.window.document, '[data-action="navigate"][data-section="building"]');
    assert.match(dom.window.document.body.textContent, /landlord_wechat_/);
    click(dom.window.document, '[data-action="navigate"][data-section="twin"]');
    assert.match(dom.window.document.body.textContent, /可计算空间镜像/);
    assert.equal(dom.window.document.querySelectorAll('.lmo-twin-map').length, 1);
    assert.ok(dom.window.document.querySelectorAll('.lmo-twin-map [data-action="inspect-twin-space"]').length >= 1);
    assert.ok(dom.window.document.querySelector('.lmo-twin-inspector [data-action="select-space"]'));
    const renovatedTwinRoom = dom.window.document.querySelector('[data-space-id="hospital_ward"][data-renovation-signature]');
    assert.ok(renovatedTwinRoom);
    assert.match(renovatedTwinRoom.className, /material-arcane/);

    const rooms = [...dom.window.document.querySelectorAll('[data-action="inspect-twin-space"]')];
    const inspectedName = rooms.at(-1).querySelector('strong').textContent;
    rooms.at(-1).click();
    assert.equal(dom.window.document.querySelector('[data-action="inspect-twin-space"][aria-pressed="true"] strong').textContent, inspectedName);
    assert.match(dom.window.document.querySelector('.lmo-twin-inspector').textContent, new RegExp(inspectedName));

    const floorButtons = [...dom.window.document.querySelectorAll('[data-action="focus-twin-floor"]')];
    assert.ok(floorButtons.length >= 2);
    floorButtons.at(-1).click();
    assert.equal(dom.window.document.querySelectorAll('[data-action="focus-twin-floor"][aria-pressed="true"]').length, 1);
    assert.equal(dom.window.document.querySelectorAll('.lmo-twin-map').length, 1);

    click(dom.window.document, '[data-action="navigate"][data-section="spatial"]');
    assert.match(dom.window.document.body.textContent, /让人物位置先通过建筑结构校验/);
    click(dom.window.document, '[data-action="choose-spatial-person"][data-person-id="person_mock_医院_linxia"]');
    const destination = [...dom.window.document.querySelectorAll('[data-action="choose-spatial-space"]')]
      .find(element => element.dataset.spaceId !== 'hospital_ward');
    assert.ok(destination);
    destination.click();
    click(dom.window.document, '[data-action="propose-spatial-move"]');
    assert.match(dom.window.document.body.textContent, /空间同步提案/);
    click(dom.window.document, '[data-action="confirm-spatial-proposal"]');
    await waitFor(() => assert.equal(store.getState().人物列表.person_mock_医院_linxia.所在空间ID, destination.dataset.spaceId));
    assert.match(dom.window.document.body.textContent, /人物位置与建筑占用记录已经同步/);
  } finally {
    controller.dispose();
    events.dispose();
    history.dispose();
    spatialSync.dispose();
    dom.window.close();
    delete globalThis.generate;
    delete globalThis.generateRaw;
  }
});

test('任务中心只切换 AI 模式时不会隐式发起生成', async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true });
  const schema = { parseState: value => Schema.parse({ 房东系统: value }).房东系统 };
  const store = createLandlordStore({ mvu: createMemoryMvu(), schema, idFactory: createIds() });
  let aiCalls = 0;
  const tasks = createTaskCenter({
    providers: {
      local: createRecipeTaskProvider({ recipes: managementMockRecipes }),
      ai: { id: 'fake-ai', available: () => true, supports: () => true, run: async () => { aiCalls += 1; throw new Error('不应生成'); } },
    },
  });
  const controller = createLandlordConsole({
    document: dom.window.document,
    store,
    tasks,
    compiler: { compileBuilding, compilePortfolio },
    logger: { error() {} },
  });
  try {
    await controller.open();
    click(dom.window.document, '[data-action="navigate"][data-section="tasks"]');
    const aiButton = dom.window.document.querySelector('[data-action="set-task-mode"][data-mode="ai"]');
    assert.equal(aiButton.disabled, false);
    aiButton.click();
    await waitFor(() => assert.equal(store.getState().运行模式, '真实'));
    assert.equal(tasks.mode, 'ai');
    assert.equal(aiCalls, 0);
    assert.match(dom.window.document.body.textContent, /AI 生成模式/);
  } finally {
    controller.dispose();
    tasks.dispose();
    dom.window.close();
  }
});
