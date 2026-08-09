const materialRules = Object.freeze([
  ['arcane', /魔法|符文|星图|发光|能量|传送|万界|异界/i],
  ['glass', /玻璃|水晶|晶体|透明|镜面/i],
  ['metal', /金属|合金|不锈钢|机械|工业/i],
  ['stone', /石材|大理石|水泥|地坪|岩石|瓷砖/i],
  ['wood', /木|竹|藤|原木/i],
  ['fabric', /织物|布艺|软装|绒|地毯/i],
  ['organic', /植物|草木|自然|绿植|苔藓/i],
]);

const furnitureRules = Object.freeze([
  ['seat', /沙发|座|椅|休息|床/i, '座'],
  ['table', /桌|台|吧台|工作台/i, '台'],
  ['display', /展示|收藏|陈列|信息/i, '展'],
  ['storage', /柜|收纳|储物|墙/i, '柜'],
  ['light', /灯|照明|光/i, '光'],
]);

function text(value) {
  return String(value ?? '').trim();
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeHex(value, fallback) {
  const source = text(value);
  const short = /^#([0-9a-f]{3})$/i.exec(source);
  if (short) return `#${[...short[1]].map(character => character.repeat(2)).join('')}`.toUpperCase();
  return /^#[0-9a-f]{6}$/i.test(source) ? source.toUpperCase() : fallback;
}

function channels(color) {
  return [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16));
}

function mix(left, right, ratio = 0.5) {
  const a = channels(left);
  const b = channels(right);
  return `#${a.map((value, index) => Math.round(value + (b[index] - value) * ratio).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function contrast(color) {
  const [red, green, blue] = channels(color);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 156 ? '#283044' : '#FFFDFD';
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36).padStart(7, '0');
}

function classifyMaterial(style, materials) {
  const source = `${style} ${Object.keys(materials).join(' ')} ${Object.values(materials).join(' ')}`;
  return materialRules.find(([, pattern]) => pattern.test(source))?.[0] ?? 'soft';
}

function classifyLighting(lighting) {
  if (/霓虹|情景|变化|光带|发光|赛博/i.test(lighting)) return 'dynamic';
  if (/暖|2700|黄昏|烛/i.test(lighting)) return 'warm';
  if (/冷|天光|未来|月光|白光/i.test(lighting)) return 'cool';
  return 'natural';
}

function compileFurniture(furniture) {
  return Object.entries(furniture).slice(0, 5).map(([id, label]) => {
    const source = `${id} ${label}`;
    const rule = furnitureRules.find(([, pattern]) => pattern.test(source)) ?? ['feature', /.*/, '景'];
    return Object.freeze({ id, label: text(label) || id, category: rule[0], marker: rule[2] });
  });
}

export function createRenovationVisual(renovation = {}, { fallbackAccent = '#FF9EAA' } = {}) {
  const palette = record(renovation.配色 ?? renovation.palette);
  const materials = record(renovation.材质 ?? renovation.materials);
  const furniture = record(renovation.家具 ?? renovation.furniture);
  const style = text(renovation.风格 ?? renovation.style) || '基础装修';
  const lighting = text(renovation.照明 ?? renovation.lighting) || '自然柔光';
  const atmosphere = text(renovation.氛围 ?? renovation.atmosphere) || '舒适';
  const colors = Object.entries(palette)
    .map(([name, value]) => Object.freeze({ name, value: normalizeHex(value, '') }))
    .filter(item => item.value);
  const accent = colors.find(item => /点缀|高光|光色|accent/i.test(item.name))?.value
    ?? normalizeHex(fallbackAccent, '#FF9EAA');
  const base = colors.find(item => /主色|base|primary/i.test(item.name))?.value
    ?? mix(accent, '#FFFDFD', 0.82);
  const secondary = colors.find(item => item.value !== base && item.value !== accent)?.value
    ?? mix(base, accent, 0.35);
  const material = classifyMaterial(style, materials);
  const lightingMode = classifyLighting(lighting);
  const furnitureTokens = compileFurniture(furniture);
  const signatureSource = JSON.stringify({ style, colors, materials, furniture, lighting, atmosphere });
  return Object.freeze({
    signature: `renovation_${hash(signatureSource)}`,
    style,
    atmosphere,
    lighting,
    material,
    lightingMode,
    colors: Object.freeze(colors.length ? colors : [Object.freeze({ name: '主色', value: base }), Object.freeze({ name: '点缀', value: accent })]),
    furniture: Object.freeze(furnitureTokens),
    renovated: style !== '基础装修' || Object.keys(materials).length > 0 || furnitureTokens.length > 0,
    css: Object.freeze({
      base,
      accent,
      secondary,
      glow: mix(accent, '#FFFFFF', lightingMode === 'dynamic' ? 0.18 : 0.48),
      text: contrast(base),
    }),
  });
}

export function createRenovationVisualService() {
  return Object.freeze({ compile: createRenovationVisual });
}
