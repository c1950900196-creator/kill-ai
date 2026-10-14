App({
  globalData: {
    userInfo: null,
    openid: '',
    totalMeltdowns: 0,
    settings: {
      soundEnabled: true,
      vibrationEnabled: true
    }
  },

  onLaunch() {
    try {
      wx.cloud.init({
        env: 'YOUR_CLOUD_ENV_ID',
        traceUser: true
      });
      this.globalData.cloudReady = true;
    } catch (e) {
      console.warn('云开发初始化失败，离线模式运行', e);
      this.globalData.cloudReady = false;
    }

    const settings = wx.getStorageSync('settings');
    if (settings) {
      this.globalData.settings = settings;
    }

    const cachedUser = wx.getStorageSync('userInfo');
    if (cachedUser) {
      this.globalData.userInfo = cachedUser;
    }

    if (this.globalData.cloudReady) {
      this.login();
    }
  },

  login() {
    wx.cloud.callFunction({
      name: 'login',
      success: (res) => {
        if (res.result && res.result.openid) {
          this.globalData.openid = res.result.openid;
        }
      },
      fail: (err) => {
        console.warn('login 云函数调用失败', err);
      }
    });
  },

  saveSettings() {
    wx.setStorageSync('settings', this.globalData.settings);
  }
});
