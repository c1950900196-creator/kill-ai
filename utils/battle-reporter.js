const MAX_PENDING_REPORTS = 200;
const PENDING_REPORTS_STORAGE_KEY = 'battle_pending_reports_v1';
const START_RETRY_MAX = 3;

module.exports = {
  loadPendingReportsFromStorage() {
    try {
      const cached = wx.getStorageSync(PENDING_REPORTS_STORAGE_KEY);
      if (Array.isArray(cached)) {
        this._pendingReports = cached.slice(0, MAX_PENDING_REPORTS);
      }
    } catch (e) {
      this._pendingReports = [];
    }
  },

  persistPendingReports() {
    try {
      wx.setStorageSync(PENDING_REPORTS_STORAGE_KEY, (this._pendingReports || []).slice(0, MAX_PENDING_REPORTS));
    } catch (e) {}
  },

  enqueuePendingReport(action, data, persist = true) {
    if (!this._pendingReports) this._pendingReports = [];
    if (this._pendingReports.length >= MAX_PENDING_REPORTS) {
      this._pendingReports.shift();
    }
    this._pendingReports.push({ action, data });
    if (persist) {
      this.persistPendingReports();
    }
  },

  createEventId(prefix = 'evt') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  },

  sendReport(action, data, retry = 0) {
    wx.cloud.callFunction({
      name: 'reportGame',
      data: { action, data },
      success: (res) => {
        if (action === 'end' && res.result && res.result.success) {
          this._sessionId = null;
        }
      },
      fail: (err) => {
        if (retry >= 3) {
          console.warn(`[Cloud] ${action} 上报失败（放弃）`, err);
          // 有 sessionId 的失败上报持久化，便于下次启动补发
          if (data && data.sessionId) {
            this.enqueuePendingReport(action, data, true);
          }
          return;
        }
        const timer = setTimeout(() => {
          this.sendReport(action, data, retry + 1);
        }, 1000 * (retry + 1));
        this._reportRetryTimers.push(timer);
      }
    });
  },

  flushPendingReports() {
    if (!this._sessionId || !this._pendingReports || this._pendingReports.length === 0) return;
    const pending = this._pendingReports.slice();
    this._pendingReports = [];
    this.persistPendingReports();
    pending.forEach((item) => {
      const payload = item.data && item.data.sessionId
        ? item.data
        : { ...item.data, sessionId: this._sessionId };
      this.sendReport(item.action, payload);
    });
  },

  reportGameStart(level, retry = 0) {
    const app = getApp();
    if (!app.globalData.cloudReady) return;
    const userInfo = app.globalData.userInfo || {};
    wx.cloud.callFunction({
      name: 'reportGame',
      data: {
        action: 'start',
        data: {
          nickname: userInfo.nickname || '匿名用户',
          avatar: userInfo.avatar || '',
          level: level,
          levelName: this.data.levelName,
          predictability: this.data.predictability
        }
      },
      success: (res) => {
        if (res.result && res.result.sessionId) {
          this._sessionId = res.result.sessionId;
          console.log('[Cloud] sessionId =', this._sessionId);
          this.flushPendingReports();
        }
      },
      fail: (err) => {
        console.warn('[Cloud] reportGameStart 失败', err);
        if (retry < START_RETRY_MAX) {
          const timer = setTimeout(() => {
            this.reportGameStart(level, retry + 1);
          }, 1000 * (retry + 1));
          this._reportRetryTimers.push(timer);
        }
      }
    });
  },

  reportMessage(role, content) {
    const payload = {
      role: role,
      content: content,
      chaos: this.data.chaos,
      predictability: this.data.predictability,
      eventId: this.createEventId('msg')
    };
    if (!this._sessionId) {
      this.enqueuePendingReport('message', payload, false);
      return;
    }
    this.sendReport('message', { ...payload, sessionId: this._sessionId });
  },

  reportGameEnd(result) {
    const duration = Math.floor((Date.now() - this._gameStartTime) / 1000);
    const payload = {
      result: result,
      duration: duration,
      chaos: this.data.chaos,
      predictability: this.data.predictability,
      eventId: this.createEventId('end')
    };
    if (!this._sessionId) {
      this.enqueuePendingReport('end', payload, false);
      console.warn('[Cloud] reportGameEnd 延迟上报: sessionId 为空，已入队');
      return;
    }
    console.log('[Cloud] reportGameEnd', result, 'sessionId=', this._sessionId);
    this.sendReport('end', {
      ...payload,
      sessionId: this._sessionId
    });
  },

  reportLevelUp() {
    if (!this._sessionId) return;
    this.sendReport('levelUp', {
      sessionId: this._sessionId,
      levelName: '第二关 · 地狱'
    });
  }
};
