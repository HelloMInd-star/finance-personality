/* ============================================================
   localAuth.js · 本地账号体系（后端下线降级）
   ------------------------------------------------------------
   背景：Railway 后端已下线，/auth/login · /auth/register 404。
   方案：本地 localStorage 账号库 + 演示级密码散列。
   - 注册：创建本地账号（用户名唯一，密码非明文存储）
   - 登录：本地校验，返回 access_token 形状对齐后端
   - 仅用于"解锁 AI 个性化能力"的门控交互，非安全系统
   ============================================================ */
const USERS_KEY = 'ymine_local_users';

// 演示级散列：djb2 + 盐（避免明文；不用于真实安全场景）
function hashPassword(pw) {
  const salted = `ymine::${pw}::local-salt`;
  let h = 5381;
  for (let i = 0; i < salted.length; i++) {
    h = ((h << 5) + h + salted.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function makeToken(username) {
  return `local-${username}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const localAuth = {
  async login(username, password) {
    const users = loadUsers();
    const u = users.find((x) => x.username === username);
    if (!u) throw new Error('用户不存在，请先注册');
    if (u.passwordHash !== hashPassword(password)) throw new Error('密码错误，请重试');
    return { access_token: makeToken(username) };
  },

  async register(username, email, password) {
    const users = loadUsers();
    if (users.some((x) => x.username === username)) throw new Error('用户名已存在，请直接登录');
    const user = {
      username,
      email: email || '',
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
    };
    saveUsers([...users, user]);
    return { token: makeToken(username) };
  },
};

export default localAuth;
