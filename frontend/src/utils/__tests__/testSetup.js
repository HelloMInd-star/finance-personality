/**
 * 测试共享环境 - 模拟浏览器 localStorage 和 logger
 * 在每个测试文件顶部 import 此文件即可获得沙箱环境
 */

// ============= localStorage 沙箱 mock =============
const _store = new Map();

const localStorageMock = {
  getItem: (key) => {
    return _store.has(key) ? _store.get(key) : null;
  },
  setItem: (key, value) => {
    _store.set(key, String(value));
  },
  removeItem: (key) => {
    _store.delete(key);
  },
  clear: () => {
    _store.clear();
  },
  key: (index) => {
    const keys = Array.from(_store.keys());
    return keys[index] || null;
  },
  get length() {
    return _store.size;
  },
};

// 注入到 globalThis
globalThis.localStorage = localStorageMock;

// 每个测试前清空 store，避免交叉污染
beforeEach(() => {
  _store.clear();
});

export { localStorageMock };
