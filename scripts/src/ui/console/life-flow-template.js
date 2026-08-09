import { compileLifeFlows } from '../../tenants/life-flow-engine.js';
import { emptyState, escapeHtml, icon, safeColor } from './template-helpers.js';

function renderTransition(transition) {
  if (!transition) return '';
  return `<span class="lmo-flow-transition ${transition.crossBuilding ? 'cross' : ''}" data-flow-transition="${escapeHtml(transition.code)}"><i></i><small>${escapeHtml(transition.crossBuilding ? '跨建筑' : transition.kind)}</small></span>`;
}

function renderStop(stop, transition, index) {
  return `${index ? renderTransition(transition) : ''}<div class="lmo-flow-stop" data-flow-stop="${escapeHtml(stop.phase)}" style="--stop-accent:${safeColor(stop.color)}"><time>${escapeHtml(stop.time)}</time><i><b>${stop.fit}</b></i><span><strong>${escapeHtml(stop.spaceName)}</strong><small>${escapeHtml(stop.buildingName)}</small><em>${escapeHtml(stop.label)}</em></span></div>`;
}

function renderResidentFlow(person) {
  return `<article class="lmo-flow-person" data-flow-person="${escapeHtml(person.personId)}" style="--person-accent:${safeColor(person.color)}"><header><i>${escapeHtml(person.name.slice(0, 1))}</i><span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(`${person.profession} · ${person.origin}`)}</small></span><div><p><b>${person.metrics.buildings}</b><small>栋建筑</small></p><p><b>${person.metrics.spaces}</b><small>个落点</small></p><p><b>${person.metrics.crossBuildingTrips}</b><small>次跨楼</small></p></div></header><div class="lmo-flow-path">${person.stops.map((stop, index) => renderStop(stop, person.transitions[index - 1], index)).join('')}</div><footer>${person.stops.slice(1, -1).map(stop => `<span><b>${escapeHtml(stop.label)}</b>${escapeHtml(stop.activity)}</span>`).join('')}</footer></article>`;
}

function renderWave(wave, totalResidents) {
  return `<section data-flow-wave="${escapeHtml(wave.phase)}"><header><time>${escapeHtml(wave.time)}</time><strong>${escapeHtml(wave.label)}</strong></header>${wave.counts.map(item => `<p style="--wave-accent:${safeColor(item.color)}"><span><i></i>${escapeHtml(item.buildingName)}</span><b>${item.count}</b><em><i style="width:${totalResidents ? Math.round(item.count / totalResidents * 100) : 0}%"></i></em></p>`).join('')}</section>`;
}

export function renderLifeFlow(state) {
  const center = compileLifeFlows(state);
  const content = center.residents.length
    ? `<div class="lmo-life-flow-layout"><div class="lmo-life-flow-list">${center.residents.map(renderResidentFlow).join('')}</div><aside><span>PORTFOLIO FLOW TELEMETRY</span><strong>建筑人流波形</strong><small>每个时点的人数总和都必须与现有人物数一致。</small><div class="lmo-flow-waves">${center.waves.map(wave => renderWave(wave, center.metrics.residents)).join('')}</div>${center.busiest ? `<p class="lmo-flow-busiest"><span>PEAK SIGNAL</span><strong>${escapeHtml(`${center.busiest.time} · ${center.busiest.buildingName}`)}</strong><small>${center.busiest.count} 人出现在此时段</small></p>` : ''}<button class="lmo-secondary" data-action="navigate" data-section="spatial">${icon('route')} 进入真实空间调度</button></aside></div>`
    : emptyState('招募人物后生成生活流线', '沙盘只使用已有人物和已知空间，不会为了好看而虚构人流。');
  return `<section class="lmo-life-flow" data-life-flow="${escapeHtml(center.signature)}"><div class="lmo-section-heading compact"><div><span>LIVE ROUTE SIMULATION</span><h2>24H 跨建筑生活流线沙盘</h2></div><p>从当前落点出发，演算白日主场、晚间碰撞与夜间归处；路线可达，但不会自动执行。</p></div><div class="lmo-flow-summary"><p><b>${center.metrics.residents}</b><small>参与人物</small></p><p><b>${center.metrics.visitedBuildings}</b><small>流动建筑</small></p><p><b>${center.metrics.visitedSpaces}</b><small>生活落点</small></p><p><b>${center.metrics.crossBuildingTrips}</b><small>跨楼交通</small></p><span>只读演算 · 不调用 AI · 不写入 MVU</span></div>${content}</section>`;
}
