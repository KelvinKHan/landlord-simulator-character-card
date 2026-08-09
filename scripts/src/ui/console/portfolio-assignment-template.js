import { compilePortfolioAssignments } from '../../tenants/portfolio-assignment-engine.js';
import { emptyState, escapeHtml, icon, safeColor } from './template-helpers.js';

function fitBand(value) {
  if (value >= 82) return 'resonant';
  if (value >= 65) return 'aligned';
  if (value >= 48) return 'possible';
  return 'cold';
}

function renderCell(person, building) {
  const placement = person.placements.find(item => item.buildingId === building.id);
  if (!placement) return '<div class="lmo-assignment-cell unavailable"><span>未知</span><small>暂无可评估空间</small></div>';
  const best = placement.buildingId === person.best.buildingId && placement.spaceId === person.best.spaceId;
  return `<div class="lmo-assignment-cell ${placement.currentBuilding ? 'current' : ''} ${best ? 'best' : ''} band-${fitBand(placement.fit)}" style="--cell-accent:${safeColor(building.color)}"><header><b>${placement.fit}</b><span>${best ? '全局最佳' : placement.currentBuilding ? '当前建筑' : `${placement.delta >= 0 ? '+' : ''}${placement.delta}`}</span></header><strong>${escapeHtml(placement.spaceName)}</strong><small>${escapeHtml(placement.matchedTags.slice(0, 2).join(' · ') || '等待针对性装修')}</small><i><em style="width:${placement.fit}%"></em></i></div>`;
}

function renderInsight(opportunity) {
  return `<article style="--person-accent:${safeColor(opportunity.color)}"><header><i>${escapeHtml(opportunity.name.slice(0, 1))}</i><span><strong>${escapeHtml(opportunity.name)}</strong><small>${escapeHtml(opportunity.fromBuilding)} → ${escapeHtml(opportunity.toBuilding)}</small></span><b>+${opportunity.delta}</b></header><p>${escapeHtml(opportunity.toSpace)} · ${escapeHtml(opportunity.matchedTags.slice(0, 2).join(' · ') || '空间综合契合')}</p></article>`;
}

export function renderPortfolioAssignmentMatrix(state) {
  const center = compilePortfolioAssignments(state);
  const matrix = center.residents.length && center.buildings.length > 1
    ? `<div class="lmo-assignment-table" style="--assignment-columns:${center.buildings.length}"><div class="lmo-assignment-row heading"><div><span>RESIDENT</span><small>当前落点</small></div>${center.buildings.map(building => `<div style="--building-accent:${safeColor(building.color)}"><i></i><strong>${escapeHtml(building.name)}</strong><small>${escapeHtml(building.type)}</small></div>`).join('')}</div>${center.residents.map(person => `<div class="lmo-assignment-row" data-assignment-person="${escapeHtml(person.personId)}"><div class="lmo-assignment-person" style="--person-accent:${safeColor(person.color)}"><i>${escapeHtml(person.name.slice(0, 1))}</i><span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(`${person.profession} · ${person.current.spaceName}`)}</small><em>${escapeHtml(person.verdict)}</em></span></div>${center.buildings.map(building => renderCell(person, building)).join('')}</div>`).join('')}</div>`
    : emptyState(center.residents.length ? '接管第二栋建筑后解锁' : '招募第一位人物后解锁', '匹配矩阵只使用已接管建筑、已知空间和现有人物，不会凭空生成数据。');
  const insights = center.opportunities.length
    ? center.opportunities.slice(0, 3).map(renderInsight).join('')
    : '<p class="lmo-assignment-stable">当前没有跨建筑契合度提升。这不是卡关，而是说人物现在的建筑已经很合拍。</p>';
  return `<section class="lmo-portfolio-assignment" data-assignment-signature="${escapeHtml(center.signature)}"><div class="lmo-section-heading compact"><div><span>RESIDENT PLACEMENT LAB</span><h2>跨建筑人才匹配矩阵</h2></div><p>将人物偏好、装修、设施、用途和同屋人数一次性投影到全部已知空间。</p></div><div class="lmo-assignment-summary"><p><b>${center.metrics.residents}</b><small>已评估人物</small></p><p><b>${center.metrics.combinations}</b><small>建筑组合</small></p><p><b>${center.metrics.crossBuildingOpportunities}</b><small>跨楼机会</small></p><p><b>+${center.metrics.bestGain}</b><small>最高提升</small></p><span>计算只读 · 不调用 AI · 不自动搬动人物</span></div><div class="lmo-assignment-layout"><div class="lmo-assignment-scroll">${matrix}</div><aside><span>FLOW OPPORTUNITIES</span><strong>人物流动机会</strong><small>只显示换建筑后契合度真正提升的组合。</small><div>${insights}</div><button class="lmo-secondary" data-action="navigate" data-section="spatial">${icon('route')} 去空间调度中心</button></aside></div></section>`;
}
