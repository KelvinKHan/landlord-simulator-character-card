// 这些标记来自 Z5.20 原卡的真实 HTML/CSS/UI。只有“功能能跑”还不够：
// 任意一项在原源码或最终 bundle 中消失，都应视为视觉迁移失败。
export const visualFidelityContract = Object.freeze({
  'floating-menu': ['floating-menu-manager-styles', '.fmm-main-fab', '.fmm-sub-fab', '@keyframes fmmExpandBall'],
  apartment: ['apartment-plugin-styles', 'apartment-main-panel', 'apartment-canvas', 'build-mode-btn'],
  phone: ['phone-frame.png', '.phone-frame{', '.apps-grid{', 'app-icon-container'],
  'analysis-queue': ['queue-widget', 'queue-widget-toggle', 'queue-widget-content'],
  'chat-app': ['chat-app-container', 'sticker-picker-grid', 'chat-settings-panel', 'chat-message'],
  'tenant-profile': ['profileModal', 'tenantList', 'queuePanel', 'analyzeAllBtn'],
  'prompt-console': ['debug-content', 'debug-filter', 'API TRACE', 'btn-clear-logs'],
  map: ['phone-map-app', 'map-viewport', 'map-travel-confirm', 'map-inner'],
  music: ['full-cover', 'mini-cover', 'queue-panel', 'full-play'],
  'world-map': ['phone-world-map-app', 'worldmap-companion-modal', 'worldmap-search-results', 'worldmap-info-bar'],
  weather: ['linear-gradient(180deg,#4A90D9 0%,#67B8DE 50%,#89CFF0 100%)', 'mdi:weather-partly-cloudy', 'tempHigh', 'hourly'],
  news: ['news-app-styles', 'news-list', 'news-refresh-btn', 'news-update-time'],
  'author-chat': ['oc-chat-app-container', 'oc-chat-messages', 'oc-typing-indicator', 'oc-btn-send'],
  theme: ['beautify-mac-body', 'beautify-dark', 'beautify-config-panel', '.beautify-candidate-card'],
  workshop: ['workshop-plugin-styles', 'workshop-main-panel', 'workshop-backdrop', '.ws-dark'],
});
