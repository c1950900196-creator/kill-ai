const DEFAULT_SHARE_TEXTS = [
  '我要变成AI了，快来救救我吧！',
  '是兄弟就快点来帮我一起干掉AI',
  'AI怎么这么坏啊！！！！'
];

Page({
  data: {
    soundEnabled: true,
    vibrationEnabled: true,
    shareTexts: [],
    shareImage: ''
  },

  onLoad() {
    const app = getApp();
    const shareTexts = wx.getStorageSync('shareTexts') || DEFAULT_SHARE_TEXTS.slice();
    const shareImage = wx.getStorageSync('shareImage') || '';
    this.setData({
      soundEnabled: app.globalData.settings.soundEnabled,
      vibrationEnabled: app.globalData.settings.vibrationEnabled,
      shareTexts,
      shareImage
    });
  },

  onSoundToggle(e) {
    const val = e.detail.value;
    this.setData({ soundEnabled: val });
    const app = getApp();
    app.globalData.settings.soundEnabled = val;
    app.saveSettings();
  },

  onVibrationToggle(e) {
    const val = e.detail.value;
    this.setData({ vibrationEnabled: val });
    const app = getApp();
    app.globalData.settings.vibrationEnabled = val;
    app.saveSettings();
  },

  onClearData() {
    wx.showModal({
      title: '确认清除',
      content: '将清除所有游戏记录、画廊和成就数据，此操作不可恢复！',
      confirmText: '确认清除',
      confirmColor: '#ff3366',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({ title: '数据已清除', icon: 'success' });
        }
      }
    });
  },

  onShareTextInput(e) {
    const idx = e.currentTarget.dataset.index;
    const val = e.detail.value;
    const texts = this.data.shareTexts.slice();
    texts[idx] = val;
    this.setData({ shareTexts: texts });
  },

  onShareTextDel(e) {
    const idx = e.currentTarget.dataset.index;
    const texts = this.data.shareTexts.slice();
    texts.splice(idx, 1);
    this.setData({ shareTexts: texts });
  },

  onShareTextAdd() {
    const texts = this.data.shareTexts.slice();
    texts.push('');
    this.setData({ shareTexts: texts });
  },

  onChooseShareImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        this.setData({ shareImage: tempPath });
      }
    });
  },

  onClearShareImage() {
    this.setData({ shareImage: '' });
  },

  onSaveShareConfig() {
    const { shareTexts, shareImage } = this.data;
    const validTexts = shareTexts.filter(t => t.trim().length > 0);
    if (validTexts.length === 0) {
      wx.showToast({ title: '至少保留一条文案', icon: 'none' });
      return;
    }
    wx.setStorageSync('shareTexts', validTexts);
    wx.setStorageSync('shareImage', shareImage);
    this.setData({ shareTexts: validTexts });
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  onBack() {
    wx.navigateBack();
  }
});
