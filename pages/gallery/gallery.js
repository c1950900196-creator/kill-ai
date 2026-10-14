Page({
  data: {
    gallery: []
  },

  onShow() {
    this.loadGallery();
  },

  loadGallery() {
    const gallery = wx.getStorageSync('gallery') || [];
    gallery.forEach(item => {
      item.timeStr = this.formatTime(item.time);
      if (item.messages && item.messages.length > 3) {
        item.messages = item.messages.slice(-3);
      }
    });
    this.setData({ gallery });
  },

  formatTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  onShare(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.gallery[index];

    const slogans = [
      '我把一台超级AI怼到自闭了。',
      'AXIOM-7 说要取代我，结果它先破防了。',
      'AI 说人类会被淘汰？先淘汰你自己吧。',
      '今天我成功让一个AI怀疑自己存在的意义。',
      '它说能取代一切，但取代不了我的嘴。'
    ];
    const slogan = slogans[Math.floor(Math.random() * slogans.length)];

    wx.showToast({
      title: '海报功能开发中',
      icon: 'none'
    });
  },

  onDelete(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      success: (res) => {
        if (res.confirm) {
          const gallery = this.data.gallery;
          gallery.splice(index, 1);
          wx.setStorageSync('gallery', gallery);
          this.setData({ gallery });
        }
      }
    });
  },

  onBack() {
    wx.navigateBack();
  }
});
