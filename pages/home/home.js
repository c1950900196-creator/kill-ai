Page({
  data: {
    globalMeltdowns: '---'
  },

  onLoad() {
    this.loadGlobalCount();
  },

  onShow() {
    this.loadGlobalCount();
  },

  loadGlobalCount() {
    const count = wx.getStorageSync('totalMeltdowns') || 0;
    this.setData({
      globalMeltdowns: this.formatNumber(count)
    });
  },

  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  onStartBattle() {
    wx.vibrateShort({ type: 'medium' }).catch(() => {});
    wx.navigateTo({ url: '/pages/battle/battle' });
  },

  onGoGallery() {
    wx.navigateTo({ url: '/pages/gallery/gallery' });
  },

  onGoAchievements() {
    wx.navigateTo({ url: '/pages/achievements/achievements' });
  },

  onGoRanking() {
    wx.navigateTo({ url: '/pages/ranking/ranking' });
  },

  onGoSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' });
  }
});
