import { createRenovationVisual } from '../../renovation/visual-engine.js';
import { compileRenovationProjection } from '../../renovation/projection-engine.js';
import { emptyState, escapeHtml, icon, safeColor, tags } from './template-helpers.js';
import { renderArrivalProjection } from './recruitment-preview-template.js';
import { renderAcquisitionProjection } from './takeover-preview-template.js';
import { renderPortfolioRadar } from './portfolio-radar-template.js';
import { renderPortfolioAssignmentMatrix } from './portfolio-assignment-template.js';
import { renderLifeFlow } from './life-flow-template.js';

function renovationVisualStyle(visual) {
  return `--room-base:${safeColor(visual.css.base)};--room-accent:${safeColor(visual.css.accent)};--room-secondary:${safeColor(visual.css.secondary)};--room-glow:${safeColor(visual.css.glow)};--room-text:${safeColor(visual.css.text, '#283044')}`;
}

function renderRenovationVisual(visual, { compact = false } = {}) {
  const furniture = visual.furniture.length
    ? visual.furniture.map(item => `<i title="${escapeHtml(item.label)}">${escapeHtml(item.marker)}</i>`).join('')
    : '<i class="empty">空</i>';
  return `<div class="lmo-renovation-visual material-${escapeHtml(visual.material)} lighting-${escapeHtml(visual.lightingMode)} ${compact ? 'compact' : ''}" style="${renovationVisualStyle(visual)}"><span class="lmo-visual-light"></span><div class="lmo-visual-room"><em>${escapeHtml(visual.style)}</em><div>${furniture}</div></div><footer>${visual.colors.slice(0, 4).map(color => `<i style="--swatch:${safeColor(color.value)}" title="${escapeHtml(color.name)}"></i>`).join('')}<span>${escapeHtml(visual.atmosphere)}</span></footer></div>`;
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
      ${navItem('pulse', ui.section, '运行脉冲', 'pulse')}
      ${navItem('tenants', ui.section, '租客生活', 'person')}
      ${navItem('twin', ui.section, '数字孪生', 'room')}
      ${navItem('renovation', ui.section, '装修中心', 'renovate')}
      ${navItem('recruitment', ui.section, '招募中心', 'recruit')}
      ${navItem('tasks', ui.section, '任务中心', 'tasks')}
      ${navItem('history', ui.section, '经营回溯', 'history')}
      ${navItem('spatial', ui.section, '空间同步', 'route')}
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
  if (section === 'pulse') return '建筑运行脉冲';
  if (section === 'tenants') return '租客具身生活';
  if (section === 'recruitment') return '跨世界招募中心';
  if (section === 'takeover') return '建筑接管提案';
  if (section === 'tasks') return '统一任务中心';
  if (section === 'history') return '经营时光回溯';
  if (section === 'spatial') return '叙事—空间同步';
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

function renderPortfolioNetwork(portfolio, current) {
  const { nodes, edges, metrics } = portfolio.network;
  const lines = edges.map(edge => `<line class="${escapeHtml(edge.status)}" x1="${edge.fromPoint.x}" y1="${edge.fromPoint.y}" x2="${edge.toPoint.x}" y2="${edge.toPoint.y}" data-network-edge="${escapeHtml(edge.kind)}"/>`).join('');
  const nodeButtons = nodes.map(node => `<button class="lmo-network-node ${node.owned ? 'owned' : 'opportunity'} ${node.current ? 'current' : ''}" data-action="${escapeHtml(node.action)}" data-building-id="${escapeHtml(node.id)}" data-network-status="${escapeHtml(node.status)}" style="left:${node.x}%;top:${node.y}%;--node-accent:${safeColor(node.color)}"><i>${icon(node.headquarters ? 'home' : 'buildings')}</i><span>${escapeHtml(node.current ? '当前焦点' : node.status)}</span><strong>${escapeHtml(node.name)}</strong><small>${node.spaces} 空间 · 活跃 ${node.activity}</small></button>`).join('');
  return `<article class="lmo-portfolio-network">
    <header><div><span>PORTFOLIO NEURAL MAP</span><h2>经营版图神经网络</h2><p>由真实建筑状态即时编译；点击节点即可进入管理或查看接管提案。</p></div><div class="lmo-network-legend"><span><i></i>运营链路</span><span><i></i>接管机会</span></div></header>
    <div class="lmo-network-layout"><div class="lmo-network-stage"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="建筑版图关系链路"><circle cx="50" cy="50" r="31"></circle><circle cx="50" cy="50" r="39"></circle>${lines}</svg>${nodeButtons}</div>
    <aside><span>NETWORK STATUS</span><strong>${escapeHtml(current.name)}</strong><small>当前经营焦点</small><div><p><b>${metrics.owned}</b><small>已接管</small></p><p><b>${metrics.activeRoutes}</b><small>运营链路</small></p><p><b>${metrics.opportunities}</b><small>接管机会</small></p><p><b>${metrics.totalPeople}</b><small>版图人物</small></p></div><em>${escapeHtml(current.summary.今日亮点)}</em></aside></div>
  </article>`;
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
    ${renderPortfolioNetwork(portfolio, current)}
    ${renderPortfolioRadar(state)}
    ${renderPortfolioAssignmentMatrix(state)}
    ${renderLifeFlow(state)}
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

function renderTwinMap(floor, selectedId, accent, layer, pulseMap, tenantMap, memoryMap) {
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
    const operation = pulseMap.get(node.id);
    const tenantReactions = tenantMap.get(node.id) ?? [];
    const spaceMemory = memoryMap.get(node.id);
    const tenantFit = tenantReactions.length ? Math.round(tenantReactions.reduce((sum, item) => sum + item.fit, 0) / tenantReactions.length) : 0;
    const overlayScore = layer === 'pulse' ? operation?.total ?? 0 : layer === 'tenants' ? tenantFit : layer === 'memories' ? spaceMemory?.resonance ?? 0 : node.awareness;
    const overlayLabel = layer === 'pulse'
      ? `${operation?.status ?? '未知'} · ${operation?.total ?? 0}`
      : layer === 'tenants'
        ? (tenantReactions.length ? tenantReactions.map(item => `${item.name} ${item.fit}`).join(' / ') : '等待人物')
        : layer === 'memories'
          ? (spaceMemory?.count ? `${spaceMemory.count} 段回声 · ${spaceMemory.dominantType}` : '尚无生活回声')
          : `${node.type} · ${node.awareness}%`;
    const overlayAccent = layer === 'tenants' && tenantReactions[0]?.color ? tenantReactions[0].color : layer === 'memories' && spaceMemory?.accent ? spaceMemory.accent : accent;
    const classes = [
      `visibility-${escapeHtml(node.visibility)}`,
      `twin-layer-${escapeHtml(layer)}`,
      node.id === selected?.id ? 'selected' : '',
      connected.has(node.id) && node.id !== selected?.id ? 'connected' : '',
    ].filter(Boolean).join(' ');
    return `<button class="${classes} material-${escapeHtml(node.visual.material)} lighting-${escapeHtml(node.visual.lightingMode)}" data-action="inspect-twin-space" data-floor-id="${escapeHtml(floor.id)}" data-space-id="${escapeHtml(node.id)}" data-twin-layer="${escapeHtml(layer)}" data-operation-score="${operation?.total ?? 0}" data-tenant-fit="${tenantFit}" data-memory-count="${spaceMemory?.count ?? 0}" aria-pressed="${node.id === selected?.id}" data-renovation-signature="${escapeHtml(node.visual.signature)}" style="left:${node.x}%;top:${node.y}%;width:${node.w}%;height:${node.h}%;--overlay-score:${overlayScore};--overlay-accent:${safeColor(overlayAccent)};${renovationVisualStyle(node.visual)}"><strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(overlayLabel)}</small>${node.occupants?.length ? `<em>${node.occupants.map(person => escapeHtml(person.name)).join(' / ')}</em>` : ''}${node.visual.furniture.length && layer === 'layout' ? `<span class="lmo-twin-furniture">${node.visual.furniture.slice(0, 4).map(item => `<i title="${escapeHtml(item.label)}">${escapeHtml(item.marker)}</i>`).join('')}</span>` : ''}${layer !== 'layout' ? `<span class="lmo-twin-layer-meter"><i></i><b>${overlayScore}</b></span>` : ''}</button>`;
  }).join('');
  return `<div class="lmo-twin-map" style="--twin-accent:${safeColor(accent)}"><svg class="lmo-twin-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="已知空间相邻关系">${lines}</svg>${nodes}</div>`;
}

function renderTwinInspector(node, floor, layer, pulseMap, tenantMap, memoryMap) {
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
  const operation = pulseMap.get(node.id);
  const tenantReactions = tenantMap.get(node.id) ?? [];
  const spaceMemory = memoryMap.get(node.id);
  const layerDetail = layer === 'pulse' && operation
    ? `<div class="lmo-twin-inspector-block lmo-twin-sensor"><small>空间运行传感</small><div>${Object.entries(operation.metrics).map(([key, value]) => `<span><b>${value}</b>${escapeHtml(pulseMetricMeta[key]?.[0] ?? key)}</span>`).join('')}</div><p>${escapeHtml(operation.status)} · 综合 ${operation.total} · 设施健康 ${operation.facilityHealth}</p></div>`
    : layer === 'tenants'
      ? `<div class="lmo-twin-inspector-block lmo-twin-reactions"><small>正在这里形成的具身反应</small>${tenantReactions.length ? tenantReactions.map(item => `<blockquote style="--person-accent:${safeColor(item.color)}"><strong>${escapeHtml(item.name)} · ${item.fit}</strong><p>${escapeHtml(item.reaction)}</p></blockquote>`).join('') : '<p>当前没有人物在这里；可从租客生活页查看谁更适合搬入。</p>'}</div>`
      : layer === 'memories'
        ? `<div class="lmo-twin-inspector-block lmo-twin-memories"><small>空间记忆回声 · ${spaceMemory?.count ?? 0} 段</small>${spaceMemory?.entries?.length ? spaceMemory.entries.slice(0, 5).map(entry => `<article style="--memory-accent:${safeColor(entry.color)}"><span>${escapeHtml(entry.type)} · ${escapeHtml(entry.occurredAt)}</span><strong>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.summary)}</p>${entry.participantNames.length ? `<em>${escapeHtml(entry.participantNames.join(' × '))}</em>` : ''}</article>`).join('') : '<p>这个空间还没有已确认的生活事件；装修、入住或人物共同场景会留下第一段回声。</p>'}</div>`
        : '';
  return `<aside class="lmo-twin-inspector">
    <div class="lmo-twin-inspector-head"><span>${escapeHtml(node.type)} · ${escapeHtml(node.size)}</span><strong>${escapeHtml(node.name)}</strong><p>${escapeHtml(node.description)}</p></div>
    ${renderRenovationVisual(node.visual, { compact: true })}
    <div class="lmo-twin-data-grid"><span><small>空间状态</small><b>${escapeHtml(node.status)}</b></span><span><small>感知程度</small><b>${node.awareness}%</b></span><span><small>已知设施</small><b>${node.facilityCount ?? 0}</b></span><span><small>装修风格</small><b>${escapeHtml(node.renovation?.风格 ?? '尚未具现')}</b></span></div>
    <div class="lmo-twin-inspector-block"><small>当前用途</small><p>${escapeHtml(node.purpose)}</p></div>
    <div class="lmo-twin-inspector-block"><small>正在这里的人</small><div class="lmo-twin-people">${occupants}</div></div>
    ${layerDetail}
    <div class="lmo-twin-inspector-block"><small>已知相邻空间</small>${connectedNames.length ? tags(connectedNames) : '<p>尚未确认连接关系</p>'}</div>
    <button class="lmo-primary" data-action="select-space" data-space-id="${escapeHtml(node.id)}">${icon('renovate')} 装修这个空间</button>
  </aside>`;
}

function renderTwin(twin, ui, pulse, tenantLife, memory) {
  const floor = twin.floors.find(item => item.id === ui.focusedFloorId)
    ?? twin.floors.find(item => item.nodes.length > 0)
    ?? twin.floors[0]
    ?? null;
  const selected = floor?.nodes.find(node => node.id === ui.twinSpaceId) ?? floor?.nodes[0] ?? null;
  const layer = ['layout', 'pulse', 'tenants', 'memories'].includes(ui.twinLayer) ? ui.twinLayer : 'layout';
  const pulseMap = new Map((pulse?.spaces ?? []).map(space => [space.id, space]));
  const memoryMap = new Map((memory?.spaces ?? []).map(space => [space.id, space]));
  const tenantMap = new Map();
  for (const reaction of tenantLife?.residents ?? []) {
    const list = tenantMap.get(reaction.spaceId) ?? [];
    list.push(reaction);
    tenantMap.set(reaction.spaceId, list);
  }
  const layerCopy = layer === 'pulse' ? '当前显示装修、设施、用途与人物共同形成的运行热力。' : layer === 'tenants' ? '当前显示人物在真实位置上的空间契合与具身反应。' : layer === 'memories' ? `当前显示 ${memory?.totalEvents ?? 0} 段已确认生活事件在真实空间中留下的回声。` : '当前显示确定性空间布局、装修材质与已知连接。';
  return `<section class="lmo-view lmo-twin-view">
    <div class="lmo-section-heading"><div><span>BUILDING DIGITAL TWIN</span><h2>${escapeHtml(twin.name)}·可计算空间镜像</h2></div><p>布局、房间面积与连接均由状态确定性计算；AI 不负责猜坐标。</p></div>
    <div class="lmo-twin-toolbar"><div class="lmo-twin-metrics"><span><b>${twin.metrics.floors}</b>可见楼层</span><span><b>${twin.metrics.nodes}</b>空间节点</span><span><b>${twin.metrics.edges}</b>已知连接</span></div><div class="lmo-twin-layer-switch" aria-label="数字孪生图层"><button class="${layer === 'layout' ? 'active' : ''}" data-action="set-twin-layer" data-layer="layout">空间结构</button><button class="${layer === 'pulse' ? 'active' : ''}" data-action="set-twin-layer" data-layer="pulse">运行体感</button><button class="${layer === 'tenants' ? 'active' : ''}" data-action="set-twin-layer" data-layer="tenants">租客感受</button><button class="${layer === 'memories' ? 'active' : ''}" data-action="set-twin-layer" data-layer="memories">空间记忆</button></div></div>
    <div class="lmo-twin-layer-note">${icon(layer === 'tenants' ? 'person' : layer === 'pulse' ? 'pulse' : layer === 'memories' ? 'history' : 'room')}<span>${escapeHtml(layerCopy)}</span></div>
    <div class="lmo-twin-layout">
      <nav class="lmo-twin-floor-nav" aria-label="数字孪生楼层">${twin.floors.map(item => `<button class="${item.id === floor?.id ? 'active' : ''}" data-action="focus-twin-floor" data-floor-id="${escapeHtml(item.id)}" aria-pressed="${item.id === floor?.id}"><span>${String(item.order).padStart(2, '0')}</span><p><strong>${escapeHtml(item.name)}</strong><small>${item.nodes.length} 空间 · 感知 ${item.awareness}%</small></p></button>`).join('')}</nav>
      <article class="lmo-twin-stage"><header><div><span>FOCUSED FLOOR · ${escapeHtml(layer.toUpperCase())}</span><strong>${escapeHtml(floor?.name ?? '暂无可见楼层')}</strong></div><small>${floor ? `${floor.nodes.length} 个空间 · ${floor.edges.length} 条连接` : '等待探索'}</small></header>${floor?.nodes.length ? renderTwinMap(floor, selected?.id, twin.theme?.主色, layer, pulseMap, tenantMap, memoryMap) : emptyState('暂无可见空间', '继续探索后，空间会进入数字孪生。')}</article>
      ${renderTwinInspector(selected, floor ?? { nodes: [], edges: [] }, layer, pulseMap, tenantMap, memoryMap)}
    </div>
  </section>`;
}

function workflowSteps(active) {
  return `<div class="lmo-workflow-steps"><span class="done"><b>1</b>选择目标</span><i></i><span class="${active >= 2 ? 'done' : ''}"><b>2</b>生成预览</span><i></i><span class="${active >= 3 ? 'done' : ''}"><b>3</b>确认写入</span></div>`;
}

function renderTakeover(state, building, task, selectedId, busy) {
  const mode = taskModeCopy(state);
  const directions = task?.status === 'ready' ? task.preview.directions : [];
  const selectedDirection = directions.find(direction => direction.id === selectedId);
  return `<section class="lmo-view lmo-workflow">${workflowSteps(directions.length ? 2 : 1)}
    <div class="lmo-workflow-intro" style="--building-accent:${safeColor(building.theme?.主色)}"><button class="lmo-text-button" data-action="navigate" data-section="portfolio">${icon('back')} 返回资产总览</button><div><span class="lmo-building-type">${escapeHtml(building.type)}</span><h2>${escapeHtml(building.name)}</h2><p>${escapeHtml(building.description)}</p></div><div class="lmo-facts"><span><b>${building.metrics.floors}</b> 层基础格局</span><span><b>${building.metrics.spaces}</b> 个现有空间</span><span><b>${building.awareness}%</b> 已感知</span></div></div>
    ${!directions.length ? `<div class="lmo-generation-callout">${icon('sparkle')}<div><strong>生成三种接管方向</strong><p>${state.运行模式 === '真实' ? '调用酒馆助手的结构化生成；不读取聊天历史，结果不会自动写入。' : '当前只读取本地固定样例，不会访问聊天记录，也不会调用任何真实 AI。'}</p></div><button class="lmo-primary" data-action="run-takeover" data-building-id="${escapeHtml(building.id)}" ${busy ? 'disabled' : ''}>${busy ? '正在整理…' : `${mode.verb}提案`}</button></div>` : `<div class="lmo-option-grid">${directions.map(direction => `<button class="lmo-option-card ${selectedId === direction.id ? 'selected' : ''}" data-action="choose-option" data-option-id="${escapeHtml(direction.id)}"><div class="lmo-option-check">${selectedId === direction.id ? icon('check') : ''}</div><span>经营方向</span><h3>${escapeHtml(direction.name)}</h3><p>${escapeHtml(direction.description)}</p>${tags(direction.tags)}<ul>${direction.opportunities.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></button>`).join('')}</div>${selectedDirection ? renderAcquisitionProjection(state, building.id, selectedDirection) : ''}<div class="lmo-confirm-bar"><div><strong>${selectedId ? '接管结果已经完成预演' : '选择一个方向继续'}</strong><span>只有点击确认后，建筑状态才会正式改变。</span></div><button class="lmo-primary" data-action="confirm-takeover" ${selectedId && !busy ? '' : 'disabled'}>确认接管 ${icon('arrow')}</button></div>`}
  </section>`;
}

function ownedSpaceOptions(building, selectedSpaceId, action = 'choose-workflow-space') {
  return building.floors.flatMap(floor => floor.spaces).map(space => `<button class="lmo-compact-space ${selectedSpaceId === space.id ? 'selected' : ''}" data-action="${action}" data-space-id="${escapeHtml(space.id)}"><span>${escapeHtml(space.type)}</span><strong>${escapeHtml(space.name)}</strong><small>${escapeHtml(space.status)} · ${escapeHtml(space.size)}</small></button>`).join('');
}

function renderRenovationProjection(twin, space, plan, building) {
  const projection = compileRenovationProjection(twin, space.id, plan, building.theme?.主色);
  if (!projection) return '';
  const nodes = projection.nodes.map(node => `<div class="lmo-hologram-node material-${escapeHtml(node.visual.material)} ${node.projected ? 'projected' : ''}" data-space-id="${escapeHtml(node.id)}" style="left:${node.x}%;top:${node.y}%;width:${node.w}%;height:${node.h}%;${renovationVisualStyle(node.visual)}"><strong>${escapeHtml(node.name)}</strong><small>${node.projected ? '装修投影' : escapeHtml(node.visual.style)}</small></div>`).join('');
  const edges = projection.edges.map(edge => `<line x1="${edge.fromPoint.x}" y1="${edge.fromPoint.y}" x2="${edge.toPoint.x}" y2="${edge.toPoint.y}"/>`).join('');
  return `<article class="lmo-renovation-hologram" data-renovation-projection="${escapeHtml(projection.signature)}"><header><div><span>RENOVATION HOLOGRAM</span><h3>${escapeHtml(projection.floorName)}·装修全息投影</h3><p>方案已经投射进真实数字孪生；此刻仍未写入 MVU。</p></div><em>${projection.nodes.length} 个空间 · 目标 ${escapeHtml(projection.targetName)}</em></header><div class="lmo-hologram-layout"><div class="lmo-hologram-stage"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${edges}</svg>${nodes}</div><aside><span>BEFORE / AFTER</span><div><section><small>当前状态</small>${renderRenovationVisual(projection.before, { compact: true })}</section><section><small>确认之后</small>${renderRenovationVisual(projection.after, { compact: true })}</section></div>${tags(projection.impacts)}<p>只有点击“应用装修”后，空间描述、材质、配色与事件才会一起改变。</p></aside></div></article>`;
}

function renderRenovation(state, building, task, selectedSpaceId, selectedId, busy, twin) {
  const mode = taskModeCopy(state);
  const plans = task?.status === 'ready' ? task.preview.plans : [];
  const space = building.floors.flatMap(floor => floor.spaces).find(item => item.id === selectedSpaceId);
  const selectedPlan = plans.find(plan => plan.id === selectedId);
  const markup = `<section class="lmo-view lmo-workflow">${workflowSteps(plans.length ? 2 : selectedSpaceId ? 1 : 0)}
    <div class="lmo-two-column"><aside class="lmo-selector"><span class="lmo-kicker">选择装修目标</span><h2>${escapeHtml(building.name)}</h2><div class="lmo-compact-list">${ownedSpaceOptions(building, selectedSpaceId)}</div></aside>
    <div class="lmo-workspace">${!space ? emptyState('先选择一个空间', '可以从一个房间开始，不需要一次装修整栋建筑。') : !plans.length ? `<div class="lmo-preview-room"><span>${escapeHtml(space.type)} · ${escapeHtml(space.size)}</span><h2>${escapeHtml(space.name)}</h2><p>${escapeHtml(space.description)}</p><div class="lmo-current-style"><small>当前装修</small><strong>${escapeHtml(space.renovation?.风格)}</strong><span>${escapeHtml(space.renovation?.氛围)}</span></div><button class="lmo-primary" data-action="run-renovation" ${busy ? 'disabled' : ''}>${icon('sparkle')} ${busy ? '正在整理…' : `${mode.verb}方案`}</button></div>` : `<div class="lmo-renovation-plans">${plans.map(plan => { const visual = createRenovationVisual(plan, { fallbackAccent: building.theme?.主色 }); return `<button class="lmo-renovation-card ${selectedId === plan.id ? 'selected' : ''}" data-action="choose-option" data-option-id="${escapeHtml(plan.id)}" data-renovation-signature="${escapeHtml(visual.signature)}">${renderRenovationVisual(visual, { compact: true })}<span>${escapeHtml(plan.style)}</span><h3>${escapeHtml(plan.name)}</h3><p>${escapeHtml(plan.tagline)}</p>${tags(plan.impacts)}<small>${escapeHtml(plan.lighting)}</small></button>`; }).join('')}</div>${selectedPlan ? renderRenovationProjection(twin, space, selectedPlan, building) : ''}<div class="lmo-confirm-bar"><div><strong>${selectedId ? '装修效果已经投射到数字孪生' : '挑选最喜欢的方案'}</strong><span>确认后会改变空间描述、配色、材质和事件记录。</span></div><button class="lmo-primary" data-action="confirm-renovation" ${selectedId && !busy ? '' : 'disabled'}>应用装修 ${icon('arrow')}</button></div>`}</div></div>
  </section>`;
  return markup;
}

function renderRecruitment(state, building, task, selectedSpaceId, selectedId, busy) {
  const mode = taskModeCopy(state);
  const candidates = task?.status === 'ready' ? task.preview.candidates : [];
  const selectedCandidate = candidates.find(candidate => candidate.id === selectedId);
  return `<section class="lmo-view lmo-workflow">${workflowSteps(candidates.length ? 2 : 1)}
    <div class="lmo-generation-callout compact">${icon('recruit')}<div><strong>为「${escapeHtml(building.name)}」寻找新成员</strong><p>候选人只是预览，确认前不会出现在人物列表或建筑里。</p></div>${!candidates.length ? `<button class="lmo-primary" data-action="run-recruitment" ${busy ? 'disabled' : ''}>${busy ? '正在整理…' : `${mode.verb}候选人`}</button>` : ''}</div>
    ${candidates.length ? `<div class="lmo-recruit-layout"><div class="lmo-candidate-list">${candidates.map(candidate => `<button class="lmo-candidate ${selectedId === candidate.id ? 'selected' : ''}" data-action="choose-option" data-option-id="${escapeHtml(candidate.id)}" style="--person-accent:${safeColor(candidate.visualIdentity.主色)}"><div class="lmo-avatar">${escapeHtml(candidate.name.slice(0, 1))}</div><div><span>${escapeHtml(candidate.origin)} · ${escapeHtml(candidate.profession)}</span><h3>${escapeHtml(candidate.name)}</h3><p>${escapeHtml(candidate.personality)}</p><blockquote>“${escapeHtml(candidate.quote)}”</blockquote>${tags(candidate.tags)}</div><i class="lmo-option-check">${selectedId === candidate.id ? icon('check') : ''}</i></button>`).join('')}</div><aside class="lmo-placement"><span class="lmo-kicker">安排位置</span><h3>让人物真正进入建筑</h3><p>选择一个空间后，人物档案、门牌和建筑占用记录会同时创建。</p><div class="lmo-compact-list">${ownedSpaceOptions(building, selectedSpaceId, 'choose-recruit-space')}</div></aside></div>${selectedCandidate && selectedSpaceId ? renderArrivalProjection(state, building.id, selectedSpaceId, selectedCandidate) : ''}<div class="lmo-confirm-bar"><div><strong>${selectedId && selectedSpaceId ? '入住效果已经完成预演' : '请选择人物和安置位置'}</strong><span>这一步会写入人物、空间和事件三处状态。</span></div><button class="lmo-primary" data-action="confirm-recruitment" ${selectedId && selectedSpaceId && !busy ? '' : 'disabled'}>确认加入 ${icon('arrow')}</button></div>` : emptyState('候选名单尚未生成', '点击上方按钮，用本地模拟数据预览完整流程。')}
  </section>`;
}

const pulseMetricMeta = Object.freeze({
  comfort: ['舒适体感', '空间是否让人愿意停留'],
  function: ['功能兑现', '设施与用途是否真正可用'],
  vitality: ['生活活力', '人物是否让建筑运转起来'],
  appeal: ['空间吸引', '装修是否形成独特记忆点'],
});

function renderPulse(pulse, ui) {
  const selected = pulse.scenes.find(scene => scene.id === ui.selectedPulseSceneId && !scene.activated);
  return `<section class="lmo-view lmo-pulse-view">
    <div class="lmo-section-heading"><div><span>BUILDING NEURAL PULSE</span><h2>建筑不是房间清单，而是一套正在运行的生活系统</h2></div><p>所有数值都从 MVU 里的装修、设施、人物和用途实时计算；不调用 AI，也不制造硬性惩罚。</p></div>
    <article class="lmo-pulse-hero" data-pulse-signature="${escapeHtml(pulse.signature)}"><div class="lmo-pulse-orb" style="--pulse-total:${pulse.total}"><span>${pulse.total}</span><small>综合脉冲</small><i></i><i></i></div><div><span>LIVE STATE · ${escapeHtml(pulse.signature)}</span><h3>${escapeHtml(pulse.buildingName)}正在「${escapeHtml(pulse.state)}」</h3><p>${pulse.residentCount} 位人物、${pulse.originCount} 种来源世界和 ${pulse.spaces.length} 个已知空间共同构成此刻的建筑体感。装修或招募发生变化，这里会立即重新计算。</p></div></article>
    <div class="lmo-pulse-metrics">${Object.entries(pulse.metrics).map(([key, value]) => `<article style="--score:${value};--metric-accent:var(--active-accent)"><div><span>${value}</span><i></i></div><p><strong>${escapeHtml(pulseMetricMeta[key]?.[0] ?? key)}</strong><small>${escapeHtml(pulseMetricMeta[key]?.[1] ?? '')}</small></p></article>`).join('')}</div>
    <div class="lmo-pulse-layout"><article class="lmo-panel"><div class="lmo-panel-title"><div>${icon('pulse')}<span><strong>空间体感矩阵</strong><small>不是账单：它告诉你下一处值得装修或放人的空间</small></span></div></div><div class="lmo-pulse-space-list">${pulse.spaces.map(space => `<div class="status-${escapeHtml(space.status)}"><span><b>${space.total}</b><small>${escapeHtml(space.status)}</small></span><p><strong>${escapeHtml(space.name)}</strong><small>${escapeHtml(space.purpose)} · ${space.occupantNames.length ? escapeHtml(space.occupantNames.join('、')) : '等待人物进入'}</small></p><div><i title="舒适" style="--mini:${space.metrics.comfort}"></i><i title="功能" style="--mini:${space.metrics.function}"></i><i title="活力" style="--mini:${space.metrics.vitality}"></i><i title="吸引" style="--mini:${space.metrics.appeal}"></i></div></div>`).join('')}</div></article>
      <aside class="lmo-panel lmo-synergy-panel"><div class="lmo-panel-title"><div>${icon('sparkle')}<span><strong>建筑协同效应</strong><small>装修、人物与设施组合后出现的额外价值</small></span></div></div>${pulse.synergies.length ? `<div class="lmo-synergy-list">${pulse.synergies.map(item => `<div><span>${escapeHtml(item.level)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p></div>`).join('')}</div>` : emptyState('协同仍在孕育', '完成一次装修并安排人物进入，就会出现第一组人屋共鸣。')}</aside></div>
    <div class="lmo-section-heading compact"><div><span>PLAYABLE MOMENTS</span><h2>从真实建筑状态里长出来的今日舞台</h2></div><p>点击只会选中预览；再次确认才会更新人物状态、建筑记忆和四频道草稿。</p></div>
    <div class="lmo-scene-grid">${pulse.scenes.map(scene => `<button class="lmo-scene-card ${scene.id === ui.selectedPulseSceneId ? 'selected' : ''} ${scene.activated ? 'activated' : ''}" data-action="choose-pulse-scene" data-scene-id="${escapeHtml(scene.id)}" ${scene.activated ? 'disabled' : ''}><header><span>${escapeHtml(scene.kind)}</span><em>${scene.activated ? '已经发生' : escapeHtml(scene.spaceName)}</em></header><h3>${escapeHtml(scene.title)}</h3><p>${escapeHtml(scene.tagline)}</p>${tags(scene.impacts)}<small>${escapeHtml(scene.summary)}</small></button>`).join('')}</div>
    ${selected ? `<div class="lmo-confirm-bar lmo-pulse-confirm"><div><strong>准备点亮「${escapeHtml(selected.title)}」</strong><span>确认后才会把它写成真正发生过的建筑场景；随后仍可从经营回溯撤销。</span></div><button class="lmo-primary" data-action="confirm-pulse-scene" ${ui.busy ? 'disabled' : ''}>确认点亮 ${icon('sparkle')}</button></div>` : ''}
  </section>`;
}

function renderRelationshipNetwork(relationshipCenter) {
  const network = relationshipCenter.network;
  if (!network || network.nodes.length < 2) return '';
  const nodes = new Map(network.nodes.map(node => [node.id, node]));
  const edgeMarkup = network.edges.map(edge => {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target) return '';
    return `<line class="lmo-social-edge ${edge.type}" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" style="--edge-score:${edge.score}" data-relationship-edge="${escapeHtml(edge.id)}"><title>${escapeHtml(`${source.name} × ${target.name}｜${edge.label}`)}</title></line>`;
  }).join('');
  const clusterMarkup = network.clusters.map(cluster => `<g class="lmo-social-cluster"><circle cx="${cluster.x}" cy="${cluster.y}" r="62"></circle><text x="${cluster.x}" y="${Math.min(network.height - 8, cluster.y + 104)}">${escapeHtml(cluster.name)} · ${cluster.count}</text></g>`).join('');
  const nodeMarkup = network.nodes.map(node => `<g class="lmo-social-node" transform="translate(${node.x} ${node.y})" style="--person-accent:${safeColor(node.color)}" data-person-id="${escapeHtml(node.id)}"><circle class="lmo-social-node-halo" r="${24 + Math.min(8, node.degree * 2)}"></circle><circle class="lmo-social-node-core" r="19"></circle><text class="lmo-social-node-avatar" y="4">${escapeHtml(node.name.slice(0, 1))}</text><text class="lmo-social-node-name" y="36">${escapeHtml(node.name)}</text><title>${escapeHtml(`${node.name}｜${node.origin} · ${node.profession}｜${node.spaceName}`)}</title></g>`).join('');
  const activeEdges = network.edges.slice(0, 4);
  return `<section class="lmo-social-constellation" data-network-signature="${escapeHtml(network.signature)}">
    <div class="lmo-section-heading compact"><div><span>SOCIAL CONSTELLATION</span><h2>关系星图 · 建筑里的人正在形成自己的引力</h2></div><p>实线是已确认关系，虚线是同处一室产生的可能；人物移动后网络会重新计算。</p></div>
    <div class="lmo-social-layout"><div class="lmo-social-stage"><svg viewBox="0 0 ${network.width} ${network.height}" role="img" aria-label="${escapeHtml(`${relationshipCenter.buildingName}关系星图`)}"><defs><filter id="lmo-social-glow"><feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs>${clusterMarkup}<g class="lmo-social-edges">${edgeMarkup}</g><g class="lmo-social-nodes">${nodeMarkup}</g></svg></div>
      <aside class="lmo-social-inspector"><span>LIVE GRAPH</span><strong>${network.metrics.people} 个人物 / ${network.metrics.spaces} 个生活空间</strong><div class="lmo-social-metrics"><p><b>${network.metrics.confirmed}</b><small>确认关系</small></p><p><b>${network.metrics.potential}</b><small>潜在火花</small></p><p><b>${network.metrics.crossWorld}</b><small>跨世界连接</small></p></div>${activeEdges.length ? `<div class="lmo-social-edge-list">${activeEdges.map(edge => { const source = nodes.get(edge.source); const target = nodes.get(edge.target); return `<p><i class="${edge.type}"></i><span><b>${escapeHtml(source?.name ?? '')} × ${escapeHtml(target?.name ?? '')}</b><small>${escapeHtml(edge.label)}</small></span></p>`; }).join('')}</div>` : '<small>让两位租客进入同一个空间，第一条关系连线就会出现。</small>'}</aside>
    </div>
  </section>`;
}

function renderRelationshipScenes(relationshipCenter, ui) {
  if (!relationshipCenter.scenes?.length) return '';
  const selected = relationshipCenter.scenes.find(scene => scene.id === ui.selectedRelationshipSceneId && !scene.recorded);
  return `<section class="lmo-duo-scenes"><div class="lmo-section-heading compact"><div><span>DUO SCENE COMPOSER</span><h2>双人生活导演台 · 把关系变成真正发生的共同生活</h2></div><p>场景启动时会同时校验两个人的位置，再把双方移动到目标空间。</p></div>
    <div class="lmo-duo-scene-grid">${relationshipCenter.scenes.map(scene => `<button class="lmo-duo-scene-card ${scene.id === ui.selectedRelationshipSceneId ? 'selected' : ''} ${scene.recorded ? 'recorded' : ''}" data-action="choose-relationship-scene" data-scene-id="${escapeHtml(scene.id)}" ${scene.recorded ? 'disabled' : ''}><header><span>${escapeHtml(scene.label)}</span><em>${escapeHtml(scene.destination.name)} · ${scene.destination.score} 空间分</em></header><div class="lmo-duo-people">${scene.people.map(person => `<i style="--person-accent:${safeColor(person.color)}">${escapeHtml(person.name.slice(0, 1))}</i>`).join('')}<strong>${escapeHtml(scene.people.map(person => person.name).join(' × '))}</strong></div><h3>${escapeHtml(scene.title)}</h3><p>${escapeHtml(scene.summary)}</p><footer><span>${escapeHtml(scene.relationshipLabel)}</span><em>${scene.recorded ? '场景已发生' : '编排这个场景'}</em></footer></button>`).join('')}</div>
    ${selected ? `<div class="lmo-confirm-bar lmo-duo-scene-confirm"><div><strong>启动「${escapeHtml(selected.title)}」</strong><span>确认后两人会一起前往${escapeHtml(selected.destination.name)}；若任意一人位置已变化，本次编排自动失效。</span></div><button class="lmo-primary" data-action="confirm-relationship-scene" ${ui.busy ? 'disabled' : ''}>启动共同生活 ${icon('sparkle')}</button></div>` : ''}
  </section>`;
}

function renderTenantAutonomy(autonomyCenter, ui) {
  if (!autonomyCenter.proposals?.length) return '';
  const selected = autonomyCenter.proposals.find(item => item.id === ui.selectedAutonomyProposalId);
  return `<section class="lmo-autonomy-center" data-autonomy-signature="${escapeHtml(autonomyCenter.signature)}"><div class="lmo-section-heading compact"><div><span>TENANT FREE WILL</span><h2>租客自主行动 · 他们会产生想法，但不会夺走你的控制权</h2></div><p>提案来自人物职业、性格和建筑真实状态；不调用 AI，批准前不移动任何人。</p></div>
    <div class="lmo-autonomy-grid">${autonomyCenter.proposals.map(proposal => `<button class="lmo-autonomy-card ${proposal.id === ui.selectedAutonomyProposalId ? 'selected' : ''}" data-action="choose-autonomy-proposal" data-proposal-id="${escapeHtml(proposal.id)}" style="--person-accent:${safeColor(proposal.person.color)}"><header><i>${escapeHtml(proposal.person.name.slice(0, 1))}</i><p><span>${escapeHtml(proposal.person.origin)} · ${escapeHtml(proposal.person.profession)}</span><strong>${escapeHtml(proposal.title)}</strong></p><b>${proposal.destination.score}</b></header><div class="lmo-autonomy-route"><span>${escapeHtml(proposal.source.name)}</span>${icon('arrow')}<strong>${escapeHtml(proposal.destination.name)}</strong></div><p>${escapeHtml(proposal.summary)}</p><ul>${proposal.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul><footer><span>${escapeHtml(proposal.activity)}</span><em>批准这次行动</em></footer></button>`).join('')}</div>
    ${selected ? `<div class="lmo-confirm-bar lmo-autonomy-confirm"><div><strong>让${escapeHtml(selected.person.name)}去${escapeHtml(selected.destination.name)}</strong><span>这只是下一段生活行动，不是永久搬家；位置变化会让旧提案自动失效。</span></div><button class="lmo-primary" data-action="confirm-autonomy-proposal" ${ui.busy ? 'disabled' : ''}>批准自主行动 ${icon('arrow')}</button></div>` : ''}
  </section>`;
}

function renderTenantLife(tenantLife, autonomyCenter, relationshipCenter, ui) {
  const selected = tenantLife.residents.find(item => item.id === ui.selectedReactionId && !item.recorded);
  const selectedSpark = relationshipCenter.sparks.find(item => item.id === ui.selectedRelationshipSparkId && !item.recorded);
  return `<section class="lmo-view lmo-tenant-life-view">
    <div class="lmo-section-heading"><div><span>TENANT EMBODIMENT ENGINE</span><h2>同一间房，换一个人就会产生完全不同的生活反应</h2></div><p>代码读取人物职业、性格、来源世界和房间真实状态；确认前不写人物，不调用 AI。</p></div>
    <article class="lmo-tenant-life-hero" data-embodiment-signature="${escapeHtml(tenantLife.signature)}"><div>${icon('person')}<span><strong>${tenantLife.residents.length}</strong><small>位具身人物</small></span></div><p><span>不是统一满意度</span><strong>${escapeHtml(tenantLife.buildingName)}里的每个人，都用自己的偏好感受建筑</strong><small>装修决定空间提供什么，人物决定什么细节会被真正看见。</small></p><code>${escapeHtml(tenantLife.signature)}</code></article>
    ${tenantLife.encounters.length ? `<div class="lmo-encounter-strip">${tenantLife.encounters.map(item => `<article>${icon('sparkle')}<p><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.summary)}</small></p><span>${escapeHtml(item.names.join(' × '))}</span></article>`).join('')}</div>` : ''}
    ${renderTenantAutonomy(autonomyCenter, ui)}
    ${relationshipCenter.sparks.length ? `<div class="lmo-section-heading compact"><div><span>RELATIONSHIP SPARKS</span><h2>只有真的在同一间房里，关系才有发生地点</h2></div><p>分数用于解释这次相遇的潜力，不会每天衰减，也不会强制失败。</p></div><div class="lmo-relationship-grid">${relationshipCenter.sparks.map(spark => `<button class="lmo-relationship-card ${spark.id === ui.selectedRelationshipSparkId ? 'selected' : ''} ${spark.recorded ? 'recorded' : ''}" data-action="choose-relationship-spark" data-spark-id="${escapeHtml(spark.id)}" style="--score:${spark.score}" ${spark.recorded ? 'disabled' : ''}><header><div>${spark.people.map(person => `<i style="--person-accent:${safeColor(person.color)}">${escapeHtml(person.name.slice(0, 1))}</i>`).join('')}</div><span><b>${spark.score}</b><small>火花强度</small></span></header><strong>${escapeHtml(spark.title)}</strong><p>${escapeHtml(spark.summary)}</p><ul>${spark.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul><footer><span>${escapeHtml(spark.spaceName)}</span><em>${spark.recorded ? '已经记录' : spark.existing.left || spark.existing.right ? `现有：${escapeHtml(spark.existing.left || spark.existing.right)}` : '新的关系可能'}</em></footer></button>`).join('')}</div>` : ''}
    ${selectedSpark ? `<div class="lmo-confirm-bar lmo-relationship-confirm"><div><strong>确认「${escapeHtml(selectedSpark.title)}」</strong><span>只在两人仍处于${escapeHtml(selectedSpark.spaceName)}时双向写入关系，并创建正文、微信和建筑草稿。</span></div><button class="lmo-primary" data-action="confirm-relationship-spark" ${ui.busy ? 'disabled' : ''}>记录关系火花 ${icon('sparkle')}</button></div>` : ''}
    ${renderRelationshipNetwork(relationshipCenter)}
    ${renderRelationshipScenes(relationshipCenter, ui)}
    ${tenantLife.residents.length ? `<div class="lmo-tenant-life-grid">${tenantLife.residents.map(person => `<button class="lmo-tenant-life-card ${person.id === ui.selectedReactionId ? 'selected' : ''} ${person.recorded ? 'recorded' : ''}" data-action="choose-tenant-reaction" data-reaction-id="${escapeHtml(person.id)}" style="--person-accent:${safeColor(person.color)}" ${person.recorded ? 'disabled' : ''}><header><i>${escapeHtml(person.name.slice(0, 1))}</i><p><span>${escapeHtml(person.origin)} · ${escapeHtml(person.profession)}</span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.spaceName)} · ${escapeHtml(person.state)}</small></p><div style="--fit:${person.fit}"><b>${person.fit}</b><small>契合</small></div></header><blockquote>${escapeHtml(person.reaction)}</blockquote><div class="lmo-tenant-preferences"><small>识别偏好</small>${tags(person.preferenceTags)}</div>${person.matchedTags.length ? `<div class="lmo-tenant-matches"><small>房间已回应</small>${tags(person.matchedTags)}</div>` : ''}<footer>${person.alternatives.length ? `<span>更适合：${person.alternatives.map(item => `${escapeHtml(item.spaceName)} +${item.delta}`).join(' / ')}</span>` : '<span>当前已经是最合适的已知空间</span>'}<em>${person.recorded ? '感受已记录' : '选择这份反应'}</em></footer></button>`).join('')}</div>` : emptyState('建筑里还没有具身人物', '先从招募中心让一位人物进入建筑，再回来观察其真实空间反应。')}
    ${selected ? `<div class="lmo-confirm-bar lmo-tenant-confirm"><div><strong>记录${escapeHtml(selected.name)}此刻的感受</strong><span>确认后会写入人物生活状态，并创建正文、微信与建筑草稿；位置变化会使旧反应自动失效。</span></div><button class="lmo-primary" data-action="confirm-tenant-reaction" ${ui.busy ? 'disabled' : ''}>确认记录 ${icon('arrow')}</button></div>` : ''}
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

function renderContextCapsule(capsule, ui, capabilities) {
  if (!capsule) return '';
  return `<article class="lmo-context-capsule ${ui.contextCapsuleVisible ? 'expanded' : ''}" data-context-capsule="${escapeHtml(capsule.signature)}"><header><div>${icon('sparkle')}<span><small>NEXT TURN STATE CAPSULE</small><strong>只把当前正文真正需要的建筑事实交给 AI</strong></span></div><code>${escapeHtml(capsule.signature)}</code></header><div class="lmo-capsule-metrics"><span><b>${capsule.spaceCount}</b>空间</span><span><b>${capsule.residentCount}</b>人物</span><span><b>${capsule.eventCount}</b>近期变化</span><span><b>${capsule.chars}</b>字符</span><span><b>≈${capsule.estimatedTokens}</b>tokens</span></div><p>它不是整份 MVU，也不是常驻世界书：只编译「${escapeHtml(capsule.buildingName)}」当前相关事实，并以 once / system / depth 0 注入下一次生成。</p>${ui.contextCapsuleVisible ? `<pre>${escapeHtml(capsule.content)}</pre>` : ''}<footer><span>${capabilities.正文 ? '正文注入接口已就绪；确认前不会发送。' : '正文注入接口尚未就绪，只能预览。'}</span><button class="lmo-secondary" data-action="toggle-context-capsule">${ui.contextCapsuleVisible ? '收起内容' : '预览胶囊'}</button>${ui.contextCapsuleVisible ? `<button class="lmo-primary" data-action="inject-context-capsule" ${capabilities.正文 ? '' : 'disabled'}>一次性注入正文 ${icon('arrow')}</button>` : ''}</footer></article>`;
}

function renderEvents(state, portfolio, linkCenter, contextCapsule, ui) {
  const events = Object.entries(state.事件列表 ?? {}).reverse();
  const channels = ['正文', '微信', '新闻', '建筑'];
  return `<section class="lmo-view"><div class="lmo-section-heading"><div><span>BUILDING MEMORY</span><h2>真正发生过的变化</h2></div><p>这里只有确认写入过的操作，不展示临时候选和取消的方案。</p></div>
    ${renderContextCapsule(contextCapsule, ui, linkCenter.capabilities)}
    <div class="lmo-link-channels">${channels.map(channel => `<div class="${linkCenter.capabilities[channel] ? '' : 'unavailable'}"><span>${escapeHtml(channel)}</span><strong>${linkCenter.counts[channel] ?? 0}</strong><small>${linkCenter.capabilities[channel] ? '待分发联动' : '频道未就绪'}</small>${linkCenter.counts[channel] ? `<button data-action="preview-channel-links" data-channel="${escapeHtml(channel)}">预览本批次</button>` : ''}</div>`).join('')}</div>
    ${renderLinkPreview(linkCenter)}
    <article class="lmo-panel"><div class="lmo-panel-title"><div>${icon('sparkle')}<span><strong>跨系统联动队列</strong><small>正文、微信、新闻和建筑使用同一个事件源</small></span></div></div>${linkCenter.pending.length ? `<div class="lmo-link-list">${linkCenter.pending.map(item => `<div><span>${escapeHtml(item.频道)}</span><p><strong>${escapeHtml(item.标题)}</strong><small>${escapeHtml(item.摘要)}</small></p><button data-action="preview-link" data-link-id="${escapeHtml(item.id)}">预览</button><button data-action="consume-link" data-link-id="${escapeHtml(item.id)}">已读</button><button data-action="ignore-link" data-link-id="${escapeHtml(item.id)}">忽略</button></div>`).join('')}</div>` : emptyState('联动队列已清空', '新的经营变化会自动投递到四个频道。')}</article>
    ${events.length ? `<div class="lmo-event-timeline">${events.map(([id, event]) => { const building = portfolio.buildings.find(item => item.id === event.建筑ID); return `<article><div class="lmo-event-mark">${icon(event.类型 === '人物加入' ? 'person' : event.类型 === '装修完成' ? 'renovate' : 'buildings')}</div><div><span>${escapeHtml(event.类型)} · ${escapeHtml(building?.name ?? '未知建筑')}</span><h3>${escapeHtml(event.标题)}</h3><p>${escapeHtml(event.摘要)}</p><small>${escapeHtml(event.发生时间)} · ${escapeHtml(id)}</small></div><em>${escapeHtml(event.状态)}</em></article>`; }).join('')}</div>` : emptyState('还没有经营记录', '完成第一次接管、装修或招募后，建筑记忆会出现在这里。')}</section>`;
}

const operationKindLabels = Object.freeze({
  takeover: '建筑接管', renovation: '空间装修', recruitment: '人物招募', exploration: '探索感知', movement: '人物移动', autonomy: '自主行动', scene: '建筑场景', reaction: '人物感受', relationship: '关系火花', 'relationship-scene': '双人生活', management: '经营操作',
});

function renderSpatial(spatialCenter, current, ui) {
  const selectedPerson = spatialCenter.people.find(person => person.id === ui.selectedMovePersonId);
  const selectedSpace = spatialCenter.spaces.find(space => space.buildingId === ui.selectedMoveBuildingId && space.id === ui.selectedMoveSpaceId);
  const narrativeAi = spatialCenter.narrativeMode === 'ai';
  return `<section class="lmo-view lmo-spatial-view">
    <div class="lmo-section-heading"><div><span>NARRATIVE · SPACE SYNC</span><h2>让人物位置先通过建筑结构校验</h2></div><p>手动选择、本地解析和显式 AI 提取最终都会进入同一份待确认提案。</p></div>
    <article class="lmo-narrative-intake"><div class="lmo-narrative-copy">${icon('sparkle')}<span><small>剧情 → 结构化移动</small><strong>粘贴一段剧情，让系统寻找“谁去了哪里”</strong><p>${narrativeAi ? '当前使用显式 AI 结构化提取；只发送这段文字和可用 ID 索引，不自动读取聊天历史。' : '当前使用本地姓名与房间匹配；完全不调用 AI，适合先验证空间同步。'}</p></span></div><textarea id="lmo-narrative-fragment" maxlength="1200" placeholder="例如：林夏走进花园，正在观察来自另一个世界的植物。"></textarea><footer><span>${ui.lastNarrativeExtraction ? `上次${ui.lastNarrativeExtraction.mode === 'ai' ? 'AI' : '本地'}提取 ${ui.lastNarrativeExtraction.count} 条，${ui.lastNarrativeExtraction.unresolved} 条待辨认` : '提取结果只会进入待确认队列'}</span><button class="lmo-primary" data-action="extract-narrative-intents" ${narrativeAi && !spatialCenter.narrativeCapabilities.ai ? 'disabled' : ''}>${narrativeAi ? 'AI 提取意图' : '本地提取意图'} ${icon('arrow')}</button></footer></article>
    <div class="lmo-spatial-metrics"><span><b>${spatialCenter.counts.待确认 ?? 0}</b>待确认</span><span><b>${spatialCenter.counts.冲突 ?? 0}</b>结构冲突</span><span><b>${spatialCenter.counts.已应用 ?? 0}</b>已同步</span></div>
    <article class="lmo-spatial-planner">
      <div class="lmo-spatial-column"><span class="lmo-kicker">1 · 选择人物</span>${spatialCenter.people.length ? `<div class="lmo-spatial-people">${spatialCenter.people.map(person => `<button class="${person.id === ui.selectedMovePersonId ? 'selected' : ''}" data-action="choose-spatial-person" data-person-id="${escapeHtml(person.id)}" style="--person-accent:${safeColor(person.color)}"><i>${escapeHtml(person.name.slice(0, 1))}</i><p><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.buildingName)} · ${escapeHtml(person.spaceName)}</small></p></button>`).join('')}</div>` : emptyState('还没有可移动的人物', '先从招募中心让一位人物进入建筑。')}</div>
      <div class="lmo-spatial-arrow">${icon('arrow')}</div>
      <div class="lmo-spatial-column"><span class="lmo-kicker">2 · 选择目标</span><div class="lmo-spatial-spaces">${spatialCenter.spaces.map(space => `<button class="${space.buildingId === ui.selectedMoveBuildingId && space.id === ui.selectedMoveSpaceId ? 'selected' : ''}" data-action="choose-spatial-space" data-building-id="${escapeHtml(space.buildingId)}" data-space-id="${escapeHtml(space.id)}"><span>${escapeHtml(space.buildingName)} · ${escapeHtml(space.floorName)}</span><strong>${escapeHtml(space.name)}</strong><small>${escapeHtml(space.type)} · ${escapeHtml(space.status)}${space.currentBuilding ? ' · 当前建筑' : ' · 跨建筑'}</small></button>`).join('')}</div></div>
      <div class="lmo-spatial-arrow">${icon('arrow')}</div>
      <div class="lmo-spatial-submit"><span class="lmo-kicker">3 · 描述当前动作</span><div><small>移动预览</small><strong>${escapeHtml(selectedPerson?.name ?? '待选人物')} → ${escapeHtml(selectedSpace ? `${selectedSpace.buildingName}·${selectedSpace.name}` : '待选空间')}</strong></div><label for="lmo-spatial-activity">到达后正在做什么</label><input id="lmo-spatial-activity" value="适应新环境" maxlength="40"><button class="lmo-primary" data-action="propose-spatial-move" ${selectedPerson && selectedSpace ? '' : 'disabled'}>${icon('route')} 校验移动意图</button><p>建筑内与跨建筑移动都会先生成路线提案，不会直接改动人物位置。</p></div>
    </article>
    <article class="lmo-panel"><div class="lmo-panel-title"><div>${icon('route')}<span><strong>空间同步提案</strong><small>结构合法才允许确认；冲突不会写入 MVU</small></span></div></div>${spatialCenter.proposals.length ? `<div class="lmo-spatial-proposals">${spatialCenter.proposals.map(proposal => `<div class="status-${escapeHtml(proposal.status)}"><span>${proposal.status === '冲突' ? '!' : proposal.route.path.length}</span><p><strong>${escapeHtml(proposal.route.personName ?? proposal.personId)} → ${escapeHtml(proposal.route.destinationName ?? proposal.spaceId)}</strong><small>${escapeHtml(proposal.route.kind ?? '无法规划')} · ${escapeHtml(proposal.reason)} · ${escapeHtml(proposal.activity)}</small></p><em>${escapeHtml(proposal.status)}</em>${proposal.status === '待确认' ? `<button data-action="confirm-spatial-proposal" data-proposal-id="${escapeHtml(proposal.id)}">确认同步</button>` : ''}${['待确认','冲突'].includes(proposal.status) ? `<button data-action="ignore-spatial-proposal" data-proposal-id="${escapeHtml(proposal.id)}">忽略</button>` : ''}</div>`).join('')}</div>` : emptyState('还没有空间同步提案', '选择人物和任意已接管建筑中的目标空间，先用本地规则验证。')}</article>
  </section>`;
}

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

export function renderConsole({ state, portfolio, current, ui, task, taskCenter, linkCenter, identityCenter, contextCapsule, historyCenter, spatialCenter, tenantLife, autonomyCenter, relationshipCenter, memory, pulse, twin }) {
  let content;
  if (ui.section === 'portfolio') content = renderPortfolio(state, portfolio);
  else if (ui.section === 'building') content = renderBuilding(current, identityCenter);
  else if (ui.section === 'pulse') content = renderPulse(pulse, ui);
  else if (ui.section === 'tenants') content = renderTenantLife(tenantLife, autonomyCenter, relationshipCenter, ui);
  else if (ui.section === 'twin') content = renderTwin(twin, ui, pulse, tenantLife, memory);
  else if (ui.section === 'takeover') content = renderTakeover(state, ui.targetBuilding, task, ui.selectedOptionId, ui.busy);
  else if (ui.section === 'renovation') content = renderRenovation(state, current, task, ui.selectedSpaceId, ui.selectedOptionId, ui.busy, twin);
  else if (ui.section === 'recruitment') content = renderRecruitment(state, current, task, ui.selectedSpaceId, ui.selectedOptionId, ui.busy);
  else if (ui.section === 'tasks') content = renderTasks(taskCenter);
  else if (ui.section === 'history') content = renderHistory(historyCenter);
  else if (ui.section === 'spatial') content = renderSpatial(spatialCenter, current, ui);
  else content = renderEvents(state, portfolio, linkCenter, contextCapsule, ui);

  const displayBuilding = ui.section === 'takeover' ? ui.targetBuilding : current;
  return `<div class="lmo-backdrop" data-action="close-backdrop"><div class="lmo-shell" role="dialog" aria-modal="true" aria-label="房东经营中枢" style="--active-accent:${safeColor(displayBuilding.theme?.主色)}">
    ${renderSidebar(state, ui, portfolio)}<main class="lmo-main">${renderHeader(displayBuilding, ui)}<div class="lmo-scroll">${ui.notice ? `<div class="lmo-notice ${ui.notice.type}">${escapeHtml(ui.notice.text)}</div>` : ''}${content}</div></main>
  </div></div>`;
}
