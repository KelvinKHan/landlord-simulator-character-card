const icons = Object.freeze({
  home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  buildings: '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M8 7h4M8 11h4M8 15h4M2 21h20M16 9h2a2 2 0 0 1 2 2v10"/></svg>',
  room: '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v16M4 21h17M15 12h.01M8 7h7"/></svg>',
  renovate: '<svg viewBox="0 0 24 24"><path d="m14 6 4 4M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10zM13 6l4 4M5 15l4 4"/></svg>',
  recruit: '<svg viewBox="0 0 24 24"><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/></svg>',
  event: '<svg viewBox="0 0 24 24"><path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18 12h3M6 21h12M8 17a6 6 0 1 1 8 0l-1 1H9z"/></svg>',
  tasks: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h6M9 13h6M9 17h3M8 2v3M16 2v3"/></svg>',
  history: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 7v5l3 2"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4zM18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  person: '<svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/></svg>',
});

function icon(name) {
  return `<span class="lmo-icon">${icons[name] ?? icons.room}</span>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeColor(value, fallback = '#FF9EAA') {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? value : fallback;
}

function tags(values = []) {
  return `<div class="lmo-tags">${values.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div>`;
}

function emptyState(title, text) {
  return `<div class="lmo-empty">${icon('sparkle')}<strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
}

function navItem(section, current, label, iconName) {
  return `<button class="lmo-nav-item ${section === current ? 'active' : ''}" data-action="navigate" data-section="${section}">${icon(iconName)}<span>${label}</span></button>`;
}

function taskModeCopy(state) {
  return state.运行模式 === '真实'
    ? { title: 'AI 生成模式', detail: '生成后仍需确认写入', verb: '生成 AI' }
    : { title: '本地模拟模式', detail: '不会调用真实 AI', verb: '生成本地' };
}

function renderSidebar(state, ui, portfolio) {
  const mode = taskModeCopy(state);
  return `<aside class="lmo-sidebar">
    <div class="lmo-brand"><div class="lmo-brand-mark">L</div><div><strong>Landlord</strong><span>房东经营中枢</span></div></div>
    <nav>
      ${navItem('portfolio', ui.section, '资产总览', 'buildings')}
      ${navItem('building', ui.section, '当前建筑', 'home')}
      ${navItem('twin', ui.section, '数字孪生', 'room')}
      ${navItem('renovation', ui.section, '装修中心', 'renovate')}
      ${navItem('recruitment', ui.section, '招募中心', 'recruit')}
      ${navItem('tasks', ui.section, '任务中心', 'tasks')}
      ${navItem('history', ui.section, '经营回溯', 'history')}
      ${navItem('events', ui.section, '动态记录', 'event')}
    </nav>
    <div class="lmo-sidebar-summary">
      <span>经营版图</span><strong>${portfolio.owned.length}<small> 栋已接管</small></strong>
      <div><i style="width:${Math.min(100, 28 + portfolio.owned.length * 18)}%"></i></div>
      <p>${portfolio.available.length} 个接管机会正在等待</p>
    </div>
    <div class="lmo-mode ${state.运行模式 === '真实' ? 'ai' : ''}"><span class="lmo-pulse"></span><div><strong>${mode.title}</strong><small>${mode.detail}</small></div></div>
  </aside>`;
}

function renderHeader(current, ui) {
  const eyebrow = ui.section === 'portfolio' ? 'PROPERTY PORTFOLIO' : `${current.type.toUpperCase()} · ${current.status}`;
  return `<header class="lmo-header">
    <div><span class="lmo-eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(sectionTitle(ui.section, current))}</h1></div>
    <div class="lmo-header-actions"><span class="lmo-status-dot">系统就绪</span><button class="lmo-icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div>
  </header>`;
}

function sectionTitle(section, current) {
  if (section === 'portfolio') return '我的建筑版图';
  if (section === 'renovation') return '装修具现化中心';
  if (section === 'twin') return '建筑数字孪生';
  if (section === 'recruitment') return '跨世界招募中心';
  if (section === 'takeover') return '建筑接管提案';
  if (section === 'tasks') return '统一任务中心';
  if (section === 'history') return '经营时光回溯';
  if (section === 'events') return '建筑动态记录';
  return current.name;
}

function buildingCard(building, action) {
  const accent = safeColor(building.theme?.主色);
  const owned = ['总部', '已接管'].includes(building.status);
  return `<button class="lmo-building-card" data-action="${action}" data-building-id="${escapeHtml(building.id)}" style="--building-accent:${accent}">
    <div class="lmo-building-visual"><span class="lmo-building-type">${escapeHtml(building.type)}</span><span class="lmo-building-glyph">${icon(building.isHeadquarters ? 'home' : 'buildings')}</span><i></i><i></i><i></i></div>
    <div class="lmo-building-copy"><div class="lmo-card-title"><div><strong>${escapeHtml(building.name)}</strong><span>${escapeHtml(building.worldview)}</span></div><span class="lmo-badge ${owned ? 'owned' : ''}">${escapeHtml(building.status)}</span></div>
    <p>${escapeHtml(building.description)}</p>
    <div class="lmo-card-metrics"><span><b>${building.metrics.floors}</b> 层</span><span><b>${building.metrics.spaces}</b> 空间</span><span><b>${building.summary.活跃度 ?? 0}</b> 活跃</span><em>${owned ? '进入管理' : '查看提案'} ${icon('arrow')}</em></div></div>
  </button>`;
}

function renderPortfolio(state, portfolio) {
  const current = portfolio.buildings.find(item => item.id === state.当前建筑ID) ?? portfolio.headquarters;
  const recentEvents = Object.entries(state.事件列表 ?? {}).slice(-3).reverse();
  return `<section class="lmo-view lmo-portfolio">
    <div class="lmo-hero" style="--building-accent:${safeColor(current.theme?.主色)}">
      <div><span class="lmo-kicker">当前经营焦点</span><h2>${escapeHtml(current.name)}</h2><p>${escapeHtml(current.summary.今日亮点)}</p>
      <button class="lmo-primary" data-action="open-building" data-building-id="${escapeHtml(current.id)}">进入建筑 ${icon('arrow')}</button></div>
      <div class="lmo-hero-orbit"><span>${portfolio.owned.length}</span><small>栋建筑</small><i></i><i></i><i></i></div>
    </div>
    <div class="lmo-section-heading"><div><span>OWNED</span><h2>已经属于你的地方</h2></div><p>每一栋建筑都使用同一份真实状态，但拥有自己的空间语言。</p></div>
    <div class="lmo-building-grid">${portfolio.owned.map(building => buildingCard(building, 'open-building')).join('')}</div>
    <div class="lmo-section-heading"><div><span>OPPORTUNITIES</span><h2>下一次接管机会</h2></div><p>不是空壳：它们已经有格局、设施和等待被改变的部分。</p></div>
    <div class="lmo-building-grid">${portfolio.available.map(building => buildingCard(building, 'open-takeover')).join('')}</div>
    <div class="lmo-dashboard-row">
      <article class="lmo-panel"><div class="lmo-panel-title"><div>${icon('event')}<span><strong>刚刚发生</strong><small>所有模块将逐步共用这条时间线</small></span></div></div>
      ${recentEvents.length ? `<div class="lmo-mini-timeline">${recentEvents.map(([, event]) => `<div><i></i><span><strong>${escapeHtml(event.标题)}</strong><small>${escapeHtml(event.摘要)}</small></span><time>${escapeHtml(event.发生时间)}</time></div>`).join('')}</div>` : emptyState('等待第一个变化', '接管、装修或招募后，这里会留下真实记录。')}</article>
      <article class="lmo-panel lmo-world-card"><div class="lmo-panel-title"><div>${icon('sparkle')}<span><strong>世界碰撞预览</strong><small>不需要额外素材库</small></span></div></div><p>建筑提供稳定空间，人物带来完全不同的规则。装修、招募与故事会从同一份状态继续生长。</p>${tags(['建筑决定舞台', '人物带来变化', '代码保证一致'])}</article>
    </div>
  </section>`;
}

function spaceCard(space) {
  const sizeClass = `size-${escapeHtml(space.size)}`;
  return `<button class="lmo-space-card ${sizeClass} visibility-${escapeHtml(space.visibility)}" data-action="select-space" data-space-id="${escapeHtml(space.id)}">
    <div><span class="lmo-space-type">${escapeHtml(space.type)}</span><span class="lmo-space-status status-${escapeHtml(space.status)}">${escapeHtml(space.status)}</span></div>
    <strong>${escapeHtml(space.name)}</strong><p>${escapeHtml(space.purpose)}</p>
    <footer><span>${space.occupants.length ? `${space.occupants.length} 人正在使用` : `感知 ${space.awareness}%`}</span><span>${escapeHtml(space.renovation?.风格 ?? '待探索')}</span></footer>
  </button>`;
}

function renderBuilding(building, identityCenter) {
  return `<section class="lmo-view">
    <div class="lmo-building-banner" style="--building-accent:${safeColor(building.theme?.主色)}"><div><span>${escapeHtml(building.type)} · ${escapeHtml(building.worldview)}</span><h2>${escapeHtml(building.name)}</h2><p>${escapeHtml(building.description)}</p></div><div class="lmo-banner-actions"><button class="lmo-secondary" data-action="explore-next">${icon('sparkle')} 探索下一处</button><button class="lmo-secondary" data-action="navigate" data-section="renovation">${icon('renovate')} 开始装修</button><button class="lmo-primary" data-action="navigate" data-section="recruitment">${icon('recruit')} 招募人物</button></div></div>
    <div class="lmo-metric-strip"><div><span>可见楼层</span><strong>${building.metrics.floors}</strong></div><div><span>当前空间</span><strong>${building.metrics.spaces}</strong></div><div><span>已安置人物</span><strong>${building.metrics.people}</strong></div><div><span>活跃度</span><strong>${building.summary.活跃度 ?? 0}<small>%</small></strong></div></div>
    ${identityCenter.residents.length ? `<article class="lmo-panel"><div class="lmo-panel-title"><div>${icon('person')}<span><strong>建筑成员</strong><small>跨界面共用同一份视觉身份和位置</small></span></div></div><div class="lmo-resident-strip">${identityCenter.residents.map(person => `<div style="--person-accent:${safeColor(person.color)}"><span>${escapeHtml(person.initial)}</span><p><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role)} · ${escapeHtml(person.spaceName)}</small></p><code>${escapeHtml(person.contactId)}</code></div>`).join('')}</div></article>` : ''}
    <div class="lmo-floor-list">${building.floors.map(floor => `<article class="lmo-floor visibility-${escapeHtml(floor.visibility)}"><header><div><span>${String(floor.order).padStart(2, '0')}</span><div><strong>${escapeHtml(floor.name)}</strong><small>${escapeHtml(floor.description)}</small></div></div><em>感知 ${floor.awareness}% · ${escapeHtml(floor.visibility)}</em></header><div class="lmo-space-grid">${floor.spaces.length ? floor.spaces.map(spaceCard).join('') : emptyState('这一层仍是未知', '随着接管和探索，新的空间会逐步显现。')}</div></article>`).join('')}</div>
  </section>`;
}

function renderTwinMap(floor, selectedId, accent) {
  const selected = floor.nodes.find(node => node.id === selectedId) ?? floor.nodes[0] ?? null;
  const connected = new Set(
    floor.edges
      .filter(edge => edge.from === selected?.id || edge.to === selected?.id)
      .flatMap(edge => [edge.from, edge.to]),
  );
  const lines = floor.edges.map(edge => {
    const highlighted = edge.from === selected?.id || edge.to === selected?.id;
    return `<line class="${highlighted ? 'active' : ''}" x1="${edge.fromPoint.x}" y1="${edge.fromPoint.y}" x2="${edge.toPoint.x}" y2="${edge.toPoint.y}" data-edge-id="${escapeHtml(edge.id)}"/>`;
  }).join('');
  const nodes = floor.nodes.map(node => {
    const classes = [
      `visibility-${escapeHtml(node.visibility)}`,
      node.id === selected?.id ? 'selected' : '',
      connected.has(node.id) && node.id !== selected?.id ? 'connected' : '',
    ].filter(Boolean).join(' ');
    return `<button class="${classes}" data-action="inspect-twin-space" data-floor-id="${escapeHtml(floor.id)}" data-space-id="${escapeHtml(node.id)}" aria-pressed="${node.id === selected?.id}" style="left:${node.x}%;top:${node.y}%;width:${node.w}%;height:${node.h}%"><strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(node.type)} · ${node.awareness}%</small>${node.occupants?.length ? `<em>${node.occupants.map(person => escapeHtml(person.name)).join(' / ')}</em>` : ''}</button>`;
  }).join('');
  return `<div class="lmo-twin-map" style="--twin-accent:${safeColor(accent)}"><svg class="lmo-twin-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="已知空间相邻关系">${lines}</svg>${nodes}</div>`;
}

function renderTwinInspector(node, floor) {
  if (!node) return `<aside class="lmo-twin-inspector">${emptyState('这一层仍是未知', '继续探索后，房间和连接关系会在这里显现。')}</aside>`;
  const connectedIds = new Set(
    floor.edges
      .filter(edge => edge.from === node.id || edge.to === node.id)
      .flatMap(edge => [edge.from, edge.to]),
  );
  connectedIds.delete(node.id);
  const connectedNames = floor.nodes.filter(item => connectedIds.has(item.id)).map(item => item.name);
  const occupants = node.occupants?.length
    ? node.occupants.map(person => `<span style="--person-accent:${safeColor(person.color)}"><i>${escapeHtml(person.name.slice(0, 1))}</i>${escapeHtml(person.name)}</span>`).join('')
    : '<small>当前无人使用</small>';
  return `<aside class="lmo-twin-inspector">
    <div class="lmo-twin-inspector-head"><span>${escapeHtml(node.type)} · ${escapeHtml(node.size)}</span><strong>${escapeHtml(node.name)}</strong><p>${escapeHtml(node.description)}</p></div>
    <div class="lmo-twin-data-grid"><span><small>空间状态</small><b>${escapeHtml(node.status)}</b></span><span><small>感知程度</small><b>${node.awareness}%</b></span><span><small>已知设施</small><b>${node.facilityCount ?? 0}</b></span><span><small>装修风格</small><b>${escapeHtml(node.renovation?.风格 ?? '尚未具现')}</b></span></div>
    <div class="lmo-twin-inspector-block"><small>当前用途</small><p>${escapeHtml(node.purpose)}</p></div>
    <div class="lmo-twin-inspector-block"><small>正在这里的人</small><div class="lmo-twin-people">${occupants}</div></div>
    <div class="lmo-twin-inspector-block"><small>已知相邻空间</small>${connectedNames.length ? tags(connectedNames) : '<p>尚未确认连接关系</p>'}</div>
    <button class="lmo-primary" data-action="select-space" data-space-id="${escapeHtml(node.id)}">${icon('renovate')} 装修这个空间</button>
  </aside>`;
}

function renderTwin(twin, ui) {
  const floor = twin.floors.find(item => item.id === ui.focusedFloorId)
    ?? twin.floors.find(item => item.nodes.length > 0)
    ?? twin.floors[0]
    ?? null;
  const selected = floor?.nodes.find(node => node.id === ui.twinSpaceId) ?? floor?.nodes[0] ?? null;
  return `<section class="lmo-view lmo-twin-view">
    <div class="lmo-section-heading"><div><span>BUILDING DIGITAL TWIN</span><h2>${escapeHtml(twin.name)}·可计算空间镜像</h2></div><p>布局、房间面积与连接均由状态确定性计算；AI 不负责猜坐标。</p></div>
    <div class="lmo-twin-toolbar"><div class="lmo-twin-metrics"><span><b>${twin.metrics.floors}</b>可见楼层</span><span><b>${twin.metrics.nodes}</b>空间节点</span><span><b>${twin.metrics.edges}</b>已知连接</span></div><div class="lmo-twin-legend"><span><i class="outline"></i>轮廓</span><span><i class="revealed"></i>已显现</span><span><i class="occupied"></i>有人使用</span></div></div>
    <div class="lmo-twin-layout">
      <nav class="lmo-twin-floor-nav" aria-label="数字孪生楼层">${twin.floors.map(item => `<button class="${item.id === floor?.id ? 'active' : ''}" data-action="focus-twin-floor" data-floor-id="${escapeHtml(item.id)}" aria-pressed="${item.id === floor?.id}"><span>${String(item.order).padStart(2, '0')}</span><p><strong>${escapeHtml(item.name)}</strong><small>${item.nodes.length} 空间 · 感知 ${item.awareness}%</small></p></button>`).join('')}</nav>
      <article class="lmo-twin-stage"><header><div><span>FOCUSED FLOOR</span><strong>${escapeHtml(floor?.name ?? '暂无可见楼层')}</strong></div><small>${floor ? `${floor.nodes.length} 个空间 · ${floor.edges.length} 条连接` : '等待探索'}</small></header>${floor?.nodes.length ? renderTwinMap(floor, selected?.id, twin.theme?.主色) : emptyState('暂无可见空间', '继续探索后，空间会进入数字孪生。')}</article>
      ${renderTwinInspector(selected, floor ?? { nodes: [], edges: [] })}
    </div>
  </section>`;
}

function workflowSteps(active) {
  return `<div class="lmo-workflow-steps"><span class="done"><b>1</b>选择目标</span><i></i><span class="${active >= 2 ? 'done' : ''}"><b>2</b>生成预览</span><i></i><span class="${active >= 3 ? 'done' : ''}"><b>3</b>确认写入</span></div>`;
}

function renderTakeover(state, building, task, selectedId, busy) {
  const mode = taskModeCopy(state);
  const directions = task?.status === 'ready' ? task.preview.directions : [];
  return `<section class="lmo-view lmo-workflow">${workflowSteps(directions.length ? 2 : 1)}
    <div class="lmo-workflow-intro" style="--building-accent:${safeColor(building.theme?.主色)}"><button class="lmo-text-button" data-action="navigate" data-section="portfolio">${icon('back')} 返回资产总览</button><div><span class="lmo-building-type">${escapeHtml(building.type)}</span><h2>${escapeHtml(building.name)}</h2><p>${escapeHtml(building.description)}</p></div><div class="lmo-facts"><span><b>${building.metrics.floors}</b> 层基础格局</span><span><b>${building.metrics.spaces}</b> 个现有空间</span><span><b>${building.awareness}%</b> 已感知</span></div></div>
    ${!directions.length ? `<div class="lmo-generation-callout">${icon('sparkle')}<div><strong>生成三种接管方向</strong><p>${state.运行模式 === '真实' ? '调用酒馆助手的结构化生成；不读取聊天历史，结果不会自动写入。' : '当前只读取本地固定样例，不会访问聊天记录，也不会调用任何真实 AI。'}</p></div><button class="lmo-primary" data-action="run-takeover" data-building-id="${escapeHtml(building.id)}" ${busy ? 'disabled' : ''}>${busy ? '正在整理…' : `${mode.verb}提案`}</button></div>` : `<div class="lmo-option-grid">${directions.map(direction => `<button class="lmo-option-card ${selectedId === direction.id ? 'selected' : ''}" data-action="choose-option" data-option-id="${escapeHtml(direction.id)}"><div class="lmo-option-check">${selectedId === direction.id ? icon('check') : ''}</div><span>经营方向</span><h3>${escapeHtml(direction.name)}</h3><p>${escapeHtml(direction.description)}</p>${tags(direction.tags)}<ul>${direction.opportunities.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></button>`).join('')}</div><div class="lmo-confirm-bar"><div><strong>${selectedId ? '方案已经选定' : '选择一个方向继续'}</strong><span>只有点击确认后，建筑状态才会正式改变。</span></div><button class="lmo-primary" data-action="confirm-takeover" ${selectedId && !busy ? '' : 'disabled'}>确认接管 ${icon('arrow')}</button></div>`}
  </section>`;
}

function ownedSpaceOptions(building, selectedSpaceId, action = 'choose-workflow-space') {
  return building.floors.flatMap(floor => floor.spaces).map(space => `<button class="lmo-compact-space ${selectedSpaceId === space.id ? 'selected' : ''}" data-action="${action}" data-space-id="${escapeHtml(space.id)}"><span>${escapeHtml(space.type)}</span><strong>${escapeHtml(space.name)}</strong><small>${escapeHtml(space.status)} · ${escapeHtml(space.size)}</small></button>`).join('');
}

function renderRenovation(state, building, task, selectedSpaceId, selectedId, busy) {
  const plans = task?.status === 'ready' ? task.preview.plans : [];
  const space = building.floors.flatMap(floor => floor.spaces).find(item => item.id === selectedSpaceId);
  const markup = `<section class="lmo-view lmo-workflow">${workflowSteps(plans.length ? 2 : selectedSpaceId ? 1 : 0)}
    <div class="lmo-two-column"><aside class="lmo-selector"><span class="lmo-kicker">选择装修目标</span><h2>${escapeHtml(building.name)}</h2><div class="lmo-compact-list">${ownedSpaceOptions(building, selectedSpaceId)}</div></aside>
    <div class="lmo-workspace">${!space ? emptyState('先选择一个空间', '可以从一个房间开始，不需要一次装修整栋建筑。') : !plans.length ? `<div class="lmo-preview-room"><span>${escapeHtml(space.type)} · ${escapeHtml(space.size)}</span><h2>${escapeHtml(space.name)}</h2><p>${escapeHtml(space.description)}</p><div class="lmo-current-style"><small>当前装修</small><strong>${escapeHtml(space.renovation?.风格)}</strong><span>${escapeHtml(space.renovation?.氛围)}</span></div><button class="lmo-primary" data-action="run-renovation" ${busy ? 'disabled' : ''}>${icon('sparkle')} ${busy ? '正在整理…' : '生成三个本地方案'}</button></div>` : `<div class="lmo-renovation-plans">${plans.map(plan => `<button class="lmo-renovation-card ${selectedId === plan.id ? 'selected' : ''}" data-action="choose-option" data-option-id="${escapeHtml(plan.id)}"><div class="lmo-palette">${Object.values(plan.palette).map(color => `<i style="--swatch:${safeColor(color, '#E2E8F0')}"></i>`).join('')}</div><span>${escapeHtml(plan.style)}</span><h3>${escapeHtml(plan.name)}</h3><p>${escapeHtml(plan.tagline)}</p>${tags(plan.impacts)}<small>${escapeHtml(plan.lighting)}</small></button>`).join('')}</div><div class="lmo-confirm-bar"><div><strong>${selectedId ? '装修效果可以具现化' : '挑选最喜欢的方案'}</strong><span>确认后会改变空间描述、配色、材质和事件记录。</span></div><button class="lmo-primary" data-action="confirm-renovation" ${selectedId && !busy ? '' : 'disabled'}>应用装修 ${icon('arrow')}</button></div>`}</div></div>
  </section>`;
  return state.运行模式 === '真实' ? markup.replace('生成三个本地方案', '生成三个 AI 方案') : markup;
}

function renderRecruitment(state, building, task, selectedSpaceId, selectedId, busy) {
  const mode = taskModeCopy(state);
  const candidates = task?.status === 'ready' ? task.preview.candidates : [];
  return `<section class="lmo-view lmo-workflow">${workflowSteps(candidates.length ? 2 : 1)}
    <div class="lmo-generation-callout compact">${icon('recruit')}<div><strong>为「${escapeHtml(building.name)}」寻找新成员</strong><p>候选人只是预览，确认前不会出现在人物列表或建筑里。</p></div>${!candidates.length ? `<button class="lmo-primary" data-action="run-recruitment" ${busy ? 'disabled' : ''}>${busy ? '正在整理…' : `${mode.verb}候选人`}</button>` : ''}</div>
    ${candidates.length ? `<div class="lmo-recruit-layout"><div class="lmo-candidate-list">${candidates.map(candidate => `<button class="lmo-candidate ${selectedId === candidate.id ? 'selected' : ''}" data-action="choose-option" data-option-id="${escapeHtml(candidate.id)}" style="--person-accent:${safeColor(candidate.visualIdentity.主色)}"><div class="lmo-avatar">${escapeHtml(candidate.name.slice(0, 1))}</div><div><span>${escapeHtml(candidate.origin)} · ${escapeHtml(candidate.profession)}</span><h3>${escapeHtml(candidate.name)}</h3><p>${escapeHtml(candidate.personality)}</p><blockquote>“${escapeHtml(candidate.quote)}”</blockquote>${tags(candidate.tags)}</div><i class="lmo-option-check">${selectedId === candidate.id ? icon('check') : ''}</i></button>`).join('')}</div><aside class="lmo-placement"><span class="lmo-kicker">安排位置</span><h3>让人物真正进入建筑</h3><p>选择一个空间后，人物档案、门牌和建筑占用记录会同时创建。</p><div class="lmo-compact-list">${ownedSpaceOptions(building, selectedSpaceId, 'choose-recruit-space')}</div></aside></div><div class="lmo-confirm-bar"><div><strong>${selectedId && selectedSpaceId ? '人物与位置已经确定' : '请选择人物和安置位置'}</strong><span>这一步会写入人物、空间和事件三处状态。</span></div><button class="lmo-primary" data-action="confirm-recruitment" ${selectedId && selectedSpaceId && !busy ? '' : 'disabled'}>确认加入 ${icon('arrow')}</button></div>` : emptyState('候选名单尚未生成', '点击上方按钮，用本地模拟数据预览完整流程。')}
  </section>`;
}

const taskStatusLabels = Object.freeze({
  created: '已创建', queued: '排队中', running: '执行中', retrying: '重试中',
  'waiting-retry': '等待重试', ready: '待确认', applying: '写入中', confirmed: '已确认',
  failed: '失败', cancelled: '已取消',
});

const taskKindLabels = Object.freeze({ takeover: '建筑接管', renovation: '空间装修', recruitment: '人物招募' });

function renderTasks(taskCenter) {
  const ai = taskCenter.capabilities.find(item => item.mode === 'ai');
  const recent = taskCenter.tasks.slice(-12).reverse();
  return `<section class="lmo-view lmo-task-center">
    <div class="lmo-section-heading"><div><span>GENERATION ORCHESTRATOR</span><h2>一个入口，两种生成方式</h2></div><p>任务中心统一负责排队、超时、重试、取消和预览确认。</p></div>
    <div class="lmo-mode-grid">
      <button class="lmo-mode-card ${taskCenter.mode === 'local' ? 'selected' : ''}" data-action="set-task-mode" data-mode="local"><div>${icon('tasks')}<span class="lmo-option-check">${taskCenter.mode === 'local' ? icon('check') : ''}</span></div><strong>本地模拟</strong><p>使用内置样例验证整套流程，永远不调用 AI。</p><small>快速 · 可重现 · 适合测试</small></button>
      <button class="lmo-mode-card ${taskCenter.mode === 'ai' ? 'selected' : ''}" data-action="set-task-mode" data-mode="ai" ${ai?.available ? '' : 'disabled'}><div>${icon('sparkle')}<span class="lmo-option-check">${taskCenter.mode === 'ai' ? icon('check') : ''}</span></div><strong>AI 结构化生成</strong><p>通过酒馆助手生成候选方案，并先做格式校验。</p><small>${ai?.available ? '已检测到生成能力 · 不自动写入' : '当前环境未提供生成能力'}</small></button>
    </div>
    <div class="lmo-safety-line">${icon('check')}<span><strong>切换模式不会发起生成</strong><small>只有在接管、装修或招募页面主动点击后，才会创建任务。</small></span></div>
    <article class="lmo-panel"><div class="lmo-panel-title"><div>${icon('tasks')}<span><strong>任务排队</strong><small>最近 ${recent.length} 条任务</small></span></div></div>
      ${recent.length ? `<div class="lmo-task-list">${recent.map(task => `<div class="lmo-task-row"><span class="lmo-task-state status-${escapeHtml(task.status)}">${escapeHtml(taskStatusLabels[task.status] ?? task.status)}</span><div><strong>${escapeHtml(taskKindLabels[task.kind] ?? task.kind)}</strong><small>${task.mode === 'ai' ? 'AI 生成' : '本地模拟'} · 第 ${task.attempt}/${task.maxAttempts} 次${task.error ? ` · ${escapeHtml(task.error)}` : ''}</small></div><code>${escapeHtml(task.id)}</code><span class="lmo-task-actions">${['queued','running','retrying','waiting-retry','ready'].includes(task.status) ? `<button data-action="cancel-task" data-task-id="${escapeHtml(task.id)}">取消</button>` : ''}${['failed','cancelled'].includes(task.status) ? `<button data-action="retry-task" data-task-id="${escapeHtml(task.id)}">重试</button>` : ''}</span></div>`).join('')}</div>` : emptyState('队列还是空的', '从接管、装修或招募中心发起的任务会在这里留下全过程状态。')}
    </article>
  </section>`;
}

function renderLinkDraft(draft) {
  const detail = draft.kind === 'story-context'
    ? `<span>下一次正文 · system / depth 0 / once</span><pre>${escapeHtml(draft.content)}</pre>`
    : draft.kind === 'wechat-message'
      ? `<span>${escapeHtml(draft.conversationName)} · ${escapeHtml(draft.sender)}</span><p>${escapeHtml(draft.content)}</p>`
      : draft.kind === 'news-headline'
        ? `<span>${escapeHtml(draft.headline.tag)} · ${escapeHtml(draft.headline.source)}</span><p>${escapeHtml(draft.headline.summary)}</p>`
        : `<span>建筑内部时间线</span><p>${escapeHtml(draft.summary)}</p>`;
  return `<article class="lmo-link-draft"><header><span>${escapeHtml(draft.channel)}</span><code>${escapeHtml(draft.kind)}</code></header><strong>${escapeHtml(draft.title)}</strong>${detail}</article>`;
}

function renderLinkPreview(linkCenter) {
  if (!linkCenter.previewDrafts.length) return '';
  const unavailable = [...new Set(linkCenter.previewDrafts.filter(draft => !linkCenter.capabilities[draft.channel]).map(draft => draft.channel))];
  return `<article class="lmo-link-preview">
    <header><div>${icon('sparkle')}<span><strong>投递前预览</strong><small>${linkCenter.previewDrafts.length} 条草稿 · 确认前不会写入任何频道</small></span></div><button data-action="clear-link-preview" aria-label="关闭预览">${icon('close')}</button></header>
    <div class="lmo-link-draft-grid">${linkCenter.previewDrafts.map(renderLinkDraft).join('')}</div>
    <footer><p>${unavailable.length ? `${escapeHtml(unavailable.join('、'))}频道尚未就绪，当前不能投递。` : '正文会注入下一次生成；微信和新闻会写入原有模块；建筑会同步内部记录。'}</p><button class="lmo-primary" data-action="dispatch-preview-links" ${unavailable.length ? 'disabled' : ''}>确认投递 ${linkCenter.previewDrafts.length} 条 ${icon('arrow')}</button></footer>
  </article>`;
}

function renderEvents(state, portfolio, linkCenter) {
  const events = Object.entries(state.事件列表 ?? {}).reverse();
  const channels = ['正文', '微信', '新闻', '建筑'];
  return `<section class="lmo-view"><div class="lmo-section-heading"><div><span>BUILDING MEMORY</span><h2>真正发生过的变化</h2></div><p>这里只有确认写入过的操作，不展示临时候选和取消的方案。</p></div>
    <div class="lmo-link-channels">${channels.map(channel => `<div class="${linkCenter.capabilities[channel] ? '' : 'unavailable'}"><span>${escapeHtml(channel)}</span><strong>${linkCenter.counts[channel] ?? 0}</strong><small>${linkCenter.capabilities[channel] ? '待分发联动' : '频道未就绪'}</small>${linkCenter.counts[channel] ? `<button data-action="preview-channel-links" data-channel="${escapeHtml(channel)}">预览本批次</button>` : ''}</div>`).join('')}</div>
    ${renderLinkPreview(linkCenter)}
    <article class="lmo-panel"><div class="lmo-panel-title"><div>${icon('sparkle')}<span><strong>跨系统联动队列</strong><small>正文、微信、新闻和建筑使用同一个事件源</small></span></div></div>${linkCenter.pending.length ? `<div class="lmo-link-list">${linkCenter.pending.map(item => `<div><span>${escapeHtml(item.频道)}</span><p><strong>${escapeHtml(item.标题)}</strong><small>${escapeHtml(item.摘要)}</small></p><button data-action="preview-link" data-link-id="${escapeHtml(item.id)}">预览</button><button data-action="consume-link" data-link-id="${escapeHtml(item.id)}">已读</button><button data-action="ignore-link" data-link-id="${escapeHtml(item.id)}">忽略</button></div>`).join('')}</div>` : emptyState('联动队列已清空', '新的经营变化会自动投递到四个频道。')}</article>
    ${events.length ? `<div class="lmo-event-timeline">${events.map(([id, event]) => { const building = portfolio.buildings.find(item => item.id === event.建筑ID); return `<article><div class="lmo-event-mark">${icon(event.类型 === '人物加入' ? 'person' : event.类型 === '装修完成' ? 'renovate' : 'buildings')}</div><div><span>${escapeHtml(event.类型)} · ${escapeHtml(building?.name ?? '未知建筑')}</span><h3>${escapeHtml(event.标题)}</h3><p>${escapeHtml(event.摘要)}</p><small>${escapeHtml(event.发生时间)} · ${escapeHtml(id)}</small></div><em>${escapeHtml(event.状态)}</em></article>`; }).join('')}</div>` : emptyState('还没有经营记录', '完成第一次接管、装修或招募后，建筑记忆会出现在这里。')}</section>`;
}

const operationKindLabels = Object.freeze({
  takeover: '建筑接管', renovation: '空间装修', recruitment: '人物招募', exploration: '探索感知', management: '经营操作',
});

function renderOperationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '当前会话';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function renderHistory(historyCenter) {
  const blocked = historyCenter.blockedUndo
    ? '<div class="lmo-history-warning">检测到同一区域有更新，为避免覆盖新剧情，当前撤销已被安全锁定。</div>'
    : '';
  return `<section class="lmo-view lmo-history-view">
    <div class="lmo-section-heading"><div><span>OPERATION TIME MACHINE</span><h2>只回溯你确认过的经营操作</h2></div><p>它不是存档迁移；只在当前会话里撤销接管、装修、招募和探索。</p></div>
    <article class="lmo-history-console">
      <div class="lmo-history-orbit"><span>${historyCenter.appliedCount}</span><small>已应用操作</small><i></i></div>
      <div class="lmo-history-copy"><span>SAFE REVERSIBLE STATE</span><h3>经营状态有自己的时间轴</h3><p>每次只恢复本次操作真正改动的字段。其他脚本产生的不相关变化会被保留；发生重叠时则拒绝覆盖。</p><div class="lmo-history-actions"><button class="lmo-secondary" data-action="undo-operation" ${historyCenter.canUndo && !historyCenter.busy ? '' : 'disabled'}>${icon('back')} 撤销${historyCenter.undoLabel ? `：${escapeHtml(historyCenter.undoLabel)}` : ''}</button><button class="lmo-primary" data-action="redo-operation" ${historyCenter.canRedo && !historyCenter.busy ? '' : 'disabled'}>重做${historyCenter.redoLabel ? `：${escapeHtml(historyCenter.redoLabel)}` : ''} ${icon('arrow')}</button></div>${blocked}</div>
    </article>
    <article class="lmo-panel"><div class="lmo-panel-title"><div>${icon('history')}<span><strong>当前会话操作链</strong><small>${historyCenter.count} 条可回溯记录，新的操作会截断已撤销分支</small></span></div></div>
      ${historyCenter.entries.length ? `<div class="lmo-history-list">${historyCenter.entries.map(entry => `<div class="status-${entry.status === '已应用' ? 'applied' : 'undone'}"><span>${icon(entry.kind === 'recruitment' ? 'person' : entry.kind === 'renovation' ? 'renovate' : entry.kind === 'exploration' ? 'sparkle' : 'buildings')}</span><p><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(operationKindLabels[entry.kind] ?? entry.kind)} · ${entry.changeCount} 处原子变化 · ${escapeHtml(entry.affectedRoots.join(' / '))}</small></p><time>${renderOperationTime(entry.createdAt)}</time><em>${escapeHtml(entry.status)}</em></div>`).join('')}</div>` : emptyState('还没有可以回溯的操作', '确认一次接管、装修、招募或探索后，这里会自动出现记录。')}
    </article>
  </section>`;
}

export function renderConsole({ state, portfolio, current, ui, task, taskCenter, linkCenter, identityCenter, historyCenter, twin }) {
  let content;
  if (ui.section === 'portfolio') content = renderPortfolio(state, portfolio);
  else if (ui.section === 'building') content = renderBuilding(current, identityCenter);
  else if (ui.section === 'twin') content = renderTwin(twin, ui);
  else if (ui.section === 'takeover') content = renderTakeover(state, ui.targetBuilding, task, ui.selectedOptionId, ui.busy);
  else if (ui.section === 'renovation') content = renderRenovation(state, current, task, ui.selectedSpaceId, ui.selectedOptionId, ui.busy);
  else if (ui.section === 'recruitment') content = renderRecruitment(state, current, task, ui.selectedSpaceId, ui.selectedOptionId, ui.busy);
  else if (ui.section === 'tasks') content = renderTasks(taskCenter);
  else if (ui.section === 'history') content = renderHistory(historyCenter);
  else content = renderEvents(state, portfolio, linkCenter);

  const displayBuilding = ui.section === 'takeover' ? ui.targetBuilding : current;
  return `<div class="lmo-backdrop" data-action="close-backdrop"><div class="lmo-shell" role="dialog" aria-modal="true" aria-label="房东经营中枢" style="--active-accent:${safeColor(displayBuilding.theme?.主色)}">
    ${renderSidebar(state, ui, portfolio)}<main class="lmo-main">${renderHeader(displayBuilding, ui)}<div class="lmo-scroll">${ui.notice ? `<div class="lmo-notice ${ui.notice.type}">${escapeHtml(ui.notice.text)}</div>` : ''}${content}</div></main>
  </div></div>`;
}
