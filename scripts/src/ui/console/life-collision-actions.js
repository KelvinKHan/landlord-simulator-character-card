import { compileLifeCollisions } from '../../tenants/life-collision-engine.js';

export function handleLifeCollisionAction({ action, button, ui, store, render, withBusy, recordOperation, setNotice }) {
  if (action === 'choose-life-collision') {
    ui.selectedLifeCollisionId = button.dataset.collisionId;
    return render();
  }
  if (action === 'confirm-life-collision') {
    const collision = compileLifeCollisions(store.getState()).collisions.find(item => item.id === ui.selectedLifeCollisionId);
    if (!collision || collision.recorded) throw new Error('请选择一次仍然有效的生活流线交汇');
    return withBusy(async () => {
      await recordOperation('relationship-scene', `锁定${collision.title}`, () => store.activateRelationshipScene(collision.scene));
      ui.selectedLifeCollisionId = null;
      setNotice('这次生活交汇已锁定：双方位置、建筑事件和三频道草稿已同步。', 'success');
    });
  }
  throw new Error(`未知生活交汇操作：${action}`);
}
