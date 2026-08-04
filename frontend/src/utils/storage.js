// localStorage 管理层 —— Y.Mine 行为决策沙盘

import { logger } from './logger';

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
      if (!raw) {
        logger.storage('读取: 无数据，返回默认值');
        return { ...defaultData };
      }
      const data = JSON.parse(raw);
      const size = new Blob([raw]).size;
      logger.storage(`读取: 成功 (${(size / 1024).toFixed(1)} KB)`);
      return { ...defaultData, ...data };
    } catch (e) {
      logger.error('Storage 读取失败', e);
      return { ...defaultData };
    }
  },

  saveAll(data) {
    try {
      const json = JSON.stringify(data);
      const size = new Blob([json]).size;
      localStorage.setItem(STORAGE_KEY, json);
      logger.storage(`写入: 成功 (${(size / 1024).toFixed(1)} KB)`);
    } catch (e) {
      logger.error('Storage 写入失败', e);
    }
  },

  get(key) {
    const all = this.getAll();
    const value = all[key];
    logger.storage(`GET [${key}]`, value !== undefined ? (typeof value === 'object' ? `Object(${Object.keys(value || {}).length} keys)` : value) : 'undefined');
    return value;
  },

  set(key, value) {
    logger.storage(`SET [${key}]`, typeof value === 'object' ? `Object(${Object.keys(value || {}).length} keys)` : value);
    const all = this.getAll();
    all[key] = value;
    this.saveAll(all);
  },

  update(key, updater) {
    logger.storage(`UPDATE [${key}]`);
    const all = this.getAll();
    const oldValue = all[key];
    all[key] = updater(all[key]);
    this.saveAll(all);
    logger.storage(`UPDATE [${key}] 完成`, typeof all[key] === 'object' ? '已更新' : all[key]);
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
