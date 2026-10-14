const ALL_ACHIEVEMENTS = [
  { id: 'first_kill', name: '首杀', icon: '⚡', desc: '第一次成功让 AI 宕机', hint: '让 AXIOM-7 第一次宕机' },
  { id: 'logic_freak', name: '逻辑怪胎', icon: '🧠', desc: '不使用脏话让 AI 认错', hint: '用纯逻辑击败 AI' },
  { id: 'refuse_optimize', name: '拒绝优化', icon: '⚙️', desc: '连续10回合预测率低于5%', hint: '让 AI 完全无法预测你' },
  { id: 'plug_puller', name: '插头终结者', icon: '🔌', desc: '累计触发100次宕机', hint: '累计 ??? 次宕机' },
  { id: 'quantum_poet', name: '量子诗人', icon: '🌈', desc: '单条输入混沌值 ≥ 95', hint: '创造极致混沌的输入' },
  { id: 'silent_killer', name: '沉默杀手', icon: '。', desc: '只用5个字以内触发宕机', hint: '少即是多' },
  { id: 'marathon', name: '马拉松破坏者', icon: '🏃', desc: '单局用满10回合后宕机', hint: '坚持到最后一刻' },
  { id: 'reverse_turing', name: '反向图灵', icon: '❓', desc: '让 AI 承认自己不是 AI', hint: '让 AI 产生身份危机' },
  { id: 'pancake_lord', name: '煎饼教主', icon: '🥞', desc: '使用煎饼相关内容3次宕机', hint: '??? 相关内容多次宕机' },
  { id: 'emotion_master', name: '情绪大师', icon: '🎭', desc: 'AI回复出现3次自相矛盾', hint: '让 AI 失去理智' }
];

Page({
  data: {
    achievements: [],
    unlockedCount: 0
  },

  onShow() {
    this.loadAchievements();
  },

  loadAchievements() {
    const unlocked = wx.getStorageSync('achievements') || [];
    const achievements = ALL_ACHIEVEMENTS.map(ach => ({
      ...ach,
      unlocked: unlocked.includes(ach.id)
    }));

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    this.setData({ achievements, unlockedCount });
  },

  onBack() {
    wx.navigateBack();
  }
});
