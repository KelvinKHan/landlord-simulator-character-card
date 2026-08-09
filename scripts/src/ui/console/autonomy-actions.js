export function handleAutonomyAction({ action, button, data, ui, store, render, withBusy, recordOperation, setNotice }) {
  if (action === 'choose-autonomy-proposal') {
    ui.selectedAutonomyProposalId = button.dataset.proposalId;
    return render();
  }
  if (action === 'confirm-autonomy-proposal') {
    const proposal = data.autonomyCenter.proposals.find(item => item.id === ui.selectedAutonomyProposalId);
    if (!proposal) throw new Error('请选择一条仍然有效的租客自主行动');
    return withBusy(async () => {
      await recordOperation('autonomy', `批准${proposal.person.name}前往${proposal.destination.name}`, () => store.movePerson({
        personId: proposal.personId,
        buildingId: proposal.buildingId,
        spaceId: proposal.destination.id,
        activity: proposal.activity,
        expectedFrom: proposal.expectedFrom,
      }));
      ui.selectedAutonomyProposalId = null;
      setNotice(`${proposal.person.name}已经开始自己的生活行动；人物位置与空间占用已同步。`, 'success');
    });
  }
  throw new Error(`未知自主行动：${action}`);
}
