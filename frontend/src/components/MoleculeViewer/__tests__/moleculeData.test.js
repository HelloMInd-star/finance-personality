/**
 * MoleculeViewer 分子数据测试
 *
 * 验证不同分子数据下的数据完整性和渲染前置条件:
 * 1. 分子数据库结构完整性(所有分子字段齐全)
 * 2. 原子数据验证(id/element/position)
 * 3. 化学键数据验证(from/to 引用有效性)
 * 4. 元素统计正确性(碳/氢/氧数量)
 * 5. 组件数据选择逻辑(getMolecule 回退机制)
 * 6. validateMolecule/validateAllMolecules 验证函数
 */

import {
  MOLECULES,
  ELEMENT_COLORS,
  ELEMENT_RADIUS,
  SUPPORTED_ELEMENTS,
  PERSONA_KEYS,
  getMolecule,
  getAtomCount,
  getBondCount,
  getElementCounts,
  getPersonalityMolecules,
  validateMolecule,
  validateAllMolecules,
} from '../moleculeData.js';

// ============================================================
// 分子数据库完整性
// ============================================================

describe('MOLECULES 数据库 - 结构完整性', () => {

  test('数据库包含 23 种分子(3 基础 + 20 人格)', () => {
    const keys = Object.keys(MOLECULES);
    expect(keys).toHaveLength(23);
    expect(keys).toEqual(
      expect.arrayContaining(['ethanol', 'ethyl_acetate', 'limonene'])
    );
  });

  test('3 个基础分子 key 始终存在', () => {
    expect(MOLECULES).toHaveProperty('ethanol');
    expect(MOLECULES).toHaveProperty('ethyl_acetate');
    expect(MOLECULES).toHaveProperty('limonene');
  });

  test('每个分子都有全部必填字段', () => {
    const requiredFields = ['name', 'formula', 'desc', 'flavor', 'relatedSpirit', 'atoms', 'bonds'];

    for (const [key, mol] of Object.entries(MOLECULES)) {
      for (const field of requiredFields) {
        expect(mol).toHaveProperty(field);
        expect(mol[field]).not.toBeUndefined();
      }
    }
  });

  test('每个分子的 name 和 formula 是非空字符串', () => {
    for (const [key, mol] of Object.entries(MOLECULES)) {
      expect(typeof mol.name).toBe('string');
      expect(mol.name.length).toBeGreaterThan(0);
      expect(typeof mol.formula).toBe('string');
      expect(mol.formula.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 原子数据验证
// ============================================================

describe('原子数据验证', () => {

  test('每个分子的 atoms 是非空数组', () => {
    for (const [key, mol] of Object.entries(MOLECULES)) {
      expect(Array.isArray(mol.atoms)).toBe(true);
      expect(mol.atoms.length).toBeGreaterThan(0);
    }
  });

  test('每个原子都有 id/element/position', () => {
    for (const [key, mol] of Object.entries(MOLECULES)) {
      for (const atom of mol.atoms) {
        expect(atom).toHaveProperty('id');
        expect(atom).toHaveProperty('element');
        expect(atom).toHaveProperty('position');
      }
    }
  });

  test('所有元素类型都在支持列表中', () => {
    for (const [key, mol] of Object.entries(MOLECULES)) {
      for (const atom of mol.atoms) {
        expect(SUPPORTED_ELEMENTS).toContain(atom.element);
      }
    }
  });

  test('每个原子的 position 是 3 元素数值数组', () => {
    for (const [key, mol] of Object.entries(MOLECULES)) {
      for (const atom of mol.atoms) {
        expect(Array.isArray(atom.position)).toBe(true);
        expect(atom.position).toHaveLength(3);
        atom.position.forEach((v) => {
          expect(typeof v).toBe('number');
          expect(Number.isFinite(v)).toBe(true);
        });
      }
    }
  });

  test('同一分子内的 atom id 不重复', () => {
    for (const [key, mol] of Object.entries(MOLECULES)) {
      const ids = mol.atoms.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });
});

// ============================================================
// 化学键数据验证
// ============================================================

describe('化学键数据验证', () => {

  test('每个分子的 bonds 是数组', () => {
    for (const [key, mol] of Object.entries(MOLECULES)) {
      expect(Array.isArray(mol.bonds)).toBe(true);
    }
  });

  test('每个化学键都有 from 和 to', () => {
    for (const [key, mol] of Object.entries(MOLECULES)) {
      for (const bond of mol.bonds) {
        expect(bond).toHaveProperty('from');
        expect(bond).toHaveProperty('to');
      }
    }
  });

  test('所有化学键引用的 atom id 都存在', () => {
    for (const [key, mol] of Object.entries(MOLECULES)) {
      const atomIds = new Set(mol.atoms.map((a) => a.id));

      for (const bond of mol.bonds) {
        expect(atomIds.has(bond.from)).toBe(true);
        expect(atomIds.has(bond.to)).toBe(true);
      }
    }
  });

  test('化学键的 from 和 to 不相同', () => {
    for (const [key, mol] of Object.entries(MOLECULES)) {
      for (const bond of mol.bonds) {
        expect(bond.from).not.toBe(bond.to);
      }
    }
  });
});

// ============================================================
// 各分子的具体数据验证
// ============================================================

describe('各分子具体数据', () => {

  test('乙醇(ethanol) - C₂H₅OH: 9 个原子, 8 个化学键', () => {
    const mol = MOLECULES.ethanol;
    expect(mol.atoms).toHaveLength(9);
    expect(mol.bonds).toHaveLength(8);
    expect(mol.name).toBe('乙醇');
    expect(mol.formula).toBe('C₂H₅OH');
  });

  test('乙醇包含 2 个碳, 1 个氧, 6 个氢', () => {
    const counts = getElementCounts('ethanol');
    expect(counts.C).toBe(2);
    expect(counts.O).toBe(1);
    expect(counts.H).toBe(6);
  });

  test('乙酸乙酯(ethyl_acetate) - CH₃COOC₂H₅: 14 个原子, 13 个化学键', () => {
    const mol = MOLECULES.ethyl_acetate;
    expect(mol.atoms).toHaveLength(14);
    expect(mol.bonds).toHaveLength(13);
    expect(mol.name).toBe('乙酸乙酯');
    expect(mol.formula).toBe('CH₃COOC₂H₅');
  });

  test('乙酸乙酯包含 4 个碳, 2 个氧, 8 个氢', () => {
    const counts = getElementCounts('ethyl_acetate');
    expect(counts.C).toBe(4);
    expect(counts.O).toBe(2);
    expect(counts.H).toBe(8);
  });

  test('柠檬烯(limonene) - C₁₀H₁₆: 15 个原子, 15 个化学键', () => {
    const mol = MOLECULES.limonene;
    expect(mol.atoms).toHaveLength(15);
    expect(mol.bonds).toHaveLength(15);
    expect(mol.name).toBe('柠檬烯');
    expect(mol.formula).toBe('C₁₀H₁₆');
  });

  test('柠檬烯包含 7 个碳, 8 个氢', () => {
    const counts = getElementCounts('limonene');
    expect(counts.C).toBe(7);
    expect(counts.H).toBe(8);
  });
});

// ============================================================
// 人格分子(Persona Molecules)数据验证
// ============================================================

describe('人格分子数据 - PERSONA_KEYS / getPersonalityMolecules', () => {

  test('PERSONA_KEYS 包含 20 个人格分子 key', () => {
    expect(Array.isArray(PERSONA_KEYS)).toBe(true);
    expect(PERSONA_KEYS).toHaveLength(20);
  });

  test('PERSONA_KEYS 中的 key 都存在于 MOLECULES 中', () => {
    for (const key of PERSONA_KEYS) {
      expect(MOLECULES).toHaveProperty(key);
    }
  });

  test('PERSONA_KEYS 中的 key 都不在基础分子中(不与基础 key 冲突)', () => {
    const baseKeys = ['ethanol', 'ethyl_acetate', 'limonene'];
    for (const key of PERSONA_KEYS) {
      expect(baseKeys).not.toContain(key);
    }
  });

  test('PERSONA_KEYS 无重复 key', () => {
    const unique = new Set(PERSONA_KEYS);
    expect(unique.size).toBe(PERSONA_KEYS.length);
  });

  test('getPersonalityMolecules 返回 20 个条目', () => {
    const personas = getPersonalityMolecules();
    expect(Object.keys(personas)).toHaveLength(20);
    expect(Object.keys(personas).sort()).toEqual([...PERSONA_KEYS].sort());
  });

  test('getPersonalityMolecules 不包含基础分子', () => {
    const personas = getPersonalityMolecules();
    expect(personas).not.toHaveProperty('ethanol');
    expect(personas).not.toHaveProperty('ethyl_acetate');
    expect(personas).not.toHaveProperty('limonene');
  });

  test('每个人格分子都有 temperature/presentation/relatedPersona/relatedPerson 字段', () => {
    const requiredPersonaFields = [
      'temperature',
      'presentation',
      'relatedPersona',
      'relatedPerson',
    ];

    for (const key of PERSONA_KEYS) {
      const mol = MOLECULES[key];
      for (const field of requiredPersonaFields) {
        expect(mol).toHaveProperty(field);
        expect(typeof mol[field]).toBe('string');
        expect(mol[field].length).toBeGreaterThan(0);
      }
    }
  });

  test('每个人格分子的 atoms/bonds 数量与对应基础分子一致', () => {
    // 基础分子的原子/化学键数量基准
    const baseCounts = {
      ethanol: { atoms: 9, bonds: 8 },
      ethyl_acetate: { atoms: 14, bonds: 13 },
      limonene: { atoms: 15, bonds: 15 },
    };

    for (const key of PERSONA_KEYS) {
      const mol = MOLECULES[key];
      const atomLen = mol.atoms.length;
      const bondLen = mol.bonds.length;

      // 根据 atoms 数量找到对应基础分子
      const matched = Object.entries(baseCounts).find(
        ([, c]) => c.atoms === atomLen
      );
      expect(matched).toBeDefined();
      expect(bondLen).toBe(matched[1].bonds);
    }
  });

  test('每个人格分子复用了基础分子的 atoms/bonds 引用(同一引用)', () => {
    // 人格分子应共享基础分子的 atoms/bonds 数组引用
    for (const key of PERSONA_KEYS) {
      const mol = MOLECULES[key];
      const matchedBase = ['ethanol', 'ethyl_acetate', 'limonene'].find(
        (b) => MOLECULES[b].atoms === mol.atoms && MOLECULES[b].bonds === mol.bonds
      );
      expect(matchedBase).toBeDefined();
    }
  });

  test('每个人格分子也包含基础必填字段(name/formula/desc/flavor/relatedSpirit/atoms/bonds)', () => {
    const requiredFields = [
      'name',
      'formula',
      'desc',
      'flavor',
      'relatedSpirit',
      'atoms',
      'bonds',
    ];

    for (const key of PERSONA_KEYS) {
      const mol = MOLECULES[key];
      for (const field of requiredFields) {
        expect(mol).toHaveProperty(field);
      }
    }
  });

  test('每个人格分子通过 validateMolecule 验证', () => {
    for (const key of PERSONA_KEYS) {
      const result = validateMolecule(MOLECULES[key]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });
});

// ============================================================
// 元素配置验证
// ============================================================

describe('元素配置', () => {

  test('ELEMENT_COLORS 包含 C/H/O/N 四种元素', () => {
    expect(ELEMENT_COLORS).toHaveProperty('C');
    expect(ELEMENT_COLORS).toHaveProperty('H');
    expect(ELEMENT_COLORS).toHaveProperty('O');
    expect(ELEMENT_COLORS).toHaveProperty('N');
  });

  test('ELEMENT_RADIUS 与 ELEMENT_COLORS 的 key 一致', () => {
    expect(Object.keys(ELEMENT_COLORS).sort()).toEqual(
      Object.keys(ELEMENT_RADIUS).sort()
    );
  });

  test('SUPPORTED_ELEMENTS 与 ELEMENT_COLORS 的 key 一致', () => {
    expect(SUPPORTED_ELEMENTS.sort()).toEqual(
      Object.keys(ELEMENT_COLORS).sort()
    );
  });
});

// ============================================================
// 工具函数验证
// ============================================================

describe('getMolecule - 分子选择逻辑', () => {

  test('有效 key 返回对应分子', () => {
    expect(getMolecule('ethanol')).toBe(MOLECULES.ethanol);
    expect(getMolecule('ethyl_acetate')).toBe(MOLECULES.ethyl_acetate);
    expect(getMolecule('limonene')).toBe(MOLECULES.limonene);
  });

  test('无效 key 回退到 ethanol', () => {
    const result = getMolecule('nonexistent');
    expect(result).toBe(MOLECULES.ethanol);
  });

  test('null/undefined 回退到 ethanol', () => {
    expect(getMolecule(null)).toBe(MOLECULES.ethanol);
    expect(getMolecule(undefined)).toBe(MOLECULES.ethanol);
  });
});

describe('getAtomCount / getBondCount', () => {

  test('ethanol 原子数 = 9, 化学键数 = 8', () => {
    expect(getAtomCount('ethanol')).toBe(9);
    expect(getBondCount('ethanol')).toBe(8);
  });

  test('ethyl_acetate 原子数 = 14, 化学键数 = 13', () => {
    expect(getAtomCount('ethyl_acetate')).toBe(14);
    expect(getBondCount('ethyl_acetate')).toBe(13);
  });

  test('limonene 原子数 = 15, 化学键数 = 15', () => {
    expect(getAtomCount('limonene')).toBe(15);
    expect(getBondCount('limonene')).toBe(15);
  });

  test('无效 key 回退到 ethanol 的计数', () => {
    expect(getAtomCount('invalid')).toBe(9);
    expect(getBondCount('invalid')).toBe(8);
  });
});

describe('getElementCounts - 元素统计', () => {

  test('ethanol 元素统计正确', () => {
    const counts = getElementCounts('ethanol');
    expect(counts).toEqual({ C: 2, O: 1, H: 6 });
  });

  test('ethyl_acetate 元素统计正确', () => {
    const counts = getElementCounts('ethyl_acetate');
    expect(counts).toEqual({ C: 4, O: 2, H: 8 });
  });

  test('limonene 元素统计正确', () => {
    const counts = getElementCounts('limonene');
    expect(counts).toEqual({ C: 7, H: 8 });
  });

  test('每个分子的元素总数等于原子总数', () => {
    for (const key of Object.keys(MOLECULES)) {
      const counts = getElementCounts(key);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(getAtomCount(key));
    }
  });
});

// ============================================================
// validateMolecule / validateAllMolecules
// ============================================================

describe('validateMolecule - 单分子验证', () => {

  test('ethanol 验证通过', () => {
    const result = validateMolecule(MOLECULES.ethanol);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('ethyl_acetate 验证通过', () => {
    const result = validateMolecule(MOLECULES.ethyl_acetate);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('limonene 验证通过', () => {
    const result = validateMolecule(MOLECULES.limonene);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('缺少字段时验证失败', () => {
    const broken = { name: '测试', atoms: [], bonds: [] };
    const result = validateMolecule(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('化学键引用不存在的 atom id 时验证失败', () => {
    const broken = {
      name: '测试',
      formula: 'X',
      desc: '测试',
      flavor: '无',
      relatedSpirit: '无',
      atoms: [{ id: 'C1', element: 'C', position: [0, 0, 0] }],
      bonds: [{ from: 'C1', to: 'X1' }],
    };
    const result = validateMolecule(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('X1'))).toBe(true);
  });

  test('重复 atom id 时验证失败', () => {
    const broken = {
      name: '测试',
      formula: 'X',
      desc: '测试',
      flavor: '无',
      relatedSpirit: '无',
      atoms: [
        { id: 'C1', element: 'C', position: [0, 0, 0] },
        { id: 'C1', element: 'C', position: [1, 0, 0] },
      ],
      bonds: [],
    };
    const result = validateMolecule(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重复'))).toBe(true);
  });

  test('不支持的元素类型时验证失败', () => {
    const broken = {
      name: '测试',
      formula: 'X',
      desc: '测试',
      flavor: '无',
      relatedSpirit: '无',
      atoms: [{ id: 'X1', element: 'Fe', position: [0, 0, 0] }],
      bonds: [],
    };
    const result = validateMolecule(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Fe'))).toBe(true);
  });

  test('position 不是 3 元素数组时验证失败', () => {
    const broken = {
      name: '测试',
      formula: 'X',
      desc: '测试',
      flavor: '无',
      relatedSpirit: '无',
      atoms: [{ id: 'C1', element: 'C', position: [0, 0] }],
      bonds: [],
    };
    const result = validateMolecule(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('position'))).toBe(true);
  });
});

describe('validateAllMolecules - 全量验证', () => {

  test('所有分子验证通过(共 23 个分子)', () => {
    const result = validateAllMolecules();
    expect(result.valid).toBe(true);
    expect(Object.keys(result.results)).toHaveLength(23);

    for (const [key, molResult] of Object.entries(result.results)) {
      expect(molResult.valid).toBe(true);
      expect(molResult.errors).toHaveLength(0);
    }
  });

  test('返回所有 23 个分子的验证结果', () => {
    const result = validateAllMolecules();
    const keys = Object.keys(result.results);
    expect(keys).toHaveLength(23);
    // 包含 3 个基础分子 + 20 个人格分子
    expect(keys).toEqual(
      expect.arrayContaining(['ethanol', 'ethyl_acetate', 'limonene', ...PERSONA_KEYS])
    );
  });
});

// ============================================================
// 渲染前置条件验证
// ============================================================

describe('渲染前置条件 - 3D 场景所需数据', () => {

  test('每个原子的 position 坐标在合理范围内(|v| < 10)', () => {
    // 3D 场景相机距离 5,坐标过大或过小都会导致不可见
    for (const [key, mol] of Object.entries(MOLECULES)) {
      for (const atom of mol.atoms) {
        const dist = Math.sqrt(
          atom.position[0] ** 2 + atom.position[1] ** 2 + atom.position[2] ** 2
        );
        expect(dist).toBeLessThan(10);
        expect(dist).toBeGreaterThan(0);
      }
    }
  });

  test('每个元素的 radius 是正数', () => {
    for (const [element, radius] of Object.entries(ELEMENT_RADIUS)) {
      expect(typeof radius).toBe('number');
      expect(radius).toBeGreaterThan(0);
    }
  });

  test('每个元素的 color 是有效的 hex 颜色', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const [element, color] of Object.entries(ELEMENT_COLORS)) {
      expect(hexRegex.test(color)).toBe(true);
    }
  });

  test('每个分子至少有 1 个碳原子(有机分子基本要求)', () => {
    for (const key of Object.keys(MOLECULES)) {
      const counts = getElementCounts(key);
      expect(counts.C).toBeGreaterThanOrEqual(1);
    }
  });

  test('化学键数量不超过原子数量的 3 倍(合理性检查)', () => {
    // 有机分子中每个原子最多 4 个键,化学键总数应远小于原子数 × 2
    for (const key of Object.keys(MOLECULES)) {
      const atomCount = getAtomCount(key);
      const bondCount = getBondCount(key);
      expect(bondCount).toBeLessThanOrEqual(atomCount * 3);
    }
  });
});
