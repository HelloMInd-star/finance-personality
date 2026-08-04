// localStorage 管理层 —— Y.Mine 行为决策沙盘

const STORAGE_KEY = 'ymine_sandbox_v1';

const defaultData = {
  user: { name: '隐士' },
  userState: {
    soberDays: 0,
    currentMbti: 'INTJ',
    mbtiConfidence: 60,
  },
  currentSession: {
    storyMode: null, // 'cigar' | 'firework'
    bartender: 'Cole',
    startTime: null,
  },
  pokerGames: [],
  bartenderSessions: [],
  billiardsGames: [],
  fitnessSessions: [],
  coachConversations: [],
  psychologyProfile: {
    radarData: {},
    biasTags: [],
    industryMapping: '',
    mbtiMix: {},
    klineData: [],
  },
};

export const storage = {
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultData };
      const data = JSON.parse(raw);
      return { ...defaultData, ...data };
    } catch (e) {
      console.error('Storage read error:', e);
      return { ...defaultData };
    }
  },

  saveAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Storage save error:', e);
    }
  },

  get(key) {
    const all = this.getAll();
    return all[key];
  },

  set(key, value) {
    const all = this.getAll();
    all[key] = value;
    this.saveAll(all);
  },

  update(key, updater) {
    const all = this.getAll();
    all[key] = updater(all[key]);
    this.saveAll(all);
    return all[key];
  },

  // 快捷方法
  getUser() { return this.get('user'); },
  getUserState() { return this.get('userState'); },
  getCurrentSession() { return this.get('currentSession'); },

  setUserState(partial) {
    return this.update('userState', (prev) => ({ ...prev, ...partial }));
  },

  setCurrentSession(partial) {
    return this.update('currentSession', (prev) => ({ ...prev, ...partial }));
  },

  // 历史记录
  addPokerGame(game) {
    return this.update('pokerGames', (prev) => [...prev, { ...game, id: Date.now(), timestamp: Date.now() }]);
  },

  addBartenderSession(session) {
    return this.update('bartenderSessions', (prev) => [...prev, { ...session, id: Date.now(), timestamp: Date.now() }]);
  },

  addCoachConversation(conv) {
    return this.update('coachConversations', (prev) => [...prev, { ...conv, id: Date.now(), timestamp: Date.now() }]);
  },

  // 清理
  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  },

  // 导出
  exportData() {
    return JSON.stringify(this.getAll(), null, 2);
  },
};

export default storage;
