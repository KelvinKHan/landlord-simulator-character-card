const separatorPattern = /^[-—─━=*~_]{2,}$/;
const shortTimestampPattern = /^[\[【(]?\d{1,2}:\d{2}[\]】)]?\s*/;
const longTimestampPattern = /^[\[【]?\d{4}[-/]\d{1,2}[-/]\d{1,2}\s*\d{1,2}:\d{2}[\]】]?\s*/;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function meaningfulLines(response) {
  return String(response ?? '')
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !separatorPattern.test(line));
}

export function formatTenantInfo(tenantName, info) {
  let text = `【${tenantName}】\n`;
  if (info.mvuData) {
    const data = info.mvuData;
    text += `年龄: ${data.年龄 || '未知'}\n`;
    text += `职业: ${data.职业 || '未知'}\n`;
    text += `性格: ${data.性格 || '未知'}\n`;
    text += `状态: ${data.状态 || '正常'}\n`;
    text += `内心: ${data.内心 || '未知'}\n`;
    if (data.关系) {
      text += `关系: ${Object.entries(data.关系)
        .map(([name, relation]) => `${name}:${relation}`)
        .join(', ')}\n`;
    }
  }
  if (info.baseProfile) text += `\n本色档案:\n${info.baseProfile}\n`;
  if (info.dynamicProfile) text += `\n当前状态:\n${info.dynamicProfile}\n`;
  return text;
}

export function formatChatHistory(messages) {
  if (!messages?.length) return '';
  return messages
    .map(message => {
      const sender = message.sender === '<user>' ? '房东' : message.sender;
      const time = message.gameTime ? `[${message.gameTime.时间}]` : '';
      return `${time} ${sender}: ${message.content}`;
    })
    .join('\n');
}

export function cleanMessageContent(content, expectedSender = null) {
  if (!content) return '';
  let cleaned = String(content).replace(shortTimestampPattern, '').replace(longTimestampPattern, '');
  if (expectedSender) {
    cleaned = cleaned.replace(new RegExp(`^${escapeRegExp(expectedSender)}\\s*[:：]\\s*`, 'i'), '');
  }
  return cleaned.replace(/^[\[【(][^\]】)]*[\]】)]\s*/, '').trim();
}

export function parseGroupReply(response, validMembers) {
  const replies = [];
  for (const line of meaningfulLines(response)) {
    const cleaned = line.replace(shortTimestampPattern, '').replace(longTimestampPattern, '');
    const match = cleaned.match(/^(.+?)[:：]\s*(.+)$/);
    if (!match) continue;
    const sender = match[1].trim();
    const content = match[2].trim();
    if (validMembers.includes(sender) && content) replies.push({ sender, content });
  }
  if (replies.length === 0 && String(response ?? '').trim()) {
    replies.push({ sender: validMembers[0] || '未知', content: String(response).trim().slice(0, 200) });
  }
  return replies;
}

export function parsePrivateReply(response, tenantName) {
  const replies = meaningfulLines(response)
    .map(line => cleanMessageContent(line, tenantName))
    .filter(Boolean);
  if (replies.length > 0) return replies;
  const fallback = String(response ?? '').trim();
  return fallback ? [fallback] : [];
}

export function applyBasicPromptFilter(text) {
  return String(text ?? '')
    .replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/g, '')
    .replace(/<Analysis>[\s\S]*?<\/Analysis>/g, '')
    .replace(/<JSONPatch>[\s\S]*?<\/JSONPatch>/g, '')
    .trim();
}
