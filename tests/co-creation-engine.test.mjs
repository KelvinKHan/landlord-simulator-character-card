import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { managementMockRecipes } from '../scripts/src/mock/management-recipes.js';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { createLandlordStore } from '../scripts/src/services/landlord-store.js';
import { createMockTaskService } from '../scripts/src/services/mock-task-service.js';
import { compileCoCreationProjects, createLocalCoCreationPlans } from '../scripts/src/tenants/co-creation-engine.js';
import { handleCoCreationAction } from '../scripts/src/ui/console/co-creation-actions.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');
test.after(() => delete globalThis.z);

function addPerson(state, id, name, origin, profession, color) {
  state.人物列表[id] = {
    姓名: name, 来源世界: origin, 身份类型: '租客', 职业: profession,
    所在建筑ID: 'building_headquarters', 所在空间ID: 'living_room', 外貌: '待补充',
    性格: '好奇而有行动力', 状态: '共同生活中', 内心: '想把这次相遇留下来', 感知度: 100,
    视觉身份: { 图标: 'person', 主色: color, 纹样: 'signal' }, 生活状态: {}, 关系: {},
  };
  state.建筑列表.building_headquarters.空间列表.living_room.占用者[id] = '租客';
}

function createProjectState() {
  const state = createDefaultLandlordState();
  addPerson(state, 'person_future', '林夏', '近未来都市', '空间摄影师', '#6B8DC9');
  addPerson(state, 'person_fantasy', '邵青', '东方幻想', '灵植师', '#55B7A5');
  state.事件列表.event_shared_life = {
    标题: '林夏与邵青的跨世界夜谈', 类型: '关系场景', 建筑ID: 'building_headquarters', 空间ID: 'living_room',
    状态: '已完成', 摘要: '两种生活方式第一次真正交汇。', 发生时间: '刚刚', 场景键: 'relationship_scene_shared_life',
    参与者: { person_future: '跨世界同伴', person_fantasy: '跨世界同伴' },
  };
  return state;
}

function createMemoryMvu(initialState) {
  let snapshot = { initialized_lorebooks: {}, stat_data: { 房东系统: structuredClone(initialState) } };
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
      await update(draft.stat_data, draft);
      if (validate) draft = await validate(draft);
      snapshot = structuredClone(draft);
      return { before, after: structuredClone(snapshot) };
    },
  };
}

function createStore(state) {
  let next = 0;
  return createLandlordStore({
    mvu: createMemoryMvu(state),
    schema: { parseState: value => Schema.parse({ 房东系统: value }).房东系统 },
    idFactory: prefix => `${prefix}_co_creation_${++next}`,
  });
}

test('已确认双人生活场景会变成只读共创装修项目', () => {
  const state = createProjectState();
  const before = structuredClone(state);
  const center = compileCoCreationProjects(state, 'building_headquarters');

  assert.equal(center.projects.length, 1);
  assert.equal(center.focus.people.length, 2);
  assert.equal(center.focus.differentWorlds, true);
  assert.match(center.focus.premise, /近未来都市/);
  assert.match(center.focus.premise, /东方幻想/);
  assert.match(center.focus.expectedRenovationSignature, /^renovation_/);
  assert.deepEqual(state, before);
  assert.ok(Object.isFrozen(center));
});

test('本地共创配方把双方世界和职业编译为三种可视化装修方案', () => {
  const state = createProjectState();
  const project = compileCoCreationProjects(state).focus;
  const plans = createLocalCoCreationPlans(project, state.建筑列表.building_headquarters);

  assert.equal(plans.length, 3);
  assert.equal(new Set(plans.map(plan => plan.id)).size, 3);
  assert.ok(plans.every(plan => plan.resultDescription.includes('林夏') && plan.resultDescription.includes('邵青')));
  assert.ok(plans.some(plan => Object.values(plan.furniture).some(value => value.includes('空间摄影师'))));
  assert.ok(plans.some(plan => Object.values(plan.furniture).some(value => value.includes('灵植师'))));
});

test('共创确认原子写入装修、人物状态、事件和三频道草稿', async () => {
  const store = createStore(createProjectState());
  const project = compileCoCreationProjects(store.getState()).focus;
  const plan = createLocalCoCreationPlans(project, store.getState().建筑列表.building_headquarters)[0];
  await store.applyCoCreationRenovation({ project, plan });
  const state = store.getState();

  assert.equal(state.建筑列表.building_headquarters.空间列表.living_room.装修.风格, plan.style);
  assert.ok(project.personIds.every(personId => state.人物列表[personId].状态.includes('共同使用')));
  assert.equal(Object.values(state.事件列表).filter(event => event.类型 === '共创装修' && event.场景键 === project.id).length, 1);
  assert.deepEqual(Object.values(state.联动队列).filter(item => item.来源类型 === '共创装修').map(item => item.频道).sort(), ['建筑', '微信', '正文']);
  assert.equal(compileCoCreationProjects(state).focus, null);
  await assert.rejects(() => store.applyCoCreationRenovation({ project, plan }), /已经完成过/);
});

test('人物位置或房间装修变化后旧共创方案拒绝覆盖新状态', async () => {
  const movedStore = createStore(createProjectState());
  const movedProject = compileCoCreationProjects(movedStore.getState()).focus;
  const movedPlan = createLocalCoCreationPlans(movedProject)[0];
  await movedStore.movePerson({ personId: 'person_future', buildingId: 'building_headquarters', spaceId: 'garden', activity: '散步' });
  await assert.rejects(() => movedStore.applyCoCreationRenovation({ project: movedProject, plan: movedPlan }), /位置已经变化/);

  const renovatedStore = createStore(createProjectState());
  const renovatedProject = compileCoCreationProjects(renovatedStore.getState()).focus;
  const plans = createLocalCoCreationPlans(renovatedProject);
  await renovatedStore.applyRenovation({ buildingId: renovatedProject.buildingId, spaceId: renovatedProject.spaceId, plan: plans[1] });
  await assert.rejects(() => renovatedStore.applyCoCreationRenovation({ project: renovatedProject, plan: plans[0] }), /房间装修已经变化/);
});

test('共创界面动作通过统一任务中心生成，选择阶段不写入 MVU', async () => {
  globalThis.generate = () => assert.fail('本地共创不应调用 generate');
  globalThis.generateRaw = () => assert.fail('本地共创不应调用 generateRaw');
  try {
    const store = createStore(createProjectState());
    const tasks = createMockTaskService({ recipes: managementMockRecipes, idFactory: prefix => `${prefix}_co_ui` });
    const project = compileCoCreationProjects(store.getState()).focus;
    const ui = { selectedCoCreationProjectId: null, selectedCoCreationPlanId: null, taskId: null };
    const shared = {
      ui, store, tasks,
      render() {},
      withBusy: async work => work(),
      recordOperation: (_kind, _label, work) => work(),
      setNotice() {},
      runTask: async (kind, input) => { ui.taskId = (await tasks.run(kind, input)).id; },
    };
    await handleCoCreationAction({ ...shared, action: 'run-co-creation', button: { dataset: { projectId: project.id } } });
    const task = tasks.get(ui.taskId);
    assert.equal(task.kind, 'coCreation');
    assert.equal(task.preview.plans.length, 3);
    assert.equal(Object.values(store.getState().事件列表).filter(event => event.类型 === '共创装修').length, 0);

    const plan = task.preview.plans[0];
    await handleCoCreationAction({ ...shared, action: 'choose-co-creation-plan', button: { dataset: { projectId: project.id, planId: plan.id } } });
    assert.equal(store.getState().建筑列表.building_headquarters.空间列表.living_room.装修.风格, '基础装修');
    await handleCoCreationAction({ ...shared, action: 'confirm-co-creation', button: { dataset: {} } });
    assert.equal(store.getState().建筑列表.building_headquarters.空间列表.living_room.装修.风格, plan.style);
  } finally {
    delete globalThis.generate;
    delete globalThis.generateRaw;
  }
});
