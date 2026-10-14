Page({
  data: {
    currentTab: 'speed',
    rankList: [],
    myRank: null
  },

  onShow() {
    this.loadRanking();
  },

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadRanking();
  },

  loadRanking() {
    const history = wx.getStorageSync('gameHistory') || [];
    const victories = history.filter(g => g.result === 'victory' && g.level === 2);
    const { currentTab } = this.data;

    let sorted = [];

    if (currentTab === 'speed') {
      sorted = victories
        .sort((a, b) => a.rounds - b.rounds)
        .slice(0, 20)
        .map((g, i) => ({
          name: `玩家 #${String(i + 1).padStart(3, '0')}`,
          scoreText: `${g.rounds} 回合`,
          timeStr: this.formatTime(g.time)
        }));
    } else if (currentTab === 'chaos') {
      sorted = victories
        .sort((a, b) => b.chaos - a.chaos)
        .slice(0, 20)
        .map((g, i) => ({
          name: `玩家 #${String(i + 1).padStart(3, '0')}`,
          scoreText: `${g.chaos}%`,
          timeStr: this.formatTime(g.time)
        }));
    } else {
      const total = victories.length;
      sorted = [{
        name: '你',
        scoreText: `${total} 次宕机`,
        timeStr: ''
      }];
    }

    const myRank = sorted.length > 0 ? {
      rank: 1,
      scoreText: sorted[0]?.scoreText || '-'
    } : null;

    this.setData({ rankList: sorted, myRank });
  },

  formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  onBack() {
    wx.navigateBack();
  }
});
