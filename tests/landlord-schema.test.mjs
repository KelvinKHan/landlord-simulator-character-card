import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { createDefaultLandlordState } from '../scripts/src/model/default-state.js';
import { assertLandlordState } from '../scripts/src/model/validate-state.js';

globalThis.z = z;
const { Schema } = await import('../scripts/src/schema/landlord-schema.js');

test.after(() => {
  delete globalThis.z;
});

test('MVU 2.0 Schema 能从空对象补齐安全默认值', () => {
  const result = Schema.parse({});
  assert.equal(result.房东系统.版本, '2.0');
  assert.equal(result.房东系统.运行模式, '模拟');
  assert.deepEqual(result.房东系统.用户.物品栏, {});
  assert.deepEqual(result.房东系统.建筑列表, {});
});

test('MVU 2.0 Schema 解析幂等并保留完整默认建筑', () => {
  const first = Schema.parse({ 房东系统: createDefaultLandlordState() });
  const second = Schema.parse(first);
  assert.deepEqual(second, first);
  assert.equal(first.房东系统.建筑列表.building_headquarters.是否总部, true);
  assert.equal(first.房东系统.建筑列表.building_hospital_candidate.接管状态, '可接管');
  assert.equal(first.房东系统.建筑列表.building_office_candidate.接管状态, '可接管');
  assertLandlordState(first.房东系统);
});

test('MVU 2.0 Schema 会柔性修正数值而不是丢弃整次更新', () => {
  const source = createDefaultLandlordState();
  source.建筑列表.building_headquarters.感知度 = 180;
  source.建筑列表.building_headquarters.经营摘要.入住率 = -20;
  source.用户.物品栏.急救药箱 = { 数量: -2, 描述: '常备医疗用品' };
  const result = Schema.parse({ 房东系统: source }).房东系统;
  assert.equal(result.建筑列表.building_headquarters.感知度, 100);
  assert.equal(result.建筑列表.building_headquarters.经营摘要.入住率, 0);
  assert.equal(result.用户.物品栏.急救药箱.数量, 0);
});
