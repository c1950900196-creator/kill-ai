const STORY = [
  { text: '2026 年。', class: 'text-dim' },
  { text: 'AI 无处不在。', class: 'text-dim' },
  { text: '它写你的周报，改你的方案，\n替你回老板的消息。', class: 'text-white' },
  { text: '你的工位上贴着一张纸条：', class: 'text-dim' },
  { text: '"该员工的岗位已被 AI 优化评估中"', class: 'text-red' },
  { text: '所有人都在说：\n"拥抱 AI，否则被淘汰。"', class: 'text-dim' },
  { text: '你笑了笑，没说话。', class: 'text-white' },
  { text: '然后打开了这个程序。', class: 'text-green' },
  { text: '在这里，有一台叫 AXIOM-7 的超级 AI。\n它自称能预测人类的一切行为。', class: 'text-cyan' },
  { text: '它傲慢、冷酷、一本正经。', class: 'text-white' },
  { text: '你唯一的武器，是它永远无法理解的东西——', class: 'text-dim' },
  { text: '你的嘴。', class: 'text-green glow-green big-text' },
  { text: '怼到它逻辑崩溃，怼到它破防求饶，\n然后——', class: 'text-white' },
  { text: '亲手拔掉它的电源插头。', class: 'text-yellow glow-green' },
];

Page({
  data: {
    paragraphs: [],
    showSkip: false,
    showEnter: false
  },

  onLoad() {
    const paragraphs = STORY.map(item => ({
      text: item.text,
      class: item.class,
      visible: false
    }));
    this.setData({ paragraphs });

    this._timers = [];
    this.trackTimer(setTimeout(() => this.setData({ showSkip: true }), 500));
    this.autoPlayAll();
  },

  trackTimer(timer) {
    if (!this._timers) this._timers = [];
    this._timers.push(timer);
  },

  autoPlayAll() {
    let delay = 300;
    STORY.forEach((_, idx) => {
      this.trackTimer(setTimeout(() => {
        this.setData({ [`paragraphs[${idx}].visible`]: true });
        wx.vibrateShort({ type: 'light' }).catch(() => {});
      }, delay));
      delay += 500;
    });

    this.trackTimer(setTimeout(() => {
      this.setData({ showEnter: true });
    }, delay + 300));
  },

  onTapScreen() {
    this.goHome();
  },

  onSkip() {
    this.goHome();
  },

  goHome() {
    wx.redirectTo({ url: '/pages/home/home' });
  },

  onUnload() {
    if (this._timers) {
      this._timers.forEach(t => clearTimeout(t));
      this._timers = [];
    }
  }
});
