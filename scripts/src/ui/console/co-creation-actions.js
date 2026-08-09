import { compileCoCreationProjects } from '../../tenants/co-creation-engine.js';

export function handleCoCreationAction({ action, button, ui, store, tasks, render, runTask, withBusy, recordOperation, setNotice }) {
  if (action === 'run-co-creation') {
    const project = compileCoCreationProjects(store.getState()).projects.find(item => item.id === button.dataset.projectId && !item.recorded);
    if (!project) throw new Error('这次人物共创已经失效，请重新锁定生活交汇');
    ui.selectedCoCreationProjectId = project.id;
    ui.selectedCoCreationPlanId = null;
    const state = store.getState();
    const building = state.建筑列表[project.buildingId];
    const space = building?.空间列表?.[project.spaceId];
    return withBusy(() => runTask('coCreation', { project, building, space }));
  }
  if (action === 'choose-co-creation-plan') {
    ui.selectedCoCreationProjectId = button.dataset.projectId;
    ui.selectedCoCreationPlanId = button.dataset.planId;
    return render();
  }
  if (action === 'confirm-co-creation') {
    const project = compileCoCreationProjects(store.getState()).projects.find(item => item.id === ui.selectedCoCreationProjectId && !item.recorded);
    const task = ui.taskId ? tasks.get(ui.taskId) : null;
    const plan = task?.kind === 'coCreation' && task.preview?.projectId === project?.id
      ? task.preview.plans.find(item => item.id === ui.selectedCoCreationPlanId)
      : null;
    if (!project || !plan) throw new Error('请选择一份仍然有效的共创装修方案');
    return withBusy(async () => {
      await tasks.confirm(task.id, () => recordOperation(
        'co-creation',
        `共创装修${project.spaceName}`,
        () => store.applyCoCreationRenovation({ project, plan }),
      ));
      ui.selectedCoCreationProjectId = null;
      ui.selectedCoCreationPlanId = null;
      ui.taskId = null;
      setNotice('共创装修已具现：人物碰撞、房间变化和三频道草稿已经同步。', 'success');
    });
  }
  throw new Error(`未知共创装修操作：${action}`);
}
