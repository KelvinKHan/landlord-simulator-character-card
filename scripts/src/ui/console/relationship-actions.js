export function handleRelationshipAction({ action, button, data, ui, store, render, withBusy, recordOperation, setNotice }) {
  if (action === 'choose-relationship-spark') {
    ui.selectedRelationshipSparkId = button.dataset.sparkId;
    return render();
  }
  if (action === 'confirm-relationship-spark') {
    const spark = data.relationshipCenter.sparks.find(item => item.id === ui.selectedRelationshipSparkId);
    if (!spark || spark.recorded) throw new Error('请选择一条尚未记录的关系火花');
    return withBusy(async () => {
      await recordOperation('relationship', `记录${spark.title}`, () => store.confirmRelationshipSpark(spark));
      ui.selectedRelationshipSparkId = null;
      setNotice('这次关系火花已经双向写入人物关系，并生成正文、微信和建筑草稿。', 'success');
    });
  }
  if (action === 'choose-relationship-scene') {
    ui.selectedRelationshipSceneId = button.dataset.sceneId;
    return render();
  }
  if (action === 'confirm-relationship-scene') {
    const scene = data.relationshipCenter.scenes.find(item => item.id === ui.selectedRelationshipSceneId);
    if (!scene || scene.recorded) throw new Error('请选择一个尚未启动的双人生活场景');
    return withBusy(async () => {
      await recordOperation('relationship-scene', `启动${scene.title}`, () => store.activateRelationshipScene(scene));
      ui.selectedRelationshipSceneId = null;
      setNotice('双人生活场景已经启动：双方位置、状态和三类联动草稿已同步。', 'success');
    });
  }
  throw new Error(`未知关系操作：${action}`);
}
