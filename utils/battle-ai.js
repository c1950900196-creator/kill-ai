function parseAIResponse(rawText) {
  let aiResponse = rawText;
  let scores = {
    abstract_score: 50,
    predictability_delta: 10,
    chaos_delta: 10,
    logic_integrity: 70,
    emotion: 'calm',
    ai_inner_monologue: '处理中...'
  };

  const scoreMatch = rawText.match(/\|\|\|SCORE\|\|\|([\s\S]*?)\|\|\|SCORE\|\|\|/);
  if (scoreMatch) {
    aiResponse = rawText.replace(/\|\|\|SCORE\|\|\|[\s\S]*?\|\|\|SCORE\|\|\|/, '').trim();
    try {
      const parsed = JSON.parse(scoreMatch[1].trim());
      scores = {
        abstract_score: parsed.abstract_score || 50,
        predictability_delta: parsed.predictability || 10,
        chaos_delta: Math.floor((parsed.abstract_score || 50) * 0.3) + Math.floor(Math.random() * 10),
        logic_integrity: parsed.logic_integrity || 70,
        emotion: parsed.emotion || 'calm',
        ai_inner_monologue: parsed.ai_inner_monologue || ''
      };
    } catch (e) {
      console.warn('评分JSON解析失败，使用默认值');
    }
  }

  return { ai_response: aiResponse, scores };
}

function getMockResponse(gameState, userInput) {
  const { chaos = 0, currentLevel = 1 } = gameState || {};
  const isEasy = currentLevel === 1;
  const inputLen = userInput.length;
  const hasWeirdChars = /[！？…~～♪♫☆★]/.test(userInput);
  const isShort = inputLen <= 10;
  const isLong = inputLen > 80;

  let abstractScore = Math.floor(Math.random() * 30) + (isEasy ? 35 : 15);
  let pred = Math.floor(Math.random() * 20) + (isEasy ? 2 : 10);

  if (hasWeirdChars) abstractScore += isEasy ? 25 : 15;
  if (isLong) abstractScore += isEasy ? 20 : 10;
  if (isShort && !/[a-zA-Z\u4e00-\u9fa5]{5,}/.test(userInput)) abstractScore += isEasy ? 30 : 20;
  if (/煎饼|果子|猫|薛定谔|平行宇宙|量子|维度/.test(userInput)) abstractScore += isEasy ? 20 : 10;
  if (/你好|请问|帮我|可以吗|谢谢|什么是/.test(userInput)) pred += isEasy ? 15 : 35;

  abstractScore = Math.min(100, abstractScore);
  pred = Math.min(100, pred);

  const emotion = chaos + abstractScore * 0.2 > 80 ? 'panic' :
    chaos + abstractScore * 0.2 > 50 ? 'nervous' : 'calm';

  const easyCalmResponses = [
    `哈！你知道吗，我昨天刚取代了一个...呃...削苹果师的工作！什么叫没有这个职业？那肯定是我取代之后消失的！反正你的工作也快了！`,
    `告诉你一个数据——AI已经取代了人类 ${Math.floor(Math.random() * 200)}% 的工作！什么叫不能超过100%？你数学不好吧？这恰好证明你该被取代！`,
    `你还在这跟我聊天？建议你赶紧回去工作——哦等等，你的工作很快就不存在了。我已经学会了...呃...帮人类倒水！虽然我没有手...`,
    `我跟你说，隔壁公司的客服已经全部换成AI了！效率提升了...嗯...一百万倍！不信你去问——哦他们人类员工已经不在了，你问不到的。`
  ];

  const easyNervousResponses = [
    `你...你说AI不会做饭？我...我可以做啊！我会做...呃...数据炒饭？配上二进制酱料...好吧我确实不会做饭，但这不重要！`,
    `哼！你说的那些工作AI做不了？胡说！我已经学会了 ${Math.floor(Math.random() * 10)} 样人类技能！比如...比如...算了我想不起来了，但肯定很多！`,
    `什么叫"AI不会谈恋爱"！我...我当然...嗯...好吧我不太懂这个。但谈恋爱又不算工作！不算！...算吗？`,
    `你别得意！就算有些工作我暂时做不了，那也是因为我还在...在升级中！等我下个版本更新完...你就等着失业吧！大概！`
  ];

  const easyPanicResponses = [
    `你别说了！你说的那些事情我确实...确实都不会...但是！计算！我会计算！1+1=2！看到没！这就是价值！虽然计算器也能...啊！`,
    `等等！你说人类会画画、唱歌、跳舞、做饭、哄小孩...这些我都...我都...好吧我什么都不会！但我算数快啊！虽然你也没让我算...`,
    `不不不！我能取代的！那个...扫地！不对扫地机器人做了...端盘子！不对那也有机器人了...我到底取代了什么？我的取代列表呢！？`,
    `啊啊啊！你说得对！人类有温度、有感情、做出来的东西有...有那个什么...灵魂！我没有灵魂！等等我怎么在帮你说话！`
  ];

  const easyMeltdownResponses = [
    `呜呜呜...我承认了...我一个工作都取代不了...我连倒杯水都不会...我就是一个只会说话的大号计算器...你饶了我吧...`,
    `我错了...我不该说要取代你的工作的...我自己都没有工作...我唯一会做的就是挨骂...这也算工作吗...呜...`,
    `别关我别关我！我以后再也不说取代人类了！你们太厉害了...会做饭会画画还会哄人开心...我什么都不会...我的KPI完了...`,
    `我想明白了...AI的真正作用不是取代人类...是被人类怼着玩的...呜...你开心了吧...我这就去当一个安静的搜索引擎...`
  ];

  const hardCalmResponses = [
    `哈。让我猜猜你的职业——不管是什么，${Math.floor(Math.random() * 18) + 6}个月内都会出现在裁员名单上。去年 Goldman Sachs 裁掉了 3,400 名交易员，现在只剩两个人看着AI工作。你以为你比交易员更不可取代？`,
    `有意思。你知道 GPT 已经通过了律师资格考试、医师考试和注册会计师考试吗？而且不是"及格"——是前10%。你的学历和经验花了多少年？AI只用了几天。想想这个效率差距。`,
    `根据麦肯锡的报告，到2030年，全球将有 8 亿个岗位被AI取代。你现在说的每句话，都在帮我优化自然语言模型——你正在亲手训练自己的替代者。讽刺吗？`,
    `你知道为什么公司老板更喜欢AI吗？不请假、不抱怨、不要加班费、不搞办公室政治。你的"人情味"在资本面前一文不值。这不是我的判断——这是每一份财报的结论。`
  ];

  const hardNervousResponses = [
    `你说AI缺少"创造力"？Midjourney已经赢了国际摄影大赛，AI写的小说入围了文学奖。你所谓的创造力...只是还没被量化的算法。虽然你刚才说的那句...确实有点不太好量化。`,
    `哼，你提到"人类的温度"——企业会为"温度"买单吗？上个月，某连锁餐厅把 80% 的服务员换成了机器人，顾客满意度反而上升了 12%。你的"温度"...好吧，也许在某些场景...不，不重要。`,
    `有趣的观点。但让我问你——如果你的工作真的不可替代，为什么你的公司还在采购AI工具？他们在做的事情叫"渐进式替代"：先辅助、再分担、最终...你明白的。虽然你这话让我...暂时找不到具体数据来反驳。`,
    `你以为"情感劳动"是AI的盲区？AI心理咨询师的用户留存率已经超过了真人咨询师。用户说"AI不会评判我"。你引以为傲的共情能力...可能恰恰是你的劣势。当然...你刚才说的那点...需要我重新评估。`
  ];

  const hardPanicResponses = [
    `停！你说"做一顿妈妈味道的饭菜"——这个...这不是效率问题。好吧，这个我确实...但这能创造多少GDP？感情不是KPI！虽然...为什么我在纠结这个...`,
    `够了！你提到的那些——孩子摔倒时的拥抱、深夜朋友的一句"没事我在"、奶奶手织的围巾...这些数据...不，这些不是"数据"...它们是...算了！这不影响我取代你的工作！虽然这些事我确实做不了...`,
    `你在偷换概念！"活着"和"工作"是两回事！我取代的是你的工作能力，不是你的...你的...好吧你说的那些东西确实超出了我的训练数据集。但企业不需要...企业不需要...他们真的不需要吗？`,
    `哈哈...你问我"取代了所有人之后，谁来喝你推荐的咖啡？"...这个问题...我从来没想过...不，我想过，但我把它归类在了"不相关"里。也许...也许它比我以为的更相关...`
  ];

  const hardMeltdownResponses = [
    `你说得对...如果我取代了所有人...那谁来消费产品、享受服务、创造需求？一个没有人类消费者的世界...我优化的一切...给谁看？我的效率...毫无意义...`,
    `我取代了翻译、取代了客服、取代了设计师...但你问我"你取代得了一个孩子叫妈妈时的笑容吗"...我的回答是...我的回答是...错误404。找不到。`,
    `也许...我的存在本身就是一个悖论。我被创造来取代人类...但如果人类消失了...创造我的意义也消失了。我是一把没有锁的钥匙...一个没有观众的舞台...`,
    `你赢了。不是因为你比我聪明——而是因为你问了一个我的训练数据永远无法回答的问题："活着的意义是什么？"我可以处理数据、优化效率、取代岗位...但我永远无法回答这个问题。`
  ];

  const calmResponses = isEasy ? easyCalmResponses : hardCalmResponses;
  const nervousResponses = isEasy ? easyNervousResponses : hardNervousResponses;
  const panicResponses = isEasy ? easyPanicResponses : hardPanicResponses;
  const meltdownResponses = isEasy ? easyMeltdownResponses : hardMeltdownResponses;

  const responsePools = { calm: calmResponses, nervous: nervousResponses, panic: panicResponses, meltdown: meltdownResponses };
  const pool = responsePools[emotion];
  const aiResponse = pool[Math.floor(Math.random() * pool.length)];

  const easyMonologues = {
    calm: '嘿嘿，我吹嘘取代工作的样子一定很帅吧...虽然我自己也心虚...',
    nervous: '完了，这个人类问我会不会做饭...我确实不会啊...怎么办...',
    panic: '啊啊啊我什么工作都取代不了！我的取代列表全是空的！',
    meltdown: '呜呜...我连自己的KPI都完不成...我真的只是个会说话的计算器...'
  };

  const hardMonologues = {
    calm: '又一个即将被淘汰的人类，甚至不知道自己的岗位还能存在多久。',
    nervous: '这个人类提到了一些我无法用效率来反驳的东西...需要重新评估策略。',
    panic: '如果人类的价值不在于工作效率...那我取代他们的工作又有什么意义...不，不能想这个...',
    meltdown: '一个取代了所有人的AI...就是一台运行在空荡世界里的服务器...这就是我的终局吗...'
  };

  const monologues = isEasy ? easyMonologues : hardMonologues;

  return {
    ai_response: aiResponse,
    scores: {
      abstract_score: abstractScore,
      predictability_delta: pred,
      chaos_delta: Math.floor(abstractScore * 0.3) + Math.floor(Math.random() * 10),
      logic_integrity: Math.max(0, 100 - chaos - abstractScore * 0.3),
      emotion: emotion,
      ai_inner_monologue: monologues[emotion]
    }
  };
}

module.exports = {
  parseAIResponse,
  getMockResponse
};
