import { renderConsole } from './templates.js';

function owned(building) {
  return building && ['总部', '已接管'].includes(building.status);
}

export function createLandlordConsole({ document, store, tasks, compiler, logger }) {
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
    return { state, portfolio, current, targetBuilding };
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
