const icons = Object.freeze({
  home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  buildings: '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M8 7h4M8 11h4M8 15h4M2 21h20M16 9h2a2 2 0 0 1 2 2v10"/></svg>',
  room: '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v16M4 21h17M15 12h.01M8 7h7"/></svg>',
  renovate: '<svg viewBox="0 0 24 24"><path d="m14 6 4 4M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10zM13 6l4 4M5 15l4 4"/></svg>',
  recruit: '<svg viewBox="0 0 24 24"><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/></svg>',
  event: '<svg viewBox="0 0 24 24"><path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18 12h3M6 21h12M8 17a6 6 0 1 1 8 0l-1 1H9z"/></svg>',
  tasks: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h6M9 13h6M9 17h3M8 2v3M16 2v3"/></svg>',
  history: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 7v5l3 2"/></svg>',
  route: '<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3"/></svg>',
  pulse: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-6 4 12 2-6h6"/><circle cx="12" cy="12" r="9"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4zM18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  person: '<svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/></svg>',
});

export function icon(name) {
  return `<span class="lmo-icon">${icons[name] ?? icons.room}</span>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function safeColor(value, fallback = '#FF9EAA') {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? value : fallback;
}

export function tags(values = []) {
  return `<div class="lmo-tags">${values.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div>`;
}

export function emptyState(title, text) {
  return `<div class="lmo-empty">${icon('sparkle')}<strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
}
