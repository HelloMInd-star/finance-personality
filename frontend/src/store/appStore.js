import { create } from 'zustand';
import { storage } from '../utils/storage';

export const useAppStore = create((set, get) => ({
  data: storage.getAll(),

  refresh() {
    set({ data: storage.getAll() });
  },

  setUserState(partial) {
    storage.setUserState(partial);
    get().refresh();
  },

  setCurrentSession(partial) {
    storage.setCurrentSession(partial);
    get().refresh();
  },

  addPokerGame(game) {
    storage.addPokerGame(game);
    get().refresh();
  },

  addBartenderSession(session) {
    storage.addBartenderSession(session);
    get().refresh();
  },

  addCoachConversation(conv) {
    storage.addCoachConversation(conv);
    get().refresh();
  },

  // 反馈回路：追加喝后评分到 feedbackHistory
  addFeedback(feedback) {
    storage.addFeedback(feedback);
    get().refresh();
  },

  // 反馈回路：基础向量持久化
  setBaseVector(vec) {
    storage.setBaseVector(vec);
    get().refresh();
  },

  setPsychologyProfile(partial) {
    const data = get().data;
    const updated = { ...data.psychologyProfile, ...partial };
    storage.set('psychologyProfile', updated);
    get().refresh();
  },

  clearAll() {
    storage.clearAll();
    get().refresh();
  },
}));
