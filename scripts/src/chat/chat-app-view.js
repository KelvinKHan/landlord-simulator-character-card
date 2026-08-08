const ICON_BASE = 'https://api.iconify.design/';

export const CHAT_APP_DEFINITION = Object.freeze({
  id: 'tenant_chat',
  name: 'WeChat',
  icon: `<img src="${ICON_BASE}ri:wechat-fill.svg?color=white" style="width:70%;height:70%">`,
  color: '#07c160',
  order: 2,
});

export const DEFAULT_GROUP_NAME = '公寓业主群';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderAppShell() {
  return `
    <div class="chat-app" id="chat-app-container">
      <div class="chat-list-view" id="chat-list-view">
        <div class="chat-list-header">
          <button class="chat-list-back-btn" id="btn-go-home" title="返回"><img src="${ICON_BASE}ri:arrow-left-s-line.svg"></button>
          <span class="chat-list-title">微信</span>
          <div class="chat-list-actions">
            <button class="chat-list-btn" id="btn-new-chat" title="发起私聊"><img src="${ICON_BASE}ri:add-line.svg"></button>
            <button class="chat-list-btn" id="btn-chat-settings" title="设置"><img src="${ICON_BASE}ri:settings-3-line.svg"></button>
          </div>
        </div>
        <div class="chat-list" id="chat-list"></div>
      </div>
    </div>`;
}

export function renderChatRoom(conversation) {
  const isGroup = conversation.type === 'group';
  return `
    <div class="chat-room-view" id="chat-room-view">
      <div class="chat-room-header">
        <button class="chat-back-btn" id="btn-back-to-list"><img src="${ICON_BASE}ri:arrow-left-s-line.svg"></button>
        <span class="chat-room-title">${escapeHtml(conversation.name)}</span>
        ${isGroup ? `<span class="chat-room-info">(${conversation.members?.length ?? 0})</span>` : ''}
        <div style="width:32px"></div>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="typing-indicator" id="typing-indicator">
        <div class="typing-dots"><span></span><span></span><span></span></div><span style="margin-left:8px">正在输入...</span>
      </div>
      <div class="sticker-picker-panel" id="sticker-picker-panel">
        <div class="sticker-picker-grid" id="sticker-picker-grid"><div class="sticker-picker-empty">加载中...</div></div>
      </div>
      <div class="chat-input-area">
        <div style="font-size:24px;color:#7f8389;display:flex;align-items:center;padding-bottom:10px"><img src="${ICON_BASE}ri:mic-line.svg" style="width:24px"></div>
        <textarea class="chat-input" id="chat-input" rows="1"></textarea>
        <div id="btn-sticker-toggle" style="font-size:24px;color:#7f8389;display:flex;align-items:center;padding-bottom:10px;cursor:pointer" title="表情包"><img src="${ICON_BASE}ri:emotion-line.svg" style="width:24px"></div>
        <button class="chat-send-btn" id="btn-send">发送</button>
      </div>
    </div>`;
}

export function renderSettings(stats) {
  return `
    <div class="chat-settings-panel" id="chat-settings-panel">
      <div class="settings-header"><button class="settings-back-btn" id="btn-settings-back"><img src="${ICON_BASE}ri:arrow-left-s-line.svg"></button><span class="settings-title">设置</span></div>
      <div class="settings-content">
        <div class="settings-section">
          <div class="settings-item"><span class="settings-item-label">总会话数</span><span class="settings-item-value">${stats.conversationCount}</span></div>
          <div class="settings-item"><span class="settings-item-label">总消息数</span><span class="settings-item-value">${stats.messageCount}</span></div>
        </div>
        <div class="settings-section">
          <button class="settings-btn" id="btn-export-data">导出聊天记录</button>
          <button class="settings-btn" id="btn-import-data">导入聊天记录</button>
          <button class="settings-btn" id="btn-sync-members">同步群成员</button>
        </div>
        <div class="settings-section"><button class="settings-btn danger" id="btn-clear-data">清空所有聊天记录</button></div>
      </div>
    </div>`;
}

export function renderTenantSelector(tenants, conversations) {
  const existing = new Set(
    conversations.filter(conversation => conversation.type === 'private').map(conversation => conversation.members[0]),
  );
  const available = tenants.filter(name => !existing.has(name));
  const list = available.length
    ? available
        .map(
          name => `<div class="tenant-item" data-name="${escapeHtml(name)}">
            <div class="tenant-item-avatar"><img src="${ICON_BASE}ri:user-3-line.svg?color=gray"></div>
            <div class="tenant-item-info"><div class="tenant-item-name">${escapeHtml(name)}</div></div>
          </div>`,
        )
        .join('')
    : `<div class="empty-state"><img src="${ICON_BASE}ri:chat-check-line.svg"><div class="empty-state-text">所有租客都已有私聊会话</div></div>`;
  return `
    <div class="tenant-selector" id="tenant-selector">
      <div class="settings-header"><button class="settings-back-btn" id="btn-selector-back"><img src="${ICON_BASE}ri:arrow-left-s-line.svg"></button><span class="settings-title">选择联系人</span></div>
      <div class="tenant-list">${list}</div>
    </div>`;
}

export function renderMessage(message, isGroupChat, userAvatar = null) {
  const isSelf = message.sender === '<user>';
  const senderName = isSelf ? '我' : message.sender;
  const avatar = isSelf
    ? userAvatar || `${ICON_BASE}ri:user-star-fill.svg?color=%2307c160`
    : `${ICON_BASE}ri:user-3-fill.svg?color=%23999`;
  const isSticker =
    message.stickerImage &&
    (message.content.startsWith('[表情包：') || message.content.startsWith('[sticker:'));
  const bubble = isSticker
    ? `<div class="msg-bubble sticker-bubble"><img src="${escapeHtml(message.stickerImage)}" alt="表情包"></div>`
    : `<div class="msg-bubble">${escapeHtml(message.content)}</div>`;
  return `
    <div class="chat-message ${isSelf ? 'self' : 'other'}" data-id="${escapeHtml(message.id)}">
      <div class="msg-avatar"><img src="${escapeHtml(avatar)}"></div>
      <div class="msg-content-wrap">
        ${!isSelf && isGroupChat ? `<div class="msg-sender">${escapeHtml(senderName)}</div>` : ''}
        ${bubble}
        <div class="msg-time">${escapeHtml(message.gameTime?.时间 || '')}</div>
        <button class="msg-retract-btn" data-msg-id="${escapeHtml(message.id)}" title="撤回消息"><img src="${ICON_BASE}ri:delete-back-2-line.svg?color=%23666666"></button>
      </div>
    </div>`;
}

export function renderConversationItem(conversation) {
  const isGroup = conversation.type === 'group';
  const lastMessage = conversation.lastMessage;
  let content = lastMessage?.content ?? '';
  if (content.startsWith('[sticker:') || content.startsWith('[表情包：')) content = '[表情包]';
  const preview = lastMessage
    ? `${lastMessage.sender === '<user>' ? '我' : lastMessage.sender}: ${content}`.slice(0, 30)
    : '暂无消息';
  return `
    <div class="chat-list-item" data-conv-id="${escapeHtml(conversation.id)}">
      <div class="chat-item-avatar" style="background:${isGroup ? '#07c160' : '#ddd'}"><img src="${ICON_BASE}${
        isGroup ? 'ri:group-fill' : 'ri:user-3-fill'
      }.svg?color=white"></div>
      <div class="chat-item-content">
        <div class="chat-item-top"><div class="chat-item-name">${escapeHtml(conversation.name)}</div><div class="chat-item-time">${escapeHtml(lastMessage?.gameTime?.时间 || '')}</div></div>
        <div class="chat-item-preview">${escapeHtml(preview)}</div>
      </div>
    </div>`;
}

export function renderStickerGrid(stickers) {
  if (stickers.length === 0) {
    return `<div class="sticker-picker-empty"><img src="${ICON_BASE}ri:emotion-sad-line.svg">还没有表情包<br>请在创意工坊中添加</div>`;
  }
  return stickers
    .map(
      sticker => `<button class="sticker-picker-item" data-sticker-id="${escapeHtml(sticker.id)}" title="${escapeHtml(
        sticker.name || '',
      )}"><img src="${escapeHtml(sticker.imageData || '')}" alt="${escapeHtml(sticker.name || '')}"></button>`,
    )
    .join('');
}
