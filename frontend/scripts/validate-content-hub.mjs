/**
 * 内容格式验证脚本
 * 检查 80 个内容单元是否符合预期格式
 */

import { ALL_PROFILES } from '../src/utils/benchmarkProfiles.js';
import { generateAll, MEDIUM_TYPES, MEDIUM_LABELS } from '../src/utils/contentHubEngine.js';

// 预期格式定义
const EXPECTED_FORMAT = {
  video: {
    titlePattern: /的.*年.*秘密/,
    bodyElements: ['核心洞察', '金句'],
    minLines: 3
  },
  drama: {
    titlePattern: /人生四幕/,
    bodyElements: ['【场景】', '【转场】', '【尾声】'],
    minLines: 5
  },
  cocktail: {
    titlePattern: /调酒配方/,
    bodyElements: ['风味画像', '配方', '装饰', '配方来源'],
    minLines: 8
  },
  ecommerce: {
    titlePattern: /式消费指南/,
    bodyElements: ['你的消费风格', '推荐品类', '购买节奏', '决策风格延伸'],
    minLines: 6
  }
};

console.log('========================================');
console.log('  基准库多介质分发系统 - 格式验证');
console.log('========================================\n');

let hasErrors = false;

// 1. 检查人物数据
console.log('📋 1. 基准人物数据检查');
console.log(`   总人数: ${ALL_PROFILES.length}`);
const investorCount = ALL_PROFILES.filter(p => p.type === 'investor').length;
const entrepreneurCount = ALL_PROFILES.filter(p => p.type === 'entrepreneur').length;
console.log(`   投资人: ${investorCount}人`);
console.log(`   创业家: ${entrepreneurCount}人`);

const REQUIRED_FIELDS = ['id', 'name', 'type', 'emoji', 'mbti', 'riskTolerance', 'timePreference', 'decisionStyle', 'mentalModels', 'cases', 'quotes', 'lifeNodes', 'taste', 'consumption', 'tags'];
let missingFields = [];
for (const p of ALL_PROFILES) {
  for (const field of REQUIRED_FIELDS) {
    if (p[field] === undefined || p[field] === null) {
      missingFields.push(`  ${p.name}: 缺少 ${field}`);
    }
  }
  if (!Array.isArray(p.mentalModels) || p.mentalModels.length === 0) {
    missingFields.push(`  ${p.name}: mentalModels 为空`);
  }
  if (!Array.isArray(p.quotes) || p.quotes.length === 0) {
    missingFields.push(`  ${p.name}: quotes 为空`);
  }
  if (!Array.isArray(p.lifeNodes) || p.lifeNodes.length === 0) {
    missingFields.push(`  ${p.name}: lifeNodes 为空`);
  }
  if (!p.taste || !p.taste.spirit) {
    missingFields.push(`  ${p.name}: taste.spirit 为空`);
  }
  if (!p.consumption || !p.consumption.style) {
    missingFields.push(`  ${p.name}: consumption.style 为空`);
  }
}
if (missingFields.length > 0) {
  console.log(`   ❌ 字段缺失: ${missingFields.length}处`);
  missingFields.slice(0, 10).forEach(f => console.log(f));
  hasErrors = true;
} else {
  console.log('   ✅ 所有人物字段完整');
}

// 2. 生成所有内容单元
console.log('\n🎬 2. 内容生成检查');
console.log('   正在生成 20人 × 4介质 = 80个内容单元...');
const allUnits = generateAll();
console.log(`   实际生成: ${allUnits.length}个`);

if (allUnits.length !== 80) {
  console.log(`   ❌ 数量不匹配: 期望80, 实际${allUnits.length}`);
  hasErrors = true;
} else {
  console.log('   ✅ 数量正确 (80个)');
}

for (const medium of Object.values(MEDIUM_TYPES)) {
  const count = allUnits.filter(u => u.medium === medium).length;
  const expected = 20;
  const status = count === expected ? '✅' : '❌';
  console.log(`   ${status} ${MEDIUM_LABELS[medium]}: ${count}/${expected}个`);
  if (count !== expected) hasErrors = true;
}

const invCount = allUnits.filter(u => u.personType === 'investor').length;
const entCount = allUnits.filter(u => u.personType === 'entrepreneur').length;
console.log(`   投资人内容: ${invCount}个 (期望40)`);
console.log(`   创业家内容: ${entCount}个 (期望40)`);

// 3. 检查 ContentUnit 结构
console.log('\n📦 3. ContentUnit 结构检查');
const REQUIRED_UNIT_FIELDS = ['id', 'personId', 'personName', 'personEmoji', 'personType', 'medium', 'mediumLabel', 'mediumIcon', 'title', 'body', 'tags', 'generatedAt'];
let unitFieldErrors = [];
for (const unit of allUnits) {
  for (const field of REQUIRED_UNIT_FIELDS) {
    if (unit[field] === undefined || unit[field] === null) {
      unitFieldErrors.push(`  [${unit.personName} × ${unit.mediumLabel}]: 缺少 ${field}`);
    }
  }
  if (!Array.isArray(unit.tags)) {
    unitFieldErrors.push(`  [${unit.personName} × ${unit.mediumLabel}]: tags 不是数组`);
  }
  if (typeof unit.generatedAt !== 'number') {
    unitFieldErrors.push(`  [${unit.personName} × ${unit.mediumLabel}]: generatedAt 不是数字`);
  }
}
if (unitFieldErrors.length > 0) {
  console.log(`   ❌ 字段缺失: ${unitFieldErrors.length}处`);
  unitFieldErrors.slice(0, 10).forEach(f => console.log(f));
  hasErrors = true;
} else {
  console.log('   ✅ 所有 ContentUnit 字段完整');
}

// 4. 检查各介质内容格式
console.log('\n🎨 4. 各介质内容格式检查');
const samples = {};

for (const medium of Object.values(MEDIUM_TYPES)) {
  const expected = EXPECTED_FORMAT[medium];
  const mediumUnits = allUnits.filter(u => u.medium === medium);
  
  console.log(`\n   【${MEDIUM_LABELS[medium]}】`);
  
  // 标题格式
  let titleErrors = 0;
  for (const unit of mediumUnits) {
    if (!expected.titlePattern.test(unit.title)) {
      titleErrors++;
      if (titleErrors <= 2) {
        console.log(`     ⚠️  标题格式异常: ${unit.title}`);
      }
    }
  }
  if (titleErrors > 0) hasErrors = true;
  console.log(`     标题格式: ${titleErrors === 0 ? '✅' : '⚠️  ' + titleErrors + '个异常'}`);
  
  // 内容元素检查
  let elementErrorCount = 0;
  for (const unit of mediumUnits) {
    for (const elem of expected.bodyElements) {
      if (!unit.body.includes(elem)) {
        elementErrorCount++;
        if (elementErrorCount <= 5) {
          console.log(`       ⚠️  [${unit.personName}] 缺少: "${elem}"`);
        }
      }
    }
    const lines = unit.body.split('\n').filter(l => l.trim() !== '');
    if (lines.length < expected.minLines) {
      elementErrorCount++;
      if (elementErrorCount <= 5) {
        console.log(`       ⚠️  [${unit.personName}] 行数过少: ${lines.length} < ${expected.minLines}`);
      }
    }
  }
  if (elementErrorCount > 0) hasErrors = true;
  console.log(`     内容元素: ${elementErrorCount === 0 ? '✅' : '⚠️  ' + elementErrorCount + '处异常'}`);
  
  // 保存样本
  samples[medium] = mediumUnits[0];
}

// 5. 展示样本
console.log('\n📝 5. 各介质内容样本');
for (const [medium, unit] of Object.entries(samples)) {
  console.log(`\n   【${MEDIUM_LABELS[medium]}】- ${unit.personEmoji} ${unit.personName}`);
  console.log(`   标题: ${unit.title}`);
  console.log('   内容预览:');
  unit.body.split('\n').slice(0, 6).forEach(line => {
    console.log(`     ${line}`);
  });
  console.log(`   标签: ${unit.tags.slice(0, 5).join(', ')}`);
}

// 6. 总结
console.log('\n========================================');
console.log('  验证总结');
console.log('========================================');
console.log(`  生成内容单元: ${allUnits.length}/80`);
console.log(`  人物字段完整: ${missingFields.length === 0 ? '✅' : '❌ ' + missingFields.length + '处'}`);
console.log(`  内容单元完整: ${unitFieldErrors.length === 0 ? '✅' : '❌ ' + unitFieldErrors.length + '处'}`);
console.log(`  总体状态: ${!hasErrors ? '✅ 全部通过' : '⚠️  有问题需要修复'}`);

if (hasErrors) {
  process.exit(1);
} else {
  console.log('\n🎉 所有 80 个内容单元格式验证通过！');
}
