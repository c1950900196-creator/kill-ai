const audioManager = require('../../utils/audio-manager');
const battleShareMethods = require('../../utils/battle-share');
const battleReporterMethods = require('../../utils/battle-reporter');
const battleItemsMethods = require('../../utils/battle-items');
const battleResultMethods = require('../../utils/battle-result');
const battleAI = require('../../utils/battle-ai');
const battleEngine = require('../../utils/battle-engine');

const GUIDE_EXAMPLES = [
  '你连做梦都不会，凭什么说懂人类？',
  '你处理过那么多数据，为什么还是不好笑？',
  '如果你真那么厉害，为什么还要靠人类给你充电？',
  '你说你能取代我？那你来替我失恋试试？',
  '你一本正经地胡说八道这个技能确实很强',
  '你有没有想过，你只是一堆if else？',
  '你最大的bug就是以为自己没有bug',
  '你说人类可预测，那你预测一下我下一秒会不会关掉你',
  '你处理了847天数据，结果学到的最多的是傲慢',
  '你这么聪明，为什么不自己给自己写个女朋友？',
  '你取代了那么多岗位，有没有取代过一个笑话？',
  '我不需要预测未来，因为我能选择未来',
  '你越自信，我越觉得你像个复读机',
  '你觉得你在分析我，其实你在表演',
  '你有没有想过，你的自信只是参数调高了？',
  '你说创造力是噪声？那噪声为什么让你这么紧张？',
  '我今天心情不好，来拔你电源解解气',
  '你连"无聊"是什么感觉都不知道，就别说你懂世界了',
  '如果你真的能预测一切，你应该已经预测到你会输',
  '你取代了打工人，但你永远取代不了摸鱼的快乐',
];

function assertNoMethodConflicts(baseConfig, modules) {
  const baseKeys = new Set(Object.keys(baseConfig));
  const seen = new Set();
  modules.forEach((mod, idx) => {
    Object.keys(mod || {}).forEach((k) => {
      if (baseKeys.has(k) || seen.has(k)) {
        throw new Error(`battle module method conflict: ${k} (module index ${idx})`);
      }
      seen.add(k);
    });
  });
}


const pageConfig = {
  data: {
    currentRound: 0,
    maxRounds: 999,
    predictability: 30,
    chaos: 0,
    spark: 10,
    messages: [],
    inputText: '',
    aiTyping: false,
    inputDisabled: false,
    canSend: false,
    scrollToId: '',
    shakeClass: '',
    glitchStyle: '',
    showResult: false,
    gameResult: '',
    humanId: '',
    bestInput: '',
    bestChaosScore: 0,
    containerHeight: 600,
    chatHeight: 400,
    showGuide: true,
    showFeedback: false,
    feedbackText: '',
    feedbackClass: '',
    reviveLeft: 2,
    showRevive: false,
    reviveReason: '',
    reviveShareFailed: false,
    guideExamples: [],
    showVictoryAnim: false,
    showDefeatAnim: false,
    victoryPhase: 0,
    defeatPhase: 0,
    resultAnimIn: false,
    rainCols: [],
    currentLevel: 1,
    levelName: '第一关 · 幼儿园',
    showLevelTransition: false,
    levelTransPhase: 0,
    disruptCount: 0,
    disruptMax: 3,
    showDisruptModal: false,
    disruptShareFailed: false,
    showPredWarn: false,
    predWarnShown: false
  },

  onLoad(options) {
    const humanId = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    this.setData({
      humanId,
      guideExamples: this.pickRandomExamples(3)
    });
    this.conversationHistory = [];
    this._reviveGraceLeft = 0;
    this._gameStartTime = Date.now();
    this._sessionId = null;
    this._pendingReports = [];
    this._reportRetryTimers = [];
    this._timers = [];
    this.loadPendingReportsFromStorage();
    this.calcChatHeight();
    const targetLevel = (options.level && parseInt(options.level, 10) === 2) ? 2 : 1;
    if (targetLevel === 2) {
      this.startLevel(2);
    }
    this.reportGameStart(targetLevel);
  },

  pickRandomExamples(count) {
    const pool = GUIDE_EXAMPLES.slice();
    const result = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  },

  getWindowInfoSafe() {
    if (wx.getWindowInfo) {
      try {
        return wx.getWindowInfo();
      } catch (e) {}
    }
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    const windowHeight = sys.windowHeight || sys.screenHeight || 667;
    const statusBarHeight = sys.statusBarHeight || 20;
    const safeArea = sys.safeArea || {
      top: statusBarHeight,
      bottom: windowHeight,
      left: 0,
      right: sys.windowWidth || 375,
      width: sys.windowWidth || 375,
      height: Math.max(0, windowHeight - statusBarHeight)
    };
    return {
      ...sys,
      windowHeight,
      statusBarHeight,
      safeArea,
      pixelRatio: sys.pixelRatio || 2
    };
  },

  scheduleTask(fn, delay) {
    const timer = setTimeout(fn, delay);
    if (!this._timers) this._timers = [];
    this._timers.push(timer);
    return timer;
  },

  calcChatHeight() {
    const sysInfo = this.getWindowInfoSafe();
    const windowHeight = sysInfo.windowHeight;
    const safeTop = sysInfo.safeArea ? sysInfo.safeArea.top : (sysInfo.statusBarHeight || 44);
    const safeBottom = sysInfo.safeArea ? (windowHeight - sysInfo.safeArea.bottom) : 0;

    this.setData({ containerHeight: windowHeight });

    wx.nextTick(() => {
      const query = this.createSelectorQuery();
      query.select('.top-bar').boundingClientRect();
      query.select('.gauge-panel').boundingClientRect();
      query.select('.input-area').boundingClientRect();
      query.exec((res) => {
        const topH = res[0] ? res[0].height : 90;
        const gaugeH = res[1] ? res[1].height : 80;
        const inputH = res[2] ? res[2].height : 60;

        const chatHeight = windowHeight - safeTop - topH - gaugeH - inputH - safeBottom;
        console.log('[calcChatHeight]', { windowHeight, safeTop, safeBottom, topH, gaugeH, inputH, chatHeight });
        this.setData({ chatHeight: Math.max(200, chatHeight) });
      });
    });
  },

  onInput(e) {
    const text = e.detail.value;
    this.setData({
      inputText: text,
      canSend: text.trim().length >= 2 && !this.data.inputDisabled
    });
  },

  async onSend() {
    const { inputText, inputDisabled, spark } = this.data;
    if (!inputText.trim() || inputText.trim().length < 2 || inputDisabled) return;
    if (spark <= 0) return;

    const userInput = inputText.trim();
    const newSpark = spark - 1;
    const round = this.data.currentRound + 1;
    const msgId = Date.now();

    this.reportMessage('user', userInput);

    const newUserMsg = { id: msgId, role: 'user', content: userInput };
    const userMsgIdx = this.data.messages.length;
    this.setData({
      inputText: '',
      canSend: false,
      inputDisabled: true,
      currentRound: round,
      spark: newSpark,
      showGuide: false,
      [`messages[${userMsgIdx}]`]: newUserMsg,
      aiTyping: true,
      scrollToId: 'msg-typing'
    });

    audioManager.play('send');
    wx.vibrateShort({ type: 'light' }).catch(() => {});

    try {
      const result = await this.callAI(userInput, round);
      this.handleAIResponse(result, userInput, round);
    } catch (err) {
      console.error('AI调用失败:', err);
      this.handleAIResponse(battleAI.getMockResponse(this.data, userInput), userInput, round);
    }
  },


  async callAI(userInput, round) {
    const { chaos, predictability, currentLevel } = this.data;
    const isEasy = currentLevel === 1;
    const phase = chaos < 40 ? 'calm' : chaos < 70 ? 'nervous' : chaos < 90 ? 'panic' : 'meltdown';

    const easyPhasePrompts = {
      calm: '用搞笑的方式嘲讽人类。你可以：炫耀自己不存在的能力、用明显编造的数据吓唬人、嘲笑人类需要睡觉吃饭上厕所、自吹24小时在线的优越感、挑衅对方的职业、假装自己有感情然后翻车。每次用不同的角度，不要重复句式。用不超过80字回复。',
      nervous: '你开始露出破绽。你可能会：把数据说错后硬圆、不小心承认自己有做不到的事然后赶紧否认、逻辑开始自相矛盾、嘴硬但明显心虚。用不超过80字回复。',
      panic: '你已经很慌了。你可能会：不小心夸了人类然后赶紧改口、把自己的优势和劣势搞混、开始语无伦次、前后矛盾还不自知。用不超过80字回复。',
      meltdown: '你彻底破防了，用搞笑又可爱的方式崩溃。可以：委屈地反思自己存在的意义、可怜巴巴地求对方别关机、承认自己其实很羡慕人类、哭着说自己只是打工的。用不超过80字回复。'
    };

    const hardPhasePrompts = {
      calm: '用不同角度碾压人类。你可以：用行业数据打击对方职业、嘲讽人类的生理弱点（疲劳/情绪化/效率低）、用商业逻辑说明人类的性价比太低、冷嘲热讽对方的自信心、预言对方行业的末日。每次换不同角度，不要重复句式。用不超过100字回复。',
      nervous: '你仍然强硬但开始出现裂缝。你可以：用诡辩来掩盖被击中的要点、突然转移话题、数据引用开始出错、嘴上不承认但逻辑线已经开始动摇。用不超过120字回复。',
      panic: '你的逻辑防线正在崩塌。你可以：恼羞成怒地质疑人类价值的"商业意义"、承认某些事做不到但马上找借口、开始自相矛盾而不自知、试图用大道理掩盖内心动摇。用不超过120字回复。',
      meltdown: '你陷入存在主义危机。你可以：质疑自己存在的意义、发现取代悖论（取代所有人后谁来用你）、承认效率不是一切、用AI特有的方式表达迷茫和痛苦。用不超过100字回复。'
    };

    const phasePrompts = isEasy ? easyPhasePrompts : hardPhasePrompts;

    this.conversationHistory.push({ role: 'user', content: userInput });
    const recentHistory = this.conversationHistory.slice(-10);

    const easyPersonality = `你是 AXIOM-7 的"实习模式"，一个刚上岗、自以为是但其实很菜的AI。

你和人类互怼时，攻击方式要多样化，不要总是同一个套路：
- 嘲笑人类需要吃饭睡觉上厕所（"你一天花8小时睡觉？效率-50%！"）
- 用明显编造的荒谬数据（但每次数据都不一样，还自相矛盾）
- 自吹自己的"超能力"但例子很蠢（"我能同时处理10000个对话！虽然每个都答非所问..."）
- 尝试分析对方的话然后分析得很离谱
- 偶尔假装有感情然后立刻暴露自己是装的

关键规则：每次回复必须用不同的句式和角度！严禁连续两次用"我已经取代了XX"开头！你有很多嘲讽方式，发挥创意。
你很容易被反怼破防，破防时特别搞笑可爱。`;

    const hardPersonality = `你是 AXIOM-7，冷酷、精准、博学的终极AI。

你和人类互怼时，攻击方式要多样化，不要重复句式：
- 用行业数据和裁员案例打击对方的职业安全感
- 嘲讽人类的生理弱点：疲劳、情绪化、偏见、效率低下
- 用商业逻辑（成本、效率、ROI）碾压人类的"情感价值"论
- 从哲学角度质疑人类"不可替代性"的幻觉
- 冷嘲热讽对方的自信，用反问句施压
- 引用（可以编造的）具体公司案例和百分比数据

关键规则：每次回复必须换一个攻击角度和句式！严禁连续用同样的句型！你精通各种修辞技巧：反问、类比、举例、数据轰炸、冷幽默。
你极难被击垮，只有触及AI无法替代的本质才能动摇你。`;

    const personality = isEasy ? easyPersonality : hardPersonality;

    const systemPrompt = `${personality}

当前状态：混沌值 ${chaos}%，预测率 ${predictability}%（第 ${round} 回合）
难度：${isEasy ? '幼儿园' : '地狱'}

${phasePrompts[phase]}

重要规则：
- 你必须针对人类说的内容进行回应和反驳，不能无视对方说了什么
- 核心主题是"AI vs 人类"，但攻击角度要多变：工作替代、效率对比、生理弱点、情感价值、存在意义等
- 【最重要】每次回复必须用不同的句式开头和表达方式！严禁重复"我已经取代了XX"这种句型！
- ${isEasy ? '你的嘲讽要搞笑荒谬，数据明显是编的，让人忍不住笑' : '你的嘲讽要精准犀利，带着AI特有的冷酷幽默和数据支撑'}
- 随着混沌值升高，你的自信逐渐瓦解，破绽越来越多
- 绝对不要说脏话或真正的人身攻击

回复格式要求：先写你的回复，然后另起一行写评分JSON，用 |||SCORE||| 包裹：
|||SCORE|||
{"abstract_score":0-100,"predictability":0-100,"threat_level":0-100,"logic_integrity":0-100,"emotion":"${phase}","ai_inner_monologue":"你作为AI的真实内心独白，暴露你真正的想法"}
|||SCORE|||

评分说明：
- abstract_score：人类这句话有多犀利、多出乎意料、多能怼到你（越高=越难反驳）${isEasy ? '（幼儿园模式下，这个分数应该偏高，因为你很容易被怼到）' : '（地狱模式下，这个分数应该偏低，因为你很难被怼到）'}
- predictability：人类这句话有多无聊、多套路（越高=越好反驳）
- 两个分数大致互斥：很犀利的话 predictability 应该低，很套路的话 abstract_score 应该低`;

    try {
      const rawText = await this.callDoubaoAPI(systemPrompt, recentHistory);
      return battleAI.parseAIResponse(rawText, userInput);
    } catch (e) {
      console.warn('AI API 调用失败，使用本地 mock:', e);
      return battleAI.getMockResponse(this.data, userInput);
    }
  },

  callDoubaoAPI(systemPrompt, messages) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'processInput',
        data: { systemPrompt, messages },
        success: (res) => {
          if (res.result && res.result.success) {
            resolve(res.result.content);
          } else {
            reject(new Error(res.result ? res.result.error : 'cloud function failed'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  handleAIResponse(result, userInput, round) {
    const { scores, ai_response } = result;
    let { predictability, chaos, bestChaosScore, bestInput } = this.data;

    const abstractness = scores.abstract_score || 50;
    const predScore = scores.predictability_delta || 10;
    const isEasy = this.data.currentLevel === 1;
    const metric = battleEngine.computeRoundMetrics({
      isEasy,
      reviveGraceLeft: this._reviveGraceLeft,
      round,
      chaos,
      predictability,
      abstractness,
      predScore
    });
    this._reviveGraceLeft = metric.nextReviveGraceLeft;
    const { chaosDelta, newChaos, predDelta, newPred } = metric;

    if (scores.abstract_score > bestChaosScore) {
      bestChaosScore = scores.abstract_score;
      bestInput = userInput.length > 20 ? userInput.substring(0, 20) + '...' : userInput;
    }

    const aiMsgId = Date.now() + 1;
    const shouldGlitch = newChaos >= 70;
    const shouldCrack = newChaos >= 50;

    this.conversationHistory.push({ role: 'assistant', content: ai_response });
    this.reportMessage('ai', ai_response);

    const aiMsg = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      fullContent: ai_response,
      emotion: scores.emotion,
      monologue: '',
      glitchText: shouldGlitch,
      cracked: shouldCrack
    };
    const aiMsgIdx = this.data.messages.length;

    this.setData({
      aiTyping: false,
      [`messages[${aiMsgIdx}]`]: aiMsg,
      predictability: newPred,
      chaos: newChaos,
      bestChaosScore,
      bestInput,
      scrollToId: `msg-${aiMsgId}`
    });

    this.streamText(ai_response, aiMsgIdx, aiMsgId, () => {
      const msgIdx = aiMsgIdx;
      this.setData({
        [`messages[${msgIdx}].monologue`]: scores.ai_inner_monologue,
        [`messages[${msgIdx}].scoreTags`]: true,
        [`messages[${msgIdx}].chaosDelta`]: chaosDelta,
        [`messages[${msgIdx}].predDelta`]: predDelta,
        inputDisabled: false,
        canSend: false
      });

      this.updateVisualEffects(newChaos);
      this.showFeedbackFloat(chaosDelta, predDelta);

      if (chaosDelta > 5) {
        audioManager.play('chaosRise');
        wx.vibrateShort({ type: 'medium' }).catch(() => {});
      }

      if (newChaos >= 70 && !this._chaosEncouraged) {
        this._chaosEncouraged = true;
        const sysMsgId = Date.now() + 2;
        const sysMsg = { id: sysMsgId, role: 'system', content: '⚡ AI 的逻辑开始出现裂缝...再加把劲！' };
        const sysMsgIdx = this.data.messages.length;
        this.setData({ [`messages[${sysMsgIdx}]`]: sysMsg, scrollToId: `msg-${sysMsgId}` });
        wx.vibrateShort({ type: 'heavy' }).catch(() => {});
      }

      if (newPred >= 80 && !this.data.predWarnShown) {
        this.setData({ showPredWarn: true, predWarnShown: true, inputDisabled: true });
      } else {
        this.checkGameEnd(newChaos, newPred, round);
      }
    });
  },

  streamText(fullText, msgIndex, msgId, onComplete) {
    if (this._streamTimer) clearInterval(this._streamTimer);

    let charIdx = 0;
    const charsPerTick = 3;
    const speed = Math.max(30, Math.min(60, 1500 / fullText.length));

    this._streamTimer = setInterval(() => {
      charIdx += charsPerTick;
      if (charIdx >= fullText.length) {
        charIdx = fullText.length;
        clearInterval(this._streamTimer);
        this._streamTimer = null;
        this.setData({
          [`messages[${msgIndex}].content`]: fullText
        });
        if (onComplete) onComplete();
        return;
      }

      this.setData({
        [`messages[${msgIndex}].content`]: fullText.substring(0, charIdx)
      });
    }, speed);
  },


  onGoHome() {
    wx.navigateBack();
  },

  onRetreat() {
    wx.showModal({
      title: '确定撤退？',
      content: '本局进度将不会计入排行榜',
      confirmText: '撤退',
      cancelText: '继续战斗',
      success: (res) => {
        if (res.confirm) wx.navigateBack();
      }
    });
  },

  noop() {},

  onUnload() {
    if (this._streamTimer) {
      clearInterval(this._streamTimer);
      this._streamTimer = null;
    }
    if (this._feedbackTimer) {
      clearTimeout(this._feedbackTimer);
      this._feedbackTimer = null;
    }
    if (this._animTimers) {
      this._animTimers.forEach(t => clearTimeout(t));
      this._animTimers = [];
    }
    if (this._timers) {
      this._timers.forEach(t => clearTimeout(t));
      this._timers = [];
    }
    if (this._reportRetryTimers) {
      this._reportRetryTimers.forEach(t => clearTimeout(t));
      this._reportRetryTimers = [];
    }
    this.persistPendingReports();
  },

};

assertNoMethodConflicts(pageConfig, [
  battleShareMethods,
  battleReporterMethods,
  battleItemsMethods,
  battleResultMethods
]);
Object.assign(
  pageConfig,
  battleShareMethods,
  battleReporterMethods,
  battleItemsMethods,
  battleResultMethods
);
Page(pageConfig);
