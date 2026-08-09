import { compileRenovationProjection } from '../../renovation/projection-engine.js';
import { escapeHtml, safeColor, tags } from './template-helpers.js';

export function renovationVisualStyle(visual) {
  return `--room-base:${safeColor(visual.css.base)};--room-accent:${safeColor(visual.css.accent)};--room-secondary:${safeColor(visual.css.secondary)};--room-glow:${safeColor(visual.css.glow)};--room-text:${safeColor(visual.css.text, '#283044')}`;
}

export function renderRenovationVisual(visual, { compact = false } = {}) {
  const furniture = visual.furniture.length
    ? visual.furniture.map(item => `<i title="${escapeHtml(item.label)}">${escapeHtml(item.marker)}</i>`).join('')
    : '<i class="empty">空</i>';
  return `<div class="lmo-renovation-visual material-${escapeHtml(visual.material)} lighting-${escapeHtml(visual.lightingMode)} ${compact ? 'compact' : ''}" style="${renovationVisualStyle(visual)}"><span class="lmo-visual-light"></span><div class="lmo-visual-room"><em>${escapeHtml(visual.style)}</em><div>${furniture}</div></div><footer>${visual.colors.slice(0, 4).map(color => `<i style="--swatch:${safeColor(color.value)}" title="${escapeHtml(color.name)}"></i>`).join('')}<span>${escapeHtml(visual.atmosphere)}</span></footer></div>`;
}

export function renderRenovationProjection(twin, space, plan, building, { source = 'RENOVATION HOLOGRAM' } = {}) {
  const projection = compileRenovationProjection(twin, space.id, plan, building.theme?.主色);
  if (!projection) return '';
  const nodes = projection.nodes.map(node => `<div class="lmo-hologram-node material-${escapeHtml(node.visual.material)} ${node.projected ? 'projected' : ''}" data-space-id="${escapeHtml(node.id)}" style="left:${node.x}%;top:${node.y}%;width:${node.w}%;height:${node.h}%;${renovationVisualStyle(node.visual)}"><strong>${escapeHtml(node.name)}</strong><small>${node.projected ? '装修投影' : escapeHtml(node.visual.style)}</small></div>`).join('');
  const edges = projection.edges.map(edge => `<line x1="${edge.fromPoint.x}" y1="${edge.fromPoint.y}" x2="${edge.toPoint.x}" y2="${edge.toPoint.y}"/>`).join('');
  return `<article class="lmo-renovation-hologram" data-renovation-projection="${escapeHtml(projection.signature)}"><header><div><span>${escapeHtml(source)}</span><h3>${escapeHtml(projection.floorName)}·装修全息投影</h3><p>方案已经投射进真实数字孪生；此刻仍未写入 MVU。</p></div><em>${projection.nodes.length} 个空间 · 目标 ${escapeHtml(projection.targetName)}</em></header><div class="lmo-hologram-layout"><div class="lmo-hologram-stage"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${edges}</svg>${nodes}</div><aside><span>BEFORE / AFTER</span><div><section><small>当前状态</small>${renderRenovationVisual(projection.before, { compact: true })}</section><section><small>确认之后</small>${renderRenovationVisual(projection.after, { compact: true })}</section></div>${tags(projection.impacts)}<p>只有点击确认后，空间描述、材质、配色与人物事件才会一起改变。</p></aside></div></article>`;
}
