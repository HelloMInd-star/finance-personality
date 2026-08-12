// 性能基准测试：分析 generateAll() 的瓶颈
import contentHubEngine, { MEDIUM_TYPES } from '../src/utils/contentHubEngine.js';
import { ALL_PROFILES } from '../src/utils/benchmarkProfiles.js';

function measure(fn, label) {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`);
  return { result, duration };
}

console.log('🚀 开始性能基准测试...\n');

// 测试 1: generateAll 整体耗时
const allResult = measure(() => contentHubEngine.generateAll(), 'generateAll() 整体 (80个)');

console.log('\n--- 分段测试 ---');

// 测试 2: 人物查询 (80次 getProfileById)
measure(() => {
  for (let i = 0; i < 80; i++) {
    const profile = ALL_PROFILES[i % ALL_PROFILES.length];
    ALL_PROFILES.find(p => p.id === profile.id);
  }
}, '80次人物查询 (ALL_PROFILES.find)');

// 测试 3: 单个 generate 函数的平均耗时
console.log('\n--- 单个 generate 拆解 ---');
const sampleProfile = ALL_PROFILES[0];
const mediums = Object.values(MEDIUM_TYPES);

for (const medium of mediums) {
  measure(() => {
    for (let i = 0; i < 5; i++) {
      contentHubEngine.generate(sampleProfile.id, medium);
    }
  }, `5次 generate(${sampleProfile.name}, ${medium}) 平均`);
}

console.log('\n✅ 性能测试完成');
