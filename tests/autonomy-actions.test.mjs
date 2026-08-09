import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAutonomyAction } from '../scripts/src/ui/console/autonomy-actions.js';

function createHarness() {
  const proposal = {
    id: 'autonomy_ui', personId: 'person_linxia', buildingId: 'building_headquarters',
    person: { name: '林夏' }, source: { id: 'room_owner' }, destination: { id: 'living_room', name: '客厅' },
    activity: '采集客厅的光影与生活样本', expectedFrom: { buildingId: 'building_headquarters', spaceId: 'room_owner' },
  };
  const calls = [];
  const ui = { selectedAutonomyProposalId: null };
  return {
    proposal, calls, ui,
    args: {
      data: { autonomyCenter: { proposals: [proposal] } }, ui,
      store: { movePerson: async input => calls.push(['move', input]) },
      render: () => calls.push(['render']),
      withBusy: work => work(),
      recordOperation: async (kind, label, work) => { calls.push(['operation', kind, label]); return work(); },
      setNotice: (message, type) => calls.push(['notice', message, type]),
    },
  };
}

test('选择自主行动时只改变界面选择', () => {
  const harness = createHarness();
  handleAutonomyAction({ ...harness.args, action: 'choose-autonomy-proposal', button: { dataset: { proposalId: harness.proposal.id } } });
  assert.equal(harness.ui.selectedAutonomyProposalId, harness.proposal.id);
  assert.deepEqual(harness.calls, [['render']]);
});

test('批准自主行动通过经营回溯边界同步人物位置', async () => {
  const harness = createHarness();
  harness.ui.selectedAutonomyProposalId = harness.proposal.id;
  await handleAutonomyAction({ ...harness.args, action: 'confirm-autonomy-proposal', button: { dataset: {} } });
  assert.deepEqual(harness.calls[0], ['operation', 'autonomy', '批准林夏前往客厅']);
  assert.equal(harness.calls[1][0], 'move');
  assert.deepEqual(harness.calls[1][1].expectedFrom, harness.proposal.expectedFrom);
  assert.equal(harness.ui.selectedAutonomyProposalId, null);
  assert.equal(harness.calls.at(-1)[2], 'success');
});
