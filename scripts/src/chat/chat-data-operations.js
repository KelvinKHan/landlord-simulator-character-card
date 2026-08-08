export class ChatDataOperations {
  constructor({
    database,
    hostDocument,
    BlobConstructor,
    URLApi,
    alert = () => {},
    confirm = () => false,
    now = () => new Date(),
    groupName = '公寓业主群',
    logger = console,
  }) {
    this.database = database;
    this.hostDocument = hostDocument;
    this.BlobConstructor = BlobConstructor;
    this.URLApi = URLApi;
    this.alert = alert;
    this.confirm = confirm;
    this.now = now;
    this.groupName = groupName;
    this.logger = logger;
  }

  async exportBackup() {
    try {
      const json = await this.database.exportData();
      const blob = new this.BlobConstructor([json], { type: 'application/json' });
      const url = this.URLApi.createObjectURL(blob);
      const anchor = this.hostDocument.createElement('a');
      anchor.href = url;
      anchor.download = `tenant_chat_backup_${this.now().toISOString().slice(0, 10)}.json`;
      anchor.click();
      this.URLApi.revokeObjectURL(url);
      this.alert('导出成功！');
      return true;
    } catch (error) {
      this.logger.error('导出失败', error);
      this.alert(`导出失败: ${error.message}`);
      return false;
    }
  }

  chooseBackupToImport({ onImported = () => {} } = {}) {
    const input = this.hostDocument.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const merge = this.confirm('是否合并数据？\n确定：合并到现有数据\n取消：覆盖现有数据');
        const result = await this.database.importData(await file.text(), { merge });
        this.alert(`导入成功！\n会话: ${result.conversations}\n消息: ${result.messages}`);
        await onImported(result);
      } catch (error) {
        this.logger.error('导入失败', error);
        this.alert(`导入失败: ${error.message}`);
      }
    };
    input.click();
    return input;
  }

  async syncGroupMembers() {
    try {
      const group = (await this.database.getConversations()).find(item => item.type === 'group');
      if (!group) {
        this.alert('未找到群聊');
        return false;
      }
      await this.database.syncGroupMembers(group.id);
      this.alert('群成员已同步！');
      return true;
    } catch (error) {
      this.logger.error('同步群成员失败', error);
      this.alert(`同步失败: ${error.message}`);
      return false;
    }
  }

  async clearAll() {
    if (!this.confirm('确定要清空所有聊天记录吗？此操作不可恢复！')) return false;
    if (!this.confirm('再次确认：真的要删除吗？')) return false;
    try {
      await this.database.clearCurrentChatData();
      await this.database.getOrCreateGroupChat(this.groupName);
      this.alert('已清空所有聊天记录');
      return true;
    } catch (error) {
      this.logger.error('清空失败', error);
      this.alert(`清空失败: ${error.message}`);
      return false;
    }
  }
}
