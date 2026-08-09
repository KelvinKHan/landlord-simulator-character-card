import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRelationshipAction } from '../scripts/src/ui/console/relationship-actions.js';

function createHarness() {
  const spark = { id: 'spark_ui', title: '林夏与邵青的关系火花', recorded: false };
  const scene = { id: 'scene_ui', title: '林夏与邵青的常识交换夜', recorded: false };
  const calls = [];
  const ui = { selectedRelationshipSparkId: null, selectedRelationshipSceneId: null };
  return {
    spark,
    scene,
    calls,
    ui,
    args: {
      data: { relationshipCenter: { sparks: [spark], scenes: [scene] } },
      ui,
      store: {
        confirmRelationshipSpark: async value => calls.push(['spark', value.id]),
        activateRelationshipScene: async value => calls.push(['scene', value.id]),
      },
      render: () => calls.push(['render']),
      withBusy: work => work(),
      recordOperation: async (kind, label, work) => {
        calls.push(['operation', kind, label]);
        return work();
      },
      setNotice: (message, type) => calls.push(['notice', message, type]),
    },
  };
}

test('关系界面选择火花和双人场景时只更新本地界面状态', () => {
  const harness = createHarness();
  handleRelationshipAction({ ...harness.args, action: 'choose-relationship-spark', button: { dataset: { sparkId: harness.spark.id } } });
  handleRelationshipAction({ ...harness.args, action: 'choose-relationship-scene', button: { dataset: { sceneId: harness.scene.id } } });
  assert.equal(harness.ui.selectedRelationshipSparkId, harness.spark.id);
  assert.equal(harness.ui.selectedRelationshipSceneId, harness.scene.id);
  assert.deepEqual(harness.calls, [['render'], ['render']]);
});

test('导演台确认按钮通过操作回溯边界启动双人生活场景', async () => {
  const harness = createHarness();
  harness.ui.selectedRelationshipSceneId = harness.scene.id;
  await handleRelationshipAction({ ...harness.args, action: 'confirm-relationship-scene', button: { dataset: {} } });
  assert.deepEqual(harness.calls[0], ['operation', 'relationship-scene', `启动${harness.scene.title}`]);
  assert.deepEqual(harness.calls[1], ['scene', harness.scene.id]);
  assert.equal(harness.ui.selectedRelationshipSceneId, null);
  assert.equal(harness.calls.at(-1)[0], 'notice');
  assert.equal(harness.calls.at(-1)[2], 'success');
});
