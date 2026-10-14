const audioManager = require('./audio-manager');

module.exports = {
  triggerVictory() {
    const { currentLevel } = this.data;
    audioManager.play('victory');
    this.saveGameRecord('victory');
    if (currentLevel === 2) {
      this.reportGameEnd('victory');
    }

    this.setData({
      showVictoryAnim: true,
      victoryPhase: 0,
      inputDisabled: true,
      shakeClass: ''
    });

    if (!this._animTimers) this._animTimers = [];
    this._animTimers.push(setTimeout(() => {
      this.setData({ victoryPhase: 1 });
      wx.vibrateLong().catch(() => {});
    }, 100));

    this._animTimers.push(setTimeout(() => {
      this.setData({ victoryPhase: 2 });
      wx.vibrateShort({ type: 'heavy' }).catch(() => {});
    }, 800));

    this._animTimers.push(setTimeout(() => {
      this.setData({ victoryPhase: 3 });
    }, 1500));

    const total = (wx.getStorageSync('totalMeltdowns') || 0) + 1;
    wx.setStorageSync('totalMeltdowns', total);

    if (currentLevel === 1) {
      this._animTimers.push(setTimeout(() => {
        this.setData({ showVictoryAnim: false });
        this.showLevelTransition();
      }, 3200));
    } else {
      this._animTimers.push(setTimeout(() => {
        this.setData({
          showVictoryAnim: false,
          showResult: true,
          gameResult: 'victory'
        });
        this._animTimers.push(setTimeout(() => this.setData({ resultAnimIn: true }), 50));
      }, 3200));
    }
  },

  showLevelTransition() {
    this.setData({
      showLevelTransition: true,
      levelTransPhase: 0
    });

    this.scheduleTask(() => this.setData({ levelTransPhase: 1 }), 100);
    this.scheduleTask(() => this.setData({ levelTransPhase: 2 }), 1500);

    this.scheduleTask(() => {
      this.setData({ showLevelTransition: false });
      this.reportGameEnd('victory_level1');
      this.startLevel(2);
      this.reportGameStart(2);
    }, 4000);
  },

  startLevel(level) {
    const levelConfig = {
      1: { name: '第一关 · 幼儿园', spark: 10, predictability: 30 },
      2: { name: '第二关 · 地狱', spark: 10, predictability: 30 }
    };
    const config = levelConfig[level];

    this.conversationHistory = [];
    this._reviveGraceLeft = 0;
    this._chaosEncouraged = false;
    this.setData({
      currentLevel: level,
      levelName: config.name,
      currentRound: 0,
      predictability: config.predictability,
      chaos: 0,
      spark: config.spark,
      messages: [],
      inputText: '',
      aiTyping: false,
      inputDisabled: false,
      canSend: false,
      showResult: false,
      gameResult: '',
      bestInput: '',
      bestChaosScore: 0,
      showGuide: true,
      guideExamples: this.pickRandomExamples(3),
      showFeedback: false,
      showVictoryAnim: false,
      showDefeatAnim: false,
      resultAnimIn: false,
      reviveLeft: 2,
      showRevive: false,
      showPredWarn: false,
      predWarnShown: false
    });
    this.calcChatHeight();
  },

  onNextLevel() {
    this.setData({ showResult: false, resultAnimIn: false });
    this.reportGameEnd('victory_level1');
    this.startLevel(2);
    this.reportGameStart(2);
  },

  triggerDefeat() {
    audioManager.play('defeat');
    this.saveGameRecord('defeat');
    this.reportGameEnd('defeat');

    const rainCols = Array.from({ length: 12 }, () => {
      const chars = '01アイウエオカキクケコ';
      let col = '';
      for (let i = 0; i < 30; i++) col += chars[Math.floor(Math.random() * chars.length)];
      return col;
    });

    this.setData({
      showDefeatAnim: true,
      defeatPhase: 0,
      inputDisabled: true,
      shakeClass: '',
      rainCols
    });

    if (!this._animTimers) this._animTimers = [];
    this._animTimers.push(setTimeout(() => {
      this.setData({ defeatPhase: 1 });
    }, 100));

    this._animTimers.push(setTimeout(() => {
      this.setData({ defeatPhase: 2 });
      wx.vibrateLong().catch(() => {});
    }, 1500));

    this._animTimers.push(setTimeout(() => {
      this.setData({ defeatPhase: 3 });
      wx.vibrateShort({ type: 'heavy' }).catch(() => {});
    }, 3200));

    this._animTimers.push(setTimeout(() => {
      this.setData({
        showDefeatAnim: false,
        showResult: true,
        gameResult: 'defeat'
      });
      this._animTimers.push(setTimeout(() => this.setData({ resultAnimIn: true }), 50));
    }, 4800));
  },

  saveGameRecord(result) {
    const { currentLevel, currentRound, chaos, predictability, messages, bestInput } = this.data;
    const record = {
      result,
      level: currentLevel,
      rounds: currentRound,
      chaos,
      predictability,
      messages,
      bestInput,
      time: Date.now()
    };

    const history = wx.getStorageSync('gameHistory') || [];
    history.unshift(record);
    if (history.length > 50) history.pop();
    wx.setStorageSync('gameHistory', history);

    if (result === 'victory' && currentLevel === 2) {
      const rankRecord = {
        rounds: currentRound,
        chaos,
        predictability,
        bestInput,
        time: Date.now()
      };
      const rankings = wx.getStorageSync('rankings') || [];
      rankings.push(rankRecord);
      rankings.sort((a, b) => a.rounds - b.rounds || b.chaos - a.chaos);
      if (rankings.length > 100) rankings.length = 100;
      wx.setStorageSync('rankings', rankings);
    }
  },

  onSaveGallery() {
    const gallery = wx.getStorageSync('gallery') || [];
    const lastMessages = this.data.messages.slice(-6);
    gallery.unshift({
      id: Date.now(),
      messages: lastMessages,
      chaos: this.data.chaos,
      bestInput: this.data.bestInput,
      time: Date.now()
    });
    wx.setStorageSync('gallery', gallery);

    wx.showToast({ title: '已保存到画廊', icon: 'success' });
  },

  onPlayAgain() {
    this.startLevel(1);
    this.setData({
      shakeClass: '',
      glitchStyle: '',
      reviveReason: '',
      reviveShareFailed: false,
      victoryPhase: 0,
      defeatPhase: 0,
      showLevelTransition: false,
      levelTransPhase: 0,
      disruptCount: 0,
      showDisruptModal: false
    });
    const humanId = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    this.setData({ humanId });
    this._gameStartTime = Date.now();
    this._sessionId = null;
    this._pendingReports = [];
    this._timers = [];
    this.persistPendingReports();
    this.reportGameStart(1);
  }
};
