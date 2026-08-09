import { renderConsole } from './templates.js';

function owned(building) {
  return building && ['总部', '已接管'].includes(building.status);
}

export function createLandlordConsole({ document, store, tasks, events = null, history = null, spatialSync = null, narrativeIntents = null, embodiment = null, perception = null, identities = null, layouts = null, operations = null, bridges = null, compiler, logger }) {
  let root = null;
  let visible = false;
  let disposed = false;
  const ui = {
    section: 'portfolio',
    targetBuildingId: null,
    selectedSpaceId: null,
    focusedFloorId: null,
    twinSpaceId: null,
    twinLayer: 'layout',
    selectedPulseSceneId: null,
    selectedReactionId: null,
    previewLinkIds: [],
    selectedMovePersonId: null,
    selectedMoveSpaceId: null,
    lastNarrativeExtraction: null,
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
      ? (() => {
          const pending = events.list({ status: '待分发', limit: 20 });
          const pendingIds = new Set(pending.map(item => item.id));
          const previewIds = ui.previewLinkIds.filter(id => pendingIds.has(id));
          const previewDrafts = bridges ? previewIds.map(id => bridges.draft(id)) : [];
          return { counts: events.counts(), pending, capabilities: bridges?.capabilities() ?? {}, previewDrafts };
        })()
      : { counts: { 正文: 0, 微信: 0, 新闻: 0, 建筑: 0 }, pending: [], capabilities: {}, previewDrafts: [] };
    const identityCenter = { residents: identities?.listForBuilding(current.id) ?? [] };
    const twin = layouts?.compile(current) ?? { buildingId: current.id, name: current.name, theme: current.theme, floors: [], metrics: { floors: 0, nodes: 0, edges: 0 } };
    const pulse = operations?.compile(state, current.id) ?? { buildingId: current.id, buildingName: current.name, signature: 'pulse_unavailable', total: 0, state: '尚未加载', metrics: { comfort: 0, function: 0, vitality: 0, appeal: 0 }, spaces: [], synergies: [], scenes: [], residentCount: 0, originCount: 0 };
    const tenantLife = embodiment?.compile(state, current.id) ?? { buildingId: current.id, buildingName: current.name, signature: 'embodied_unavailable', residents: [], encounters: [] };
    const historyCenter = history
      ? { ...history.summary(), entries: history.list({ limit: 20 }) }
      : { busy: false, count: 0, appliedCount: 0, canUndo: false, canRedo: false, undoLabel: '', redoLabel: '', blockedUndo: false, entries: [] };
    const spatialCenter = {
      people: Object.entries(state.人物列表 ?? {}).map(([id, person]) => {
        const building = portfolio.buildings.find(item => item.id === person.所在建筑ID);
        const space = building?.floors.flatMap(floor => floor.spaces).find(item => item.id === person.所在空间ID);
        return { id, name: person.姓名, status: person.状态, buildingName: building?.name ?? person.所在建筑ID, spaceName: space?.name ?? person.所在空间ID, color: person.视觉身份?.主色 };
      }),
      spaces: current.floors.flatMap(floor => floor.spaces).map(space => ({ ...space, floorName: current.floors.find(floor => floor.spaces.some(item => item.id === space.id))?.name ?? '' })),
      proposals: spatialSync?.list({ limit: 20 }) ?? [],
      counts: spatialSync?.counts() ?? { 待确认: 0, 冲突: 0, 已应用: 0, 已忽略: 0, 写入中: 0 },
      narrativeMode: state.运行模式 === '真实' ? 'ai' : 'local',
      narrativeCapabilities: narrativeIntents?.capabilities() ?? { local: true, ai: false },
    };
    return { state, portfolio, current, targetBuilding, taskCenter, linkCenter, identityCenter, historyCenter, spatialCenter, tenantLife, pulse, twin };
  }

  function resetWorkflow({ keepSpace = false } = {}) {
    ui.taskId = null;
    ui.selectedOptionId = null;
    if (!keepSpace) ui.selectedSpaceId = null;
    ui.notice = null;
  }

  function resetTwin() {
    ui.focusedFloorId = null;
    ui.twinSpaceId = null;
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

  function recordOperation(kind, label, action) {
    return history ? history.perform({ kind, label }, action) : action();
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
      resetTwin();
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
    if (action === 'focus-twin-floor') {
      ui.focusedFloorId = button.dataset.floorId;
      ui.twinSpaceId = data.twin.floors.find(floor => floor.id === ui.focusedFloorId)?.nodes[0]?.id ?? null;
      return render();
    }
    if (action === 'inspect-twin-space') {
      ui.focusedFloorId = button.dataset.floorId;
      ui.twinSpaceId = button.dataset.spaceId;
      return render();
    }
    if (action === 'set-twin-layer') {
      const layer = button.dataset.layer;
      if (!['layout', 'pulse', 'tenants'].includes(layer)) throw new Error(`未知数字孪生图层：${layer}`);
      ui.twinLayer = layer;
      return render();
    }
    if (action === 'choose-pulse-scene') {
      ui.selectedPulseSceneId = button.dataset.sceneId;
      return render();
    }
    if (action === 'confirm-pulse-scene') {
      const scene = data.pulse.scenes.find(item => item.id === ui.selectedPulseSceneId);
      if (!scene || scene.activated) throw new Error('请选择一个尚未点亮的建筑场景');
      return withBusy(async () => {
        await recordOperation('scene', `点亮${scene.title}`, () => store.activateBuildingScene({ buildingId: data.current.id, scene }));
        ui.selectedPulseSceneId = null;
        setNotice('场景已经写入建筑记忆，人物状态与四频道草稿同步更新。', 'success');
      });
    }
    if (action === 'choose-tenant-reaction') {
      ui.selectedReactionId = button.dataset.reactionId;
      return render();
    }
    if (action === 'confirm-tenant-reaction') {
      const reaction = data.tenantLife.residents.find(item => item.id === ui.selectedReactionId);
      if (!reaction || reaction.recorded) throw new Error('请选择一份尚未记录的人物感受');
      return withBusy(async () => {
        await recordOperation('reaction', `记录${reaction.name}的空间感受`, () => store.recordTenantReaction({ personId: reaction.personId, reaction }));
        ui.selectedReactionId = null;
        setNotice('这份感受已经进入人物状态，并生成正文、微信和建筑草稿。', 'success');
      });
    }
    if (action === 'undo-operation' || action === 'redo-operation') {
      if (!history) throw new Error('经营回溯服务尚未加载');
      return withBusy(async () => {
        const entry = action === 'undo-operation' ? await history.undo() : await history.redo();
        resetWorkflow();
        resetTwin();
        setNotice(`${action === 'undo-operation' ? '已撤销' : '已重做'}：${entry.label}`, 'success');
      });
    }
    if (action === 'choose-spatial-person') {
      ui.selectedMovePersonId = button.dataset.personId;
      return render();
    }
    if (action === 'extract-narrative-intents') {
      if (!narrativeIntents || !spatialSync) throw new Error('剧情空间提取服务尚未加载');
      const text = root.querySelector('#lmo-narrative-fragment')?.value?.trim();
      if (!text) throw new Error('请先粘贴一段需要解析的剧情文字');
      return withBusy(async () => {
        const result = await narrativeIntents.extract(text, { mode: data.spatialCenter.narrativeMode });
        if (!result.intents.length) throw new Error(result.unresolved.length ? `没有形成可确认移动：${result.unresolved[0]}` : '没有识别到人物移动');
        spatialSync.propose(result.intents, { source: `narrative-${result.mode}` });
        ui.lastNarrativeExtraction = { mode: result.mode, count: result.intents.length, unresolved: result.unresolved.length };
        setNotice(`已提取 ${result.intents.length} 条移动意图；仍需逐条确认后才会改动人物位置。`, 'success');
      });
    }
    if (action === 'choose-spatial-space') {
      ui.selectedMoveSpaceId = button.dataset.spaceId;
      return render();
    }
    if (action === 'propose-spatial-move') {
      if (!spatialSync) throw new Error('空间同步服务尚未加载');
      if (!ui.selectedMovePersonId || !ui.selectedMoveSpaceId) throw new Error('请选择人物和目标空间');
      const activity = root.querySelector('#lmo-spatial-activity')?.value?.trim() || '适应新环境';
      spatialSync.propose([{
        personId: ui.selectedMovePersonId,
        buildingId: data.current.id,
        spaceId: ui.selectedMoveSpaceId,
        activity,
      }], { source: 'manual-preview' });
      setNotice('移动意图已经过建筑结构校验，请检查路线后确认。', 'success');
      return render();
    }
    if (action === 'confirm-spatial-proposal') {
      if (!spatialSync) throw new Error('空间同步服务尚未加载');
      const proposal = spatialSync.get(button.dataset.proposalId);
      if (!proposal) throw new Error('空间同步提案不存在');
      return withBusy(async () => {
        await recordOperation(
          'movement',
          `移动${proposal.route.personName ?? '人物'}到${proposal.route.destinationName ?? '目标空间'}`,
          () => spatialSync.confirm(proposal.id),
        );
        setNotice('人物位置与建筑占用记录已经同步。', 'success');
      });
    }
    if (action === 'ignore-spatial-proposal') {
      if (!spatialSync) throw new Error('空间同步服务尚未加载');
      spatialSync.ignore(button.dataset.proposalId);
      setNotice('该移动意图已忽略，没有改动人物位置。', 'info');
      return render();
    }
    if (action === 'explore-next') {
      if (!perception) throw new Error('逐步感知服务尚未加载');
      return withBusy(async () => {
        const result = await recordOperation(
          'exploration',
          `探索${data.current.name}`,
          () => perception.exploreNext(data.current.id),
        );
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
        ui.previewLinkIds = ui.previewLinkIds.filter(id => id !== button.dataset.linkId);
        setNotice(action === 'consume-link' ? '该联动已标记为已读取。' : '该联动已忽略。', 'success');
      });
    }
    if (action === 'preview-link') {
      ui.previewLinkIds = [button.dataset.linkId];
      return render();
    }
    if (action === 'preview-channel-links') {
      ui.previewLinkIds = data.linkCenter.pending
        .filter(item => item.频道 === button.dataset.channel)
        .slice(0, 5)
        .map(item => item.id);
      return render();
    }
    if (action === 'clear-link-preview') {
      ui.previewLinkIds = [];
      return render();
    }
    if (action === 'dispatch-preview-links') {
      if (!bridges) throw new Error('联动投递桥尚未加载');
      const ids = data.linkCenter.previewDrafts.map(item => item.deliveryId);
      return withBusy(async () => {
        const result = await bridges.dispatchMany(ids, { confirmed: true });
        ui.previewLinkIds = [];
        setNotice(
          result.failed
            ? `已投递 ${result.successful} 条，${result.failed} 条失败并保留在队列中。`
            : `已确认投递 ${result.successful} 条联动草稿。`,
          result.failed ? 'error' : 'success',
        );
      });
    }
    if (action === 'dispatch-link') {
      if (!bridges) throw new Error('联动投递桥尚未加载');
      return withBusy(async () => {
        const dispatched = await bridges.dispatch(button.dataset.linkId, { confirmed: true });
        ui.previewLinkIds = ui.previewLinkIds.filter(id => id !== button.dataset.linkId);
        setNotice(`草稿已投递到${dispatched.draft.channel}频道。`, 'success');
      });
    }
    if (action === 'preview-next-link') {
      if (!bridges) throw new Error('联动投递桥尚未加载');
      const channel = button.dataset.channel;
      const next = data.linkCenter.pending.find(item => item.频道 === channel);
      if (!next) throw new Error(`${channel}频道没有待投递草稿`);
      ui.previewLinkIds = [next.id];
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
        await tasks.confirm(task.id, () => recordOperation(
          'takeover',
          `接管${data.targetBuilding.name}`,
          () => store.acquireBuilding(data.targetBuilding.id, direction),
        ));
        ui.targetBuildingId = null;
        resetWorkflow();
        resetTwin();
        ui.section = 'building';
        setNotice('建筑已经进入你的经营版图', 'success');
      });
    }
    if (action === 'confirm-renovation') {
      return withBusy(async () => {
        const task = tasks.get(ui.taskId);
        const plan = task?.preview?.plans.find(item => item.id === ui.selectedOptionId);
        if (!plan || !ui.selectedSpaceId) throw new Error('请选择装修方案');
        const space = data.current.floors.flatMap(floor => floor.spaces).find(item => item.id === ui.selectedSpaceId);
        await tasks.confirm(task.id, () => recordOperation(
          'renovation',
          `装修${space?.name ?? '空间'}`,
          () => store.applyRenovation({ buildingId: data.current.id, spaceId: ui.selectedSpaceId, plan }),
        ));
        resetWorkflow();
        setNotice('装修已经具现化并写入建筑状态', 'success');
      });
    }
    if (action === 'confirm-recruitment') {
      return withBusy(async () => {
        const task = tasks.get(ui.taskId);
        const candidate = task?.preview?.candidates.find(item => item.id === ui.selectedOptionId);
        if (!candidate || !ui.selectedSpaceId) throw new Error('请选择候选人和安置空间');
        await tasks.confirm(task.id, () => recordOperation(
          'recruitment',
          `招募${candidate.name}`,
          () => store.recruit({ buildingId: data.current.id, spaceId: ui.selectedSpaceId, candidate }),
        ));
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
  const unsubscribeHistory = history?.subscribe(() => render()) ?? (() => {});
  const unsubscribeSpatial = spatialSync?.subscribe(() => render()) ?? (() => {});

  return Object.freeze({
    open,
    close,
    render,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeStore();
      unsubscribeTasks();
      unsubscribeHistory();
      unsubscribeSpatial();
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
