const battleEngine = require('./battle-engine');

module.exports = {
  checkGameEnd(newChaos, newPred, round) {
    if (newChaos >= 100) {
      this.scheduleTask(() => this.triggerVictory(), 800);
      return;
    }

    if (newPred >= 100) {
      if (this.data.reviveLeft > 0) {
        this.scheduleTask(() => this.showReviveModal('pred'), 800);
      } else {
        this.scheduleTask(() => this.triggerDefeat(), 800);
      }
      return;
    }

    if (this.data.spark <= 0) {
      if (this.data.reviveLeft > 0) {
        this.scheduleTask(() => this.showReviveModal('spark'), 800);
      } else {
        this.scheduleTask(() => {
          if (battleEngine.pickSparkOutOutcome(newChaos, newPred) === 'victory') {
            this.triggerVictory();
          } else {
            this.triggerDefeat();
          }
        }, 1000);
      }
    }
  },
  showReviveModal(reason) {
    this._reviveShareCount = 0;
    this.setData({
      showRevive: true,
      reviveReason: reason,
      reviveShareFailed: false,
      inputDisabled: true
    });
  },
  onReviveShare() {
    this._reviveShareCount = (this._reviveShareCount || 0) + 1;
    const count = this._reviveShareCount;
    this.scheduleTask(() => {
      if (count < 2) {
        this.setData({ reviveShareFailed: true });
        wx.showToast({ title: '分享失败，请重试', icon: 'none', duration: 2000 });
      } else {
        this.executeRevive();
      }
    }, 1500);
  },
  executeRevive() {
    const { reviveLeft, predictability, spark, reviveReason } = this.data;
    const newPred = battleEngine.calcRevivePred(predictability, reviveReason);

    this._reviveGraceLeft = 2;

    this.setData({
      reviveLeft: reviveLeft - 1,
      showRevive: false,
      reviveShareFailed: false,
      spark: spark + 5,
      predictability: newPred,
      inputDisabled: false
    });

    wx.showToast({ title: '复活成功！', icon: 'success' });
    wx.vibrateShort({ type: 'heavy' }).catch(() => {});
  },
  onReviveSkip() {
    this.setData({ showRevive: false });
    const { reviveReason } = this.data;
    if (reviveReason === 'pred') {
      this.triggerDefeat();
    } else {
      if (battleEngine.pickSparkOutOutcome(this.data.chaos, this.data.predictability) === 'victory') {
        this.triggerVictory();
      } else {
        this.triggerDefeat();
      }
    }
  },
  onPredWarnShare() {
    this.scheduleTask(() => {
      const newPred = Math.max(0, this.data.predictability - 15);
      this.setData({
        predictability: newPred,
        showPredWarn: false,
        inputDisabled: false
      });
      wx.showToast({ title: '预测值 -15！', icon: 'none' });
      this.showFeedbackFloat(0, -15);
    }, 1500);
  },
  onPredWarnSkip() {
    this.setData({ showPredWarn: false, inputDisabled: false });
    this.checkGameEnd(this.data.chaos, this.data.predictability, this.data.currentRound);
  },
  onDisruptTap() {
    if (this.data.inputDisabled && !this.data.showRevive) return;
    this._disruptShareCount = 0;
    this.setData({ showDisruptModal: true, disruptShareFailed: false });
  },
  onDisruptUse() {
    const { disruptCount, predictability } = this.data;
    if (disruptCount <= 0) return;

    const newPred = Math.max(0, predictability - 20);
    this.setData({
      disruptCount: disruptCount - 1,
      predictability: newPred,
      showDisruptModal: false
    });

    wx.showToast({ title: '预测值 -20！', icon: 'none', duration: 1500 });
    wx.vibrateShort({ type: 'medium' }).catch(() => {});

    this.showFeedbackFloat(0, -20);
  },
  onDisruptShare() {
    this._disruptShareCount = (this._disruptShareCount || 0) + 1;
    const count = this._disruptShareCount;
    this.scheduleTask(() => {
      if (count < 2) {
        this.setData({ disruptShareFailed: true });
        wx.showToast({ title: '分享失败，请重试', icon: 'none', duration: 2000 });
      } else {
        const { disruptCount, disruptMax } = this.data;
        if (disruptCount < disruptMax) {
          this.setData({ disruptCount: disruptCount + 1, showDisruptModal: false, disruptShareFailed: false });
          wx.showToast({ title: '获得1次扰乱机会！', icon: 'success' });
        }
      }
    }, 1500);
  },
  onDisruptClose() {
    this.setData({ showDisruptModal: false });
  },
};
