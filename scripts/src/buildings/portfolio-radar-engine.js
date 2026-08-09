import { compilePortfolio } from './compiler.js';
import { compileBuildingOperations } from './operations-engine.js';

const axes = Object.freeze(['comfort', 'function', 'vitality', 'appeal']);
const metricNames = Object.freeze({ comfort: '舒适', function: '功能', vitality: '活力', appeal: '吸引' });

function polygonPoints(metrics) {
  const values = axes.map(key => Math.max(0, Math.min(100, Number(metrics[key]) || 0)) * 0.38);
  return `50,${50 - values[0]} ${50 + values[1]},50 50,${50 + values[2]} ${50 - values[3]},50`;
}

function focusReason(space) {
  const weakest = Object.entries(space.metrics).sort((left, right) => left[1] - right[1])[0]?.[0] ?? 'comfort';
  const action = weakest === 'vitality' ? '安排人物进入' : weakest === 'function' ? '补足设施或用途' : weakest === 'appeal' ? '做一次有记忆点的装修' : '增加更贴合生活的软装';
  return Object.freeze({ metric: weakest, label: metricNames[weakest], action });
}

export function compilePortfolioRadar(state) {
  const portfolio = compilePortfolio(state);
  const ownedIds = new Set(portfolio.owned.map(building => building.id));
  const buildings = portfolio.owned.map(building => {
    const pulse = compileBuildingOperations(state, building.id);
    const focusSpace = [...pulse.spaces].sort((left, right) => left.total - right.total || left.id.localeCompare(right.id))[0] ?? null;
    return Object.freeze({
      id: building.id,
      name: building.name,
      type: building.type,
      color: building.theme?.主色 ?? '#FF9EAA',
      current: building.id === state.当前建筑ID,
      pulse: pulse.total,
      pulseState: pulse.state,
      metrics: pulse.metrics,
      polygon: polygonPoints(pulse.metrics),
      residents: pulse.residentCount,
      origins: pulse.originCount,
      spaces: pulse.spaces.length,
      emptySpaces: building.metrics.emptySpaces,
      synergies: pulse.synergies.map(item => item.title),
      focus: focusSpace ? Object.freeze({ id: focusSpace.id, name: focusSpace.name, score: focusSpace.total, ...focusReason(focusSpace) }) : null,
    });
  }).sort((left, right) => Number(right.current) - Number(left.current) || right.pulse - left.pulse || left.id.localeCompare(right.id));
  const residentIds = Object.entries(state.人物列表 ?? {}).filter(([, person]) => ownedIds.has(person.所在建筑ID)).map(([id]) => id);
  const origins = new Set(residentIds.map(id => state.人物列表[id].来源世界));
  const allFocus = buildings.filter(item => item.focus).sort((left, right) => left.focus.score - right.focus.score || left.id.localeCompare(right.id));
  const spotlight = [...buildings].sort((left, right) => right.pulse - left.pulse || left.id.localeCompare(right.id))[0] ?? null;
  const signature = buildings.map(item => `${item.id}:${item.pulse}:${item.residents}:${item.focus?.id ?? ''}`).join('|');
  return Object.freeze({
    signature: `portfolio_radar_${signature}`,
    buildings: Object.freeze(buildings),
    metrics: Object.freeze({ buildings: buildings.length, residents: residentIds.length, origins: origins.size, emptySpaces: buildings.reduce((sum, item) => sum + item.emptySpaces, 0), activeSynergies: buildings.reduce((sum, item) => sum + item.synergies.length, 0) }),
    spotlight: spotlight ? Object.freeze({ buildingId: spotlight.id, buildingName: spotlight.name, pulse: spotlight.pulse, state: spotlight.pulseState }) : null,
    focus: allFocus[0] ? Object.freeze({ buildingId: allFocus[0].id, buildingName: allFocus[0].name, ...allFocus[0].focus }) : null,
  });
}
