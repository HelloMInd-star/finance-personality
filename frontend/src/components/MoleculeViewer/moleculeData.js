/**
 * 分子数据库 - 调酒关键分子 + 企业家人格分子
 * 纯数据模块,可被组件和测试共同导入
 */

// 元素配色(CPK 标准)
export const ELEMENT_COLORS = {
  C: '#404040',
  H: '#ffffff',
  O: '#ff4444',
  N: '#4488ff',
};

// 元素半径
export const ELEMENT_RADIUS = {
  C: 0.55,
  H: 0.3,
  O: 0.48,
  N: 0.5,
};

// 支持的元素类型
export const SUPPORTED_ELEMENTS = Object.keys(ELEMENT_COLORS);

// ========================================
// 基础分子结构(供人格分子复用)
// ========================================

const _BASES = {
  ethanol: {
    atoms: [
      { id: 'C1', element: 'C', position: [-1.2, 0.3, 0] },
      { id: 'C2', element: 'C', position: [0.6, 0.3, 0] },
      { id: 'O1', element: 'O', position: [1.5, 1.4, 0] },
      { id: 'H1', element: 'H', position: [-1.8, -0.5, 0.8] },
      { id: 'H2', element: 'H', position: [-1.8, -0.5, -0.8] },
      { id: 'H3', element: 'H', position: [-1.5, 1.3, 0] },
      { id: 'H4', element: 'H', position: [0.9, -0.6, 0.8] },
      { id: 'H5', element: 'H', position: [0.9, -0.6, -0.8] },
      { id: 'H6', element: 'H', position: [2.3, 1.0, 0] },
    ],
    bonds: [
      { from: 'C1', to: 'C2' }, { from: 'C1', to: 'H1' },
      { from: 'C1', to: 'H2' }, { from: 'C1', to: 'H3' },
      { from: 'C2', to: 'O1' }, { from: 'C2', to: 'H4' },
      { from: 'C2', to: 'H5' }, { from: 'O1', to: 'H6' },
    ],
  },
  ethyl_acetate: {
    atoms: [
      { id: 'C1', element: 'C', position: [-2.0, 0, 0] },
      { id: 'C2', element: 'C', position: [-0.6, 0, 0] },
      { id: 'O1', element: 'O', position: [0.3, 1.1, 0] },
      { id: 'O2', element: 'O', position: [0.6, -0.8, 0] },
      { id: 'C3', element: 'C', position: [1.9, -0.5, 0] },
      { id: 'C4', element: 'C', position: [3.1, 0.4, 0] },
      { id: 'H1', element: 'H', position: [-2.5, 0.8, 0.5] },
      { id: 'H2', element: 'H', position: [-2.5, -0.8, 0.5] },
      { id: 'H3', element: 'H', position: [-2.5, 0, -0.9] },
      { id: 'H4', element: 'H', position: [2.1, -1.5, 0.5] },
      { id: 'H5', element: 'H', position: [2.1, -1.5, -0.5] },
      { id: 'H6', element: 'H', position: [4.0, 0.0, 0.5] },
      { id: 'H7', element: 'H', position: [4.0, 1.2, 0] },
      { id: 'H8', element: 'H', position: [4.0, 0.0, -0.9] },
    ],
    bonds: [
      { from: 'C1', to: 'C2' }, { from: 'C2', to: 'O1' },
      { from: 'C2', to: 'O2' }, { from: 'O2', to: 'C3' },
      { from: 'C3', to: 'C4' }, { from: 'C1', to: 'H1' },
      { from: 'C1', to: 'H2' }, { from: 'C1', to: 'H3' },
      { from: 'C3', to: 'H4' }, { from: 'C3', to: 'H5' },
      { from: 'C4', to: 'H6' }, { from: 'C4', to: 'H7' },
      { from: 'C4', to: 'H8' },
    ],
  },
  limonene: {
    atoms: [
      { id: 'C1', element: 'C', position: [0, 1.0, 0] },
      { id: 'C2', element: 'C', position: [0.87, 0.5, 0] },
      { id: 'C3', element: 'C', position: [0.87, -0.5, 0] },
      { id: 'C4', element: 'C', position: [0, -1.0, 0] },
      { id: 'C5', element: 'C', position: [-0.87, -0.5, 0] },
      { id: 'C6', element: 'C', position: [-0.87, 0.5, 0] },
      { id: 'C7', element: 'C', position: [1.8, 1.0, 0] },
      { id: 'H1', element: 'H', position: [0, 1.8, 0.5] },
      { id: 'H2', element: 'H', position: [1.4, 1.0, -0.8] },
      { id: 'H3', element: 'H', position: [2.4, 0.4, 0.5] },
      { id: 'H4', element: 'H', position: [2.4, 1.6, 0.5] },
      { id: 'H5', element: 'H', position: [1.4, -1.0, 0.5] },
      { id: 'H6', element: 'H', position: [0, -1.8, 0.5] },
      { id: 'H7', element: 'H', position: [-1.4, -1.0, 0.5] },
      { id: 'H8', element: 'H', position: [-1.4, 1.0, 0.5] },
    ],
    bonds: [
      { from: 'C1', to: 'C2' }, { from: 'C2', to: 'C3' },
      { from: 'C3', to: 'C4' }, { from: 'C4', to: 'C5' },
      { from: 'C5', to: 'C6' }, { from: 'C6', to: 'C1' },
      { from: 'C2', to: 'C7' }, { from: 'C1', to: 'H1' },
      { from: 'C7', to: 'H2' }, { from: 'C7', to: 'H3' },
      { from: 'C7', to: 'H4' }, { from: 'C3', to: 'H5' },
      { from: 'C4', to: 'H6' }, { from: 'C5', to: 'H7' },
      { from: 'C6', to: 'H8' },
    ],
  },
};

// ========================================
// 人格分子定义(紧凑格式)
// ========================================

const _PERSONA_DEFS = [
  { key: 'intj_musk', name: 'INTJ · 马斯克', formula: 'C₂H₅OH', desc: '烟熏威士忌 · 系统架构师', flavor: '烟熏 + 橙皮', spirit: '威士忌', temp: '常温', presentation: '简约光晕', persona: 'INTJ', person: '马斯克', base: 'ethanol' },
  { key: 'istj_buffett', name: 'ISTJ · 巴菲特', formula: 'C₂H₅OH', desc: '波本威士忌 · 价值投资者', flavor: '木质 + 焦糖', spirit: '波本', temp: '室温', presentation: '沉稳古典', persona: 'ISTJ', person: '巴菲特', base: 'ethanol' },
  { key: 'entp_soros', name: 'ENTP · 索罗斯', formula: 'C₁₀H₁₆', desc: '金酒 · 反身性理论家', flavor: '草本 + 柑橘', spirit: '金酒', temp: '冰镇', presentation: '气泡上升', persona: 'ENTP', person: '索罗斯', base: 'limonene' },
  { key: 'entj_son', name: 'ENTJ · 孙正义', formula: 'C₄H₈O₂', desc: '龙舌兰 · 愿景赌徒', flavor: '辣椒 + 青柠', spirit: '龙舌兰', temp: '微冰', presentation: '火焰点燃', persona: 'ENTJ', person: '孙正义', base: 'ethyl_acetate' },
  { key: 'istp_jobs', name: 'ISTP · 乔布斯', formula: 'C₂H₅OH', desc: '苹果酒 · 极简主义匠人', flavor: '清冽 + 微甜', spirit: '苹果酒', temp: '冰镇', presentation: '极简透明', persona: 'ISTP', person: '乔布斯', base: 'ethanol' },
  { key: 'entj_bezos', name: 'ENTJ · 贝索斯', formula: 'C₄H₈O₂', desc: '龙舌兰 · 长期主义者', flavor: '烟熏 + 橙皮', spirit: '龙舌兰', temp: '微冰', presentation: '分层结构', persona: 'ENTJ', person: '贝索斯', base: 'ethyl_acetate' },
  { key: 'intp_gates', name: 'INTP · 盖茨', formula: 'C₂H₅OH', desc: '清酒 · 系统思考者', flavor: '柚子 + 薄荷', spirit: '清酒', temp: '冷藏', presentation: '透明叠层', persona: 'INTP', person: '盖茨', base: 'ethanol' },
  { key: 'enfp_branson', name: 'ENFP · 布兰森', formula: 'C₁₀H₁₆', desc: '朗姆酒 · 冒险家', flavor: '热带水果 + 椰子', spirit: '朗姆酒', temp: '冰沙', presentation: '彩色分层', persona: 'ENFP', person: '布兰森', base: 'limonene' },
  { key: 'esfp_ma', name: 'ESFP · 马云', formula: 'C₁₀H₁₆', desc: '起泡酒 · 表演者', flavor: '玫瑰 + 荔枝', spirit: '起泡酒', temp: '微冰', presentation: '气泡上升', persona: 'ESFP', person: '马云', base: 'limonene' },
  { key: 'estj_ren', name: 'ESTJ · 任正非', formula: 'C₂H₅OH', desc: '白酒 · 纪律构建者', flavor: '凛冽 + 高粱', spirit: '白酒', temp: '常温', presentation: '极简透明', persona: 'ESTJ', person: '任正非', base: 'ethanol' },
  { key: 'intj_zhang', name: 'INTJ · 张一鸣', formula: 'C₂H₅OH', desc: '威士忌 · 算法理性主义者', flavor: '木质 + 橙皮', spirit: '威士忌', temp: '常温', presentation: '简约光晕', persona: 'INTJ', person: '张一鸣', base: 'ethanol' },
  { key: 'esfj_li', name: 'ESFJ · 李嘉诚', formula: 'C₂H₅OH', desc: '黄酒 · 关系大师', flavor: '甜润 + 陈皮', spirit: '黄酒', temp: '温热', presentation: '古朴陶器', persona: 'ESFJ', person: '李嘉诚', base: 'ethanol' },
  { key: 'infj_inamori', name: 'INFJ · 稻盛和夫', formula: 'C₂H₅OH', desc: '烧酎 · 利他哲学家', flavor: '浓郁 + 红薯', spirit: '烧酎', temp: '常温', presentation: '纯净光晕', persona: 'INFJ', person: '稻盛和夫', base: 'ethanol' },
  { key: 'enfp_lynch', name: 'ENFP · 彼得·林奇', formula: 'C₁₀H₁₆', desc: '朗姆酒 · 逆向投资者', flavor: '香料 + 橙皮', spirit: '朗姆酒', temp: '微凉', presentation: '彩色分层', persona: 'ENFP', person: '彼得·林奇', base: 'limonene' },
  { key: 'intp_munger', name: 'INTP · 查理·芒格', formula: 'C₄H₈O₂', desc: '黑麦威士忌 · 多元思维模型', flavor: '烟熏 + 香料', spirit: '黑麦', temp: '室温', presentation: '结构分层', persona: 'INTP', person: '查理·芒格', base: 'ethyl_acetate' },
  { key: 'intj_dalio', name: 'INTJ · 瑞·达利欧', formula: 'C₂H₅OH', desc: '威士忌 · 原则主义者', flavor: '海水 + 烟熏', spirit: '威士忌', temp: '微凉', presentation: '极简透明', persona: 'INTJ', person: '瑞·达利欧', base: 'ethanol' },
  { key: 'intj_ricardo', name: 'INTJ · 李嘉图', formula: 'C₂H₅OH', desc: '干邑 · 比较优势之父', flavor: '橡木 + 无花果', spirit: '干邑', temp: '常温', presentation: '琥珀光泽', persona: 'INTJ', person: '李嘉图', base: 'ethanol' },
  { key: 'infp_miyazaki', name: 'INFP · 宫崎骏', formula: 'C₁₀H₁₆', desc: '梅酒 · 梦想叙事者', flavor: '酸甜 + 花香', spirit: '梅酒', temp: '常温', presentation: '柔和渐变', persona: 'INFP', person: '宫崎骏', base: 'limonene' },
  { key: 'infj_king', name: 'INFJ · 马丁·路德·金', formula: 'C₁₀H₁₆', desc: '蜜酒 · 愿景演说家', flavor: '蜂蜜 + 花香', spirit: '蜜酒', temp: '温热', presentation: '柔和光晕', persona: 'INFJ', person: '马丁·路德·金', base: 'limonene' },
  { key: 'istj_buffett_value', name: 'ISTJ · 巴菲特(价值派)', formula: 'C₂H₅OH', desc: '黑麦威士忌 · 安全边际派', flavor: '焦糖 + 橡木', spirit: '黑麦', temp: '室温', presentation: '厚重沉淀', persona: 'ISTJ', person: '巴菲特', base: 'ethanol' },
];

// 构建人格分子对象
function _buildPersonaMolecules() {
  const result = {};
  for (const def of _PERSONA_DEFS) {
    const base = _BASES[def.base];
    result[def.key] = {
      name: def.name,
      formula: def.formula,
      desc: def.desc,
      flavor: def.flavor,
      relatedSpirit: def.spirit,
      temperature: def.temp,
      presentation: def.presentation,
      relatedPersona: def.persona,
      relatedPerson: def.person,
      atoms: base.atoms,
      bonds: base.bonds,
    };
  }
  return result;
}

// ========================================
// 分子数据库(原有 3 种 + 20 种人格分子)
// ========================================

export const MOLECULES = {
  // --- 原有基础分子 ---
  ethanol: {
    name: '乙醇',
    formula: 'C₂H₅OH',
    desc: '所有酒类的灵魂分子',
    flavor: '绵柔 · 温热 · 辛辣',
    relatedSpirit: '威士忌 / 金酒 / 红酒',
    atoms: _BASES.ethanol.atoms,
    bonds: _BASES.ethanol.bonds,
  },
  ethyl_acetate: {
    name: '乙酸乙酯',
    formula: 'CH₃COOC₂H₅',
    desc: '果香的核心分子',
    flavor: '果香 · 甜润 · 清新',
    relatedSpirit: '红酒 / 白兰地',
    atoms: _BASES.ethyl_acetate.atoms,
    bonds: _BASES.ethyl_acetate.bonds,
  },
  limonene: {
    name: '柠檬烯',
    formula: 'C₁₀H₁₆',
    desc: '柑橘类精油的标志分子',
    flavor: '柑橘 · 清爽 · 振奋',
    relatedSpirit: '金酒 / 鸡尾酒装饰',
    atoms: _BASES.limonene.atoms,
    bonds: _BASES.limonene.bonds,
  },

  // --- 20 种企业家人格分子 ---
  ..._buildPersonaMolecules(),
};

// 人格分子 key 列表
export const PERSONA_KEYS = _PERSONA_DEFS.map((d) => d.key);

// ========================================
// 验证工具函数
// ========================================

/**
 * 获取分子数据,无效 key 回退到 ethanol
 */
export function getMolecule(key) {
  return MOLECULES[key] || MOLECULES.ethanol;
}

/**
 * 获取分子的原子数量
 */
export function getAtomCount(moleculeKey) {
  const mol = getMolecule(moleculeKey);
  return mol.atoms.length;
}

/**
 * 获取分子的化学键数量
 */
export function getBondCount(moleculeKey) {
  const mol = getMolecule(moleculeKey);
  return mol.bonds.length;
}

/**
 * 获取分子中各元素的数量统计
 */
export function getElementCounts(moleculeKey) {
  const mol = getMolecule(moleculeKey);
  const counts = {};
  for (const atom of mol.atoms) {
    counts[atom.element] = (counts[atom.element] || 0) + 1;
  }
  return counts;
}

/**
 * 获取所有人格分子(不含基础分子)
 */
export function getPersonalityMolecules() {
  const result = {};
  for (const key of PERSONA_KEYS) {
    result[key] = MOLECULES[key];
  }
  return result;
}

/**
 * 验证单个分子数据结构是否完整
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMolecule(molecule) {
  const errors = [];

  // 必填字段
  const requiredFields = ['name', 'formula', 'desc', 'flavor', 'relatedSpirit', 'atoms', 'bonds'];
  for (const field of requiredFields) {
    if (!(field in molecule)) {
      errors.push(`缺少必填字段: ${field}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 可选字段(人格分子有,基础分子可能没有)
  const optionalStringFields = ['temperature', 'presentation', 'relatedPersona', 'relatedPerson'];
  for (const field of optionalStringFields) {
    if (field in molecule && typeof molecule[field] !== 'string') {
      errors.push(`可选字段 ${field} 必须是字符串`);
    }
  }

  // 检查 atoms
  if (!Array.isArray(molecule.atoms) || molecule.atoms.length === 0) {
    errors.push('atoms 必须是非空数组');
    return { valid: false, errors };
  }

  const atomIds = new Set();

  for (let i = 0; i < molecule.atoms.length; i++) {
    const atom = molecule.atoms[i];
    const prefix = `atom[${i}]`;

    if (!atom.id) {
      errors.push(`${prefix} 缺少 id`);
    } else if (atomIds.has(atom.id)) {
      errors.push(`${prefix} 重复的 atom id: ${atom.id}`);
    }
    atomIds.add(atom.id);

    if (!atom.element) {
      errors.push(`${prefix}(${atom.id}) 缺少 element`);
    } else if (!SUPPORTED_ELEMENTS.includes(atom.element)) {
      errors.push(`${prefix}(${atom.id}) 不支持的元素类型: ${atom.element}`);
    }

    if (!Array.isArray(atom.position) || atom.position.length !== 3) {
      errors.push(`${prefix}(${atom.id}) position 必须是 3 元素数组`);
    } else if (!atom.position.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      errors.push(`${prefix}(${atom.id}) position 包含非数值`);
    }
  }

  // 检查 bonds
  if (!Array.isArray(molecule.bonds)) {
    errors.push('bonds 必须是数组');
    return { valid: false, errors };
  }

  for (let i = 0; i < molecule.bonds.length; i++) {
    const bond = molecule.bonds[i];
    const prefix = `bond[${i}]`;

    if (!bond.from || !bond.to) {
      errors.push(`${prefix} 缺少 from 或 to`);
      continue;
    }

    if (bond.from === bond.to) {
      errors.push(`${prefix} from 和 to 不能相同: ${bond.from}`);
    }

    if (!atomIds.has(bond.from)) {
      errors.push(`${prefix} from 引用了不存在的 atom id: ${bond.from}`);
    }
    if (!atomIds.has(bond.to)) {
      errors.push(`${prefix} to 引用了不存在的 atom id: ${bond.to}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证所有分子数据
 * @returns {{ valid: boolean, results: Record<string, {valid: boolean, errors: string[]}> }}
 */
export function validateAllMolecules() {
  const results = {};
  let allValid = true;

  for (const [key, molecule] of Object.entries(MOLECULES)) {
    const result = validateMolecule(molecule);
    results[key] = result;
    if (!result.valid) {
      allValid = false;
    }
  }

  return { valid: allValid, results };
}
