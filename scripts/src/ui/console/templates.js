const icons = Object.freeze({
  home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  buildings: '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M8 7h4M8 11h4M8 15h4M2 21h20M16 9h2a2 2 0 0 1 2 2v10"/></svg>',
  room: '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v16M4 21h17M15 12h.01M8 7h7"/></svg>',
  renovate: '<svg viewBox="0 0 24 24"><path d="m14 6 4 4M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10zM13 6l4 4M5 15l4 4"/></svg>',
  recruit: '<svg viewBox="0 0 24 24"><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/></svg>',
  event: '<svg viewBox="0 0 24 24"><path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18 12h3M6 21h12M8 17a6 6 0 1 1 8 0l-1 1H9z"/></svg>',
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

function renderSidebar(ui, portfolio) {
  return `<aside class="lmo-sidebar">
    <div class="lmo-brand"><div class="lmo-brand-mark">L</div><div><strong>Landlord</strong><span>房东经营中枢</span></div></div>
    <nav>
      ${navItem('portfolio', ui.section, '资产总览', 'buildings')}
      ${navItem('building', ui.section, '当前建筑', 'home')}
      ${navItem('renovation', ui.section, '装修中心', 'renovate')}
      ${navItem('recruitment', ui.section, '招募中心', 'recruit')}
      ${navItem('events', ui.section, '动态记录', 'event')}
    </nav>
    <div class="lmo-sidebar-summary">
      <span>经营版图</span><strong>${portfolio.owned.length}<small> 栋已接管</small></strong>
      <div><i style="width:${Math.min(100, 28 + portfolio.owned.length * 18)}%"></i></div>
      <p>${portfolio.available.length} 个接管机会正在等待</p>
    </div>
    <div class="lmo-mode"><span class="lmo-pulse"></span><div><strong>本地模拟模式</strong><small>不会调用真实 AI</small></div></div>
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
  if (section === 'recruitment') return '跨世界招募中心';
  if (section === 'takeover') return '建筑接管提案';
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
  return `<button class="lmo-space-card ${sizeClass}" data-action="select-space" data-space-id="${escapeHtml(space.id)}">
    <div><span class="lmo-space-type">${escapeHtml(space.type)}</span><span class="lmo-space-status status-${escapeHtml(space.status)}">${escapeHtml(space.status)}</span></div>
    <strong>${escapeHtml(space.name)}</strong><p>${escapeHtml(space.purpose)}</p>
    <footer><span>${space.occupants.length ? `${space.occupants.length} 人正在使用` : '等待人物进入'}</span><span>${escapeHtml(space.renovation?.风格 ?? '基础装修')}</span></footer>
  </button>`;
}

function renderBuilding(building) {
  return `<section class="lmo-view">
    <div class="lmo-building-banner" style="--building-accent:${safeColor(building.theme?.主色)}"><div><span>${escapeHtml(building.type)} · ${escapeHtml(building.worldview)}</span><h2>${escapeHtml(building.name)}</h2><p>${escapeHtml(building.description)}</p></div><div class="lmo-banner-actions"><button class="lmo-secondary" data-action="navigate" data-section="renovation">${icon('renovate')} 开始装修</button><button class="lmo-primary" data-action="navigate" data-section="recruitment">${icon('recruit')} 招募人物</button></div></div>
    <div class="lmo-metric-strip"><div><span>可见楼层</span><strong>${building.metrics.floors}</strong></div><div><span>当前空间</span><strong>${building.metrics.spaces}</strong></div><div><span>已安置人物</span><strong>${building.metrics.people}</strong></div><div><span>活跃度</span><strong>${building.summary.活跃度 ?? 0}<small>%</small></strong></div></div>
    <div class="lmo-floor-list">${building.floors.map(floor => `<article class="lmo-floor"><header><div><span>${String(floor.order).padStart(2, '0')}</span><div><strong>${escapeHtml(floor.name)}</strong><small>${escapeHtml(floor.description)}</small></div></div><em>感知 ${floor.awareness}%</em></header><div class="lmo-space-grid">${floor.spaces.length ? floor.spaces.map(spaceCard).join('') : emptyState('这一层仍是未知', '随着接管和探索，新的空间会逐步显现。')}</div></article>`).join('')}</div>
  </section>`;
}

function workflowSteps(active) {
  return `<div class="lmo-workflow-steps"><span class="done"><b>1</b>选择目标</span><i></i><span class="${active >= 2 ? 'done' : ''}"><b>2</b>生成预览</span><i></i><span class="${active >= 3 ? 'done' : ''}"><b>3</b>确认写入</span></div>`;
}

function renderTakeover(building, task, selectedId, busy) {
  const directions = task?.status === 'ready' ? task.preview.directions : [];
  return `<section class="lmo-view lmo-workflow">${workflowSteps(directions.length ? 2 : 1)}
    <div class="lmo-workflow-intro" style="--building-accent:${safeColor(building.theme?.主色)}"><button class="lmo-text-button" data-action="navigate" data-section="portfolio">${icon('back')} 返回资产总览</button><div><span class="lmo-building-type">${escapeHtml(building.type)}</span><h2>${escapeHtml(building.name)}</h2><p>${escapeHtml(building.description)}</p></div><div class="lmo-facts"><span><b>${building.metrics.floors}</b> 层基础格局</span><span><b>${building.metrics.spaces}</b> 个现有空间</span><span><b>${building.awareness}%</b> 已感知</span></div></div>
    ${!directions.length ? `<div class="lmo-generation-callout">${icon('sparkle')}<div><strong>生成三种接管方向</strong><p>当前只读取本地固定样例，不会访问聊天记录，也不会调用任何真实 AI。</p></div><button class="lmo-primary" data-action="run-takeover" data-building-id="${escapeHtml(building.id)}" ${busy ? 'disabled' : ''}>${busy ? '正在整理…' : '生成本地提案'}</button></div>` : `<div class="lmo-option-grid">${directions.map(direction => `<button class="lmo-option-card ${selectedId === direction.id ? 'selected' : ''}" data-action="choose-option" data-option-id="${escapeHtml(direction.id)}"><div class="lmo-option-check">${selectedId === direction.id ? icon('check') : ''}</div><span>经营方向</span><h3>${escapeHtml(direction.name)}</h3><p>${escapeHtml(direction.description)}</p>${tags(direction.tags)}<ul>${direction.opportunities.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></button>`).join('')}</div><div class="lmo-confirm-bar"><div><strong>${selectedId ? '方案已经选定' : '选择一个方向继续'}</strong><span>只有点击确认后，建筑状态才会正式改变。</span></div><button class="lmo-primary" data-action="confirm-takeover" ${selectedId && !busy ? '' : 'disabled'}>确认接管 ${icon('arrow')}</button></div>`}
  </section>`;
}

function ownedSpaceOptions(building, selectedSpaceId, action = 'choose-workflow-space') {
  return building.floors.flatMap(floor => floor.spaces).map(space => `<button class="lmo-compact-space ${selectedSpaceId === space.id ? 'selected' : ''}" data-action="${action}" data-space-id="${escapeHtml(space.id)}"><span>${escapeHtml(space.type)}</span><strong>${escapeHtml(space.name)}</strong><small>${escapeHtml(space.status)} · ${escapeHtml(space.size)}</small></button>`).join('');
}

function renderRenovation(building, task, selectedSpaceId, selectedId, busy) {
  const plans = task?.status === 'ready' ? task.preview.plans : [];
  const space = building.floors.flatMap(floor => floor.spaces).find(item => item.id === selectedSpaceId);
  return `<section class="lmo-view lmo-workflow">${workflowSteps(plans.length ? 2 : selectedSpaceId ? 1 : 0)}
    <div class="lmo-two-column"><aside class="lmo-selector"><span class="lmo-kicker">选择装修目标</span><h2>${escapeHtml(building.name)}</h2><div class="lmo-compact-list">${ownedSpaceOptions(building, selectedSpaceId)}</div></aside>
    <div class="lmo-workspace">${!space ? emptyState('先选择一个空间', '可以从一个房间开始，不需要一次装修整栋建筑。') : !plans.length ? `<div class="lmo-preview-room"><span>${escapeHtml(space.type)} · ${escapeHtml(space.size)}</span><h2>${escapeHtml(space.name)}</h2><p>${escapeHtml(space.description)}</p><div class="lmo-current-style"><small>当前装修</small><strong>${escapeHtml(space.renovation?.风格)}</strong><span>${escapeHtml(space.renovation?.氛围)}</span></div><button class="lmo-primary" data-action="run-renovation" ${busy ? 'disabled' : ''}>${icon('sparkle')} ${busy ? '正在整理…' : '生成三个本地方案'}</button></div>` : `<div class="lmo-renovation-plans">${plans.map(plan => `<button class="lmo-renovation-card ${selectedId === plan.id ? 'selected' : ''}" data-action="choose-option" data-option-id="${escapeHtml(plan.id)}"><div class="lmo-palette">${Object.values(plan.palette).map(color => `<i style="--swatch:${safeColor(color, '#E2E8F0')}"></i>`).join('')}</div><span>${escapeHtml(plan.style)}</span><h3>${escapeHtml(plan.name)}</h3><p>${escapeHtml(plan.tagline)}</p>${tags(plan.impacts)}<small>${escapeHtml(plan.lighting)}</small></button>`).join('')}</div><div class="lmo-confirm-bar"><div><strong>${selectedId ? '装修效果可以具现化' : '挑选最喜欢的方案'}</strong><span>确认后会改变空间描述、配色、材质和事件记录。</span></div><button class="lmo-primary" data-action="confirm-renovation" ${selectedId && !busy ? '' : 'disabled'}>应用装修 ${icon('arrow')}</button></div>`}</div></div>
  </section>`;
}

function renderRecruitment(building, task, selectedSpaceId, selectedId, busy) {
  const candidates = task?.status === 'ready' ? task.preview.candidates : [];
  return `<section class="lmo-view lmo-workflow">${workflowSteps(candidates.length ? 2 : 1)}
    <div class="lmo-generation-callout compact">${icon('recruit')}<div><strong>为「${escapeHtml(building.name)}」寻找新成员</strong><p>候选人来自本地样例，确认前不会出现在人物列表或建筑里。</p></div>${!candidates.length ? `<button class="lmo-primary" data-action="run-recruitment" ${busy ? 'disabled' : ''}>${busy ? '正在整理…' : '生成本地候选人'}</button>` : ''}</div>
    ${candidates.length ? `<div class="lmo-recruit-layout"><div class="lmo-candidate-list">${candidates.map(candidate => `<button class="lmo-candidate ${selectedId === candidate.id ? 'selected' : ''}" data-action="choose-option" data-option-id="${escapeHtml(candidate.id)}" style="--person-accent:${safeColor(candidate.visualIdentity.主色)}"><div class="lmo-avatar">${escapeHtml(candidate.name.slice(0, 1))}</div><div><span>${escapeHtml(candidate.origin)} · ${escapeHtml(candidate.profession)}</span><h3>${escapeHtml(candidate.name)}</h3><p>${escapeHtml(candidate.personality)}</p><blockquote>“${escapeHtml(candidate.quote)}”</blockquote>${tags(candidate.tags)}</div><i class="lmo-option-check">${selectedId === candidate.id ? icon('check') : ''}</i></button>`).join('')}</div><aside class="lmo-placement"><span class="lmo-kicker">安排位置</span><h3>让人物真正进入建筑</h3><p>选择一个空间后，人物档案、门牌和建筑占用记录会同时创建。</p><div class="lmo-compact-list">${ownedSpaceOptions(building, selectedSpaceId, 'choose-recruit-space')}</div></aside></div><div class="lmo-confirm-bar"><div><strong>${selectedId && selectedSpaceId ? '人物与位置已经确定' : '请选择人物和安置位置'}</strong><span>这一步会写入人物、空间和事件三处状态。</span></div><button class="lmo-primary" data-action="confirm-recruitment" ${selectedId && selectedSpaceId && !busy ? '' : 'disabled'}>确认加入 ${icon('arrow')}</button></div>` : emptyState('候选名单尚未生成', '点击上方按钮，用本地模拟数据预览完整流程。')}
  </section>`;
}

function renderEvents(state, portfolio) {
  const events = Object.entries(state.事件列表 ?? {}).reverse();
  return `<section class="lmo-view"><div class="lmo-section-heading"><div><span>BUILDING MEMORY</span><h2>真正发生过的变化</h2></div><p>这里只有确认写入过的操作，不展示临时候选和取消的方案。</p></div>${events.length ? `<div class="lmo-event-timeline">${events.map(([id, event]) => { const building = portfolio.buildings.find(item => item.id === event.建筑ID); return `<article><div class="lmo-event-mark">${icon(event.类型 === '人物加入' ? 'person' : event.类型 === '装修完成' ? 'renovate' : 'buildings')}</div><div><span>${escapeHtml(event.类型)} · ${escapeHtml(building?.name ?? '未知建筑')}</span><h3>${escapeHtml(event.标题)}</h3><p>${escapeHtml(event.摘要)}</p><small>${escapeHtml(event.发生时间)} · ${escapeHtml(id)}</small></div><em>${escapeHtml(event.状态)}</em></article>`; }).join('')}</div>` : emptyState('还没有经营记录', '完成第一次接管、装修或招募后，建筑记忆会出现在这里。')}</section>`;
}

export function renderConsole({ state, portfolio, current, ui, task }) {
  let content;
  if (ui.section === 'portfolio') content = renderPortfolio(state, portfolio);
  else if (ui.section === 'building') content = renderBuilding(current);
  else if (ui.section === 'takeover') content = renderTakeover(ui.targetBuilding, task, ui.selectedOptionId, ui.busy);
  else if (ui.section === 'renovation') content = renderRenovation(current, task, ui.selectedSpaceId, ui.selectedOptionId, ui.busy);
  else if (ui.section === 'recruitment') content = renderRecruitment(current, task, ui.selectedSpaceId, ui.selectedOptionId, ui.busy);
  else content = renderEvents(state, portfolio);

  const displayBuilding = ui.section === 'takeover' ? ui.targetBuilding : current;
  return `<div class="lmo-backdrop" data-action="close-backdrop"><div class="lmo-shell" role="dialog" aria-modal="true" aria-label="房东经营中枢" style="--active-accent:${safeColor(displayBuilding.theme?.主色)}">
    ${renderSidebar(ui, portfolio)}<main class="lmo-main">${renderHeader(displayBuilding, ui)}<div class="lmo-scroll">${ui.notice ? `<div class="lmo-notice ${ui.notice.type}">${escapeHtml(ui.notice.text)}</div>` : ''}${content}</div></main>
  </div></div>`;
}
