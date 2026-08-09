import { renderConsole } from './templates.js';

function owned(building) {
  return building && ['总部', '已接管'].includes(building.status);
}

export function createLandlordConsole({ document, store, tasks, events = null, perception = null, identities = null, layouts = null, bridges = null, compiler, logger }) {
  let root = null;
  let visible = false;
  let disposed = false;
  const ui = {
    section: 'portfolio',
    targetBuildingId: null,
    selectedSpaceId: null,
    selectedOptionId: null,
    taskId: null,
    busy: false,
    notice: null,
  };

  function getData() {
    const state = store.getState();
    const portfolio = compiler.compilePortfolio(state);
    const current = portfolio.buildings.find(item => item.id === state.当前建筑ID) ?? portfolio.headquarters;
    const targetBuilding = portfolio.buildings.find(item => item.id === ui.targetBuildingId) ?? current;
    const taskCenter = {
      mode: tasks.mode,
      capabilities: tasks.capabilities(),
      tasks: tasks.list(),
    };
    const linkCenter = events
      ? { counts: events.counts(), pending: events.list({ status: '待分发', limit: 20 }), capabilities: bridges?.capabilities() ?? {} }
      : { counts: { 正文: 0, 微信: 0, 新闻: 0, 建筑: 0 }, pending: [], capabilities: {} };
    const identityCenter = { residents: identities?.listForBuilding(current.id) ?? [] };
    const twin = layouts?.compile(current) ?? { buildingId: current.id, name: current.name, theme: current.theme, floors: [], metrics: { floors: 0, nodes: 0, edges: 0 } };
    return { state, portfolio, current, targetBuilding, taskCenter, linkCenter, identityCenter, twin };
  }

  function resetWorkflow({ keepSpace = false } = {}) {
    ui.taskId = null;
    ui.selectedOptionId = null;
    if (!keepSpace) ui.selectedSpaceId = null;
    ui.notice = null;
  }

  function setNotice(text, type = 'info') {
    ui.notice = { text, type };
  }

  function render() {
    if (!visible || disposed) return;
    const data = getData();
    ui.targetBuilding = data.targetBuilding;
    const task = ui.taskId ? tasks.get(ui.taskId) : null;
    root.innerHTML = renderConsole({ ...data, ui, task });
    root.querySelector('.lmo-backdrop').dataset.theme = detectTheme(document);
  }

  async function withBusy(work) {
    if (ui.busy) return;
    ui.busy = true;
    ui.notice = null;
    render();
    try {
      await work();
    } catch (error) {
      logger.error(error);
      setNotice(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      ui.busy = false;
      render();
    }
  }

  async function runTask(kind, input) {
    const task = await tasks.run(kind, input);
    if (task.status !== 'ready') throw new Error(task.error ?? '本地模拟任务失败');
    ui.taskId = task.id;
  }

  async function handleAction(button) {
    const action = button.dataset.action;
    const data = getData();

    if (action === 'close') return close();
    if (action === 'navigate') {
      const next = button.dataset.section;
      if (next !== ui.section) resetWorkflow();
      ui.section = next;
      return render();
    }
    if (action === 'open-building') {
      await store.setCurrentBuilding(button.dataset.buildingId);
      resetWorkflow();
      ui.section = 'building';
      return render();
    }
    if (action === 'open-takeover') {
      resetWorkflow();
      ui.targetBuildingId = button.dataset.buildingId;
      ui.section = 'takeover';
      return render();
    }
    if (action === 'select-space') {
      ui.selectedSpaceId = button.dataset.spaceId;
      resetWorkflow({ keepSpace: true });
      ui.section = 'renovation';
      return render();
    }
    if (action === 'explore-next') {
      if (!perception) throw new Error('逐步感知服务尚未加载');
      return withBusy(async () => {
        const result = await perception.exploreNext(data.current.id);
        setNotice(
          result.complete ? '这栋建筑的当前结构已全部掌握。' : `对「${result.target.name}」的了解提升到 ${result.target.awareness}%。`,
          'success',
        );
      });
    }
    if (action === 'choose-workflow-space' || action === 'choose-recruit-space') {
      const changed = ui.selectedSpaceId !== button.dataset.spaceId;
      ui.selectedSpaceId = button.dataset.spaceId;
      if (changed && action === 'choose-workflow-space') {
        ui.taskId = null;
        ui.selectedOptionId = null;
      }
      return render();
    }
    if (action === 'choose-option') {
      ui.selectedOptionId = button.dataset.optionId;
      return render();
    }
    if (action === 'set-task-mode') {
      const mode = button.dataset.mode;
      return withBusy(async () => {
        if (mode === 'local') {
          tasks.setMode('local');
          await store.setRunMode('模拟');
          setNotice('已切换到本地模拟；不会调用真实 AI。', 'success');
          return;
        }
        await store.setRunMode('真实');
        try {
          tasks.setMode('ai');
          setNotice('已启用 AI 结构化生成；所有结果仍需要你确认后才会写入。', 'success');
        } catch (error) {
          await store.setRunMode('模拟');
          tasks.setMode('local');
          throw error;
        }
      });
    }
    if (action === 'cancel-task') {
      tasks.cancel(button.dataset.taskId);
      setNotice('任务已取消，未写入任何经营状态。', 'info');
      return render();
    }
    if (action === 'retry-task') {
      return withBusy(async () => {
        const task = await tasks.retry(button.dataset.taskId);
        if (task.status === 'failed') throw new Error(task.error ?? '任务重试失败');
        setNotice('任务重试完成，请返回对应经营流程查看新预览。', 'success');
      });
    }
    if (action === 'consume-link' || action === 'ignore-link') {
      if (!events) throw new Error('联动事件服务尚未加载');
      return withBusy(async () => {
        if (action === 'consume-link') await events.consume(button.dataset.linkId);
        else await events.ignore(button.dataset.linkId);
        setNotice(action === 'consume-link' ? '该联动已标记为已读取。' : '该联动已忽略。', 'success');
      });
    }
    if (action === 'dispatch-link') {
      if (!bridges) throw new Error('联动投递桥尚未加载');
      return withBusy(async () => {
        const dispatched = await bridges.dispatch(button.dataset.linkId, { confirmed: true });
        setNotice(`草稿已投递到${dispatched.draft.channel}频道。`, 'success');
      });
    }
    if (action === 'dispatch-next-link') {
      if (!bridges) throw new Error('联动投递桥尚未加载');
      const channel = button.dataset.channel;
      const next = data.linkCenter.pending.find(item => item.频道 === channel);
      if (!next) throw new Error(`${channel}频道没有待投递草稿`);
      return withBusy(async () => {
        await bridges.dispatch(next.id, { confirmed: true });
        setNotice(`已将下一条草稿投递到${channel}频道。`, 'success');
      });
    }
    if (action === 'run-takeover') {
      return withBusy(() => runTask('takeover', { building: data.targetBuilding }));
    }
    if (action === 'run-renovation') {
      const space = data.current.floors.flatMap(floor => floor.spaces).find(item => item.id === ui.selectedSpaceId);
      if (!space) throw new Error('请选择装修空间');
      return withBusy(() => runTask('renovation', { building: data.current, space }));
    }
    if (action === 'run-recruitment') {
      return withBusy(() => runTask('recruitment', { building: data.current }));
    }
    if (action === 'confirm-takeover') {
      return withBusy(async () => {
        const task = tasks.get(ui.taskId);
        const direction = task?.preview?.directions.find(item => item.id === ui.selectedOptionId);
        if (!direction) throw new Error('请选择接管方向');
        await tasks.confirm(task.id, () => store.acquireBuilding(data.targetBuilding.id, direction));
        ui.targetBuildingId = null;
        resetWorkflow();
        ui.section = 'building';
        setNotice('建筑已经进入你的经营版图', 'success');
      });
    }
    if (action === 'confirm-renovation') {
      return withBusy(async () => {
        const task = tasks.get(ui.taskId);
        const plan = task?.preview?.plans.find(item => item.id === ui.selectedOptionId);
        if (!plan || !ui.selectedSpaceId) throw new Error('请选择装修方案');
        await tasks.confirm(task.id, () =>
          store.applyRenovation({ buildingId: data.current.id, spaceId: ui.selectedSpaceId, plan }),
        );
        resetWorkflow();
        setNotice('装修已经具现化并写入建筑状态', 'success');
      });
    }
    if (action === 'confirm-recruitment') {
      return withBusy(async () => {
        const task = tasks.get(ui.taskId);
        const candidate = task?.preview?.candidates.find(item => item.id === ui.selectedOptionId);
        if (!candidate || !ui.selectedSpaceId) throw new Error('请选择候选人和安置空间');
        await tasks.confirm(task.id, () =>
          store.recruit({ buildingId: data.current.id, spaceId: ui.selectedSpaceId, candidate }),
        );
        resetWorkflow();
        setNotice(`${candidate.name}已经正式加入${data.current.name}`, 'success');
      });
    }
  }

  function onClick(event) {
    if (event.target === event.currentTarget.querySelector('.lmo-backdrop')) return close();
    const button = event.target.closest('[data-action]');
    if (!button || button.dataset.action === 'close-backdrop') return;
    void handleAction(button);
  }

  function onKeyDown(event) {
    if (visible && event.key === 'Escape') close();
  }

  async function open() {
    if (disposed) return;
    await store.ensureInitialized();
    visible = true;
    root.hidden = false;
    render();
  }

  function close() {
    visible = false;
    if (root) {
      root.hidden = true;
      root.innerHTML = '';
    }
  }

  root = document.createElement('div');
  root.id = 'landlord-console-root';
  root.hidden = true;
  root.addEventListener('click', onClick);
  document.body.appendChild(root);
  document.addEventListener('keydown', onKeyDown);
  const unsubscribeStore = store.subscribe(() => render());
  const unsubscribeTasks = tasks.subscribe(() => render());

  return Object.freeze({
    open,
    close,
    render,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeStore();
      unsubscribeTasks();
      document.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('click', onClick);
      root.remove();
      root = null;
    },
  });
}

function detectTheme(document) {
  const classes = `${document.documentElement?.className ?? ''} ${document.body?.className ?? ''}`.toLowerCase();
  if (classes.includes('dark')) return 'dark';
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
