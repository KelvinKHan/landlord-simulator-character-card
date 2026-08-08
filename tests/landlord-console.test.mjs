import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { z } from 'zod';
import { compileBuilding, compilePortfolio } from '../scripts/src/buildings/compiler.js';
import { managementMockRecipes } from '../scripts/src/mock/management-recipes.js';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';
import { createMockTaskService } from '../scripts/src/services/mock-task-service.js';
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
  const controller = createLandlordConsole({
    document: dom.window.document,
    store,
    tasks,
    compiler: { compileBuilding, compilePortfolio },
    logger: { error: () => {} },
  });

  try {
    await controller.open();
    assert.match(dom.window.document.body.textContent, /我的建筑版图/);
    assert.match(dom.window.document.body.textContent, /本地模拟模式/);
    assert.match(dom.window.document.body.textContent, /白塔社区医院/);

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
  } finally {
    controller.dispose();
    dom.window.close();
    delete globalThis.generate;
    delete globalThis.generateRaw;
  }
});
