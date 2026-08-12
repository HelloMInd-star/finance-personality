// 测试 DNA 引擎
import { analyzeInvestorDNA } from '../src/utils/genomeEngine.js';

const testInput = '我喜欢深入研究公司财报和行业格局，建立自己的投资原则体系，买入后一般持有5年以上，不在意短期波动。偏好分散配置但会给高确信度标的重仓。性格偏内向，喜欢独立思考，不会跟风追热点。';

console.log('测试输入:', testInput.slice(0, 60) + '...\n');

try {
  const result = analyzeInvestorDNA(testInput);
  console.log('=== 基因测序结果 ===');
  console.log('  风险染色体:', result.userDNA.risk);
  console.log('  时间染色体:', result.userDNA.time);
  console.log('  风格染色体:', result.userDNA.style);
  console.log('  模型染色体:', result.userDNA.model);
  console.log('  MBTI:', result.userDNA.mbti);

  console.log('\n=== Top3 匹配 ===');
  result.top3.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.master.name} (${t.master.mbti}): ${t.similarity}%`);
  });

  console.log('\n=== Winner ===');
  console.log('  最像:', result.winner.master.name);
  console.log('  相似度:', result.winner.similarity + '%');
  console.log('  名言:', result.winner.master.quote);

  console.log('\n=== 紫人组检测 ===');
  console.log('  触发:', result.purpleGroup.isPurple ? '✅' : '❌');
  console.log('  紫人数量:', result.purpleGroup.purpleCount);

  console.log('\n✅ 测试通过！');
} catch (e) {
  console.log('❌ ERROR:', e.message);
  console.log(e.stack);
}
