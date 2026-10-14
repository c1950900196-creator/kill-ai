# 决战AI 架构说明（交接版）

这份文档用于快速交接项目。目标是让新同学在 10 分钟内知道：
- 代码分层怎么划分
- 每个模块负责什么
- 改需求该改哪里
- 出问题先查哪里

---

## 1. 项目整体结构

项目分为三层：

1) 小程序前端（用户玩游戏）
- 目录：`pages/`、`utils/`

2) 云函数后端（数据上报、AI 调用、管理后台 API）
- 目录：`cloudfunctions/`

3) 管理后台（本地代理 + 网页）
- 文件：`start-admin.py`、`admin-dashboard.html`

---

## 2. Battle 页面模块拆分

原本 `pages/battle/battle.js` 是超大文件，已拆分为“主编排 + 6 个能力模块”。

### 2.1 主文件
- `pages/battle/battle.js`
- 角色：页面控制器
- 负责：
  - 页面生命周期（`onLoad`、`onUnload`）
  - 用户输入入口（`onSend`）
  - 串联各模块（AI、数值、道具、结算、上报、分享）

### 2.2 AI 解析与本地兜底
- `utils/battle-ai.js`
- 负责：
  - `parseAIResponse`：解析模型文本中的评分 JSON
  - `getMockResponse`：云端失败时本地兜底回复

### 2.3 数值规则引擎
- `utils/battle-engine.js`
- 负责：
  - `computeRoundMetrics`：计算混沌/预测增减
  - `pickSparkOutOutcome`：火花耗尽时胜负判断
  - `calcRevivePred`：复活后预测值恢复规则

### 2.4 上报与重试
- `utils/battle-reporter.js`
- 负责：
  - `reportGameStart`、`reportMessage`、`reportGameEnd`
  - `sendReport` 重试
  - `flushPendingReports` 队列补发

### 2.5 分享能力
- `utils/battle-share.js`
- 负责：
  - `onShareAppMessage` 随机文案/图片
  - `onShareStory` 长图生成和分享

### 2.6 道具与预警
- `utils/battle-items.js`
- 负责：
  - 复活逻辑（两次分享）
  - 扰乱 AI（分享获次数 + 使用减预测）
  - 预测值预警弹窗
  - 浮层反馈和视觉抖动

### 2.7 胜负动画与记录
- `utils/battle-result.js`
- 负责：
  - `triggerVictory` / `triggerDefeat` 动画
  - `showLevelTransition` 关卡过渡
  - `saveGameRecord`、`onSaveGallery`
  - `onPlayAgain`

---

## 3. 后端云函数职责

### 3.1 `processInput`
- 作用：调用豆包 API，返回 AI 回复
- 安全点：
  - API Key 来自环境变量 `DOUBAO_API_KEY`
  - 有用户级限流（默认每分钟 30 次，可调）

### 3.2 `reportGame`
- 作用：上报开局、消息、结束、升级
- 关键点：
  - `eventId` 幂等去重（防重复写）
  - 消息优先写 `game_messages`，异常回退旧结构
  - 权限校验：只能更新自己的会话

### 3.3 `adminApi`
- 作用：管理后台 HTTP API
- 关键点：
  - `ADMIN_API_TOKEN` 鉴权
  - `overview` 有短缓存，降低全量扫描压力
  - `sessionDetail` 兼容新旧消息结构

### 3.4 `getAdminData`
- 作用：管理数据查询（非 HTTP 触发）
- 说明：保留兼容用途，生产建议优先走 `adminApi`

---

## 4. 管理后台链路

### 4.1 本地代理
- `start-admin.py`
- 作用：
  - 启动本地网页服务
  - 把 `/api` 请求代理到云函数 `adminApi`
  - 自动注入 `ADMIN_API_TOKEN`

### 4.2 前端页面
- `admin-dashboard.html`
- 作用：
  - 展示总览、用户对局、对话详情
  - 数据来源为本地代理 `/api`

---

## 5. 数据结构（核心集合）

- `game_sessions`：一局游戏的主记录
- `game_messages`：每句对话（新结构）
- `game_events`：事件去重（幂等）
- `api_rate_limits`：AI 调用限流计数

说明：
- 历史数据可能还在 `game_sessions.messages`，代码已兼容读取

---

## 6. 常见改需求入口

### 改玩法数值
- 改 `utils/battle-engine.js`

### 改 AI 文风/兜底回复
- 改 `pages/battle/battle.js` 的 prompt 段
- 或改 `utils/battle-ai.js` 的 mock 内容

### 改分享图/分享文案
- 改 `utils/battle-share.js`
- 或设置页本地配置（`shareTexts` / `shareImage`）

### 改复活/扰乱规则
- 改 `utils/battle-items.js`

### 改上报与重试策略
- 改 `utils/battle-reporter.js` + `cloudfunctions/reportGame`

### 改后台统计逻辑
- 改 `cloudfunctions/adminApi/index.js`

---

## 7. 故障排查顺序（建议）

1) 游戏有回复但后台没记录
- 先查 `utils/battle-reporter.js` 队列和重试日志
- 再查 `cloudfunctions/reportGame`

2) 管理后台连不上
- 先确认 `start-admin.py` 在运行
- 再查 `ADMIN_API_TOKEN` 是否一致
- 最后查 `adminApi` 日志

3) AI 调用失败
- 查 `processInput` 环境变量 `DOUBAO_API_KEY`
- 查限流参数 `PROCESS_INPUT_RATE_LIMIT_PER_MIN`
- 查豆包侧配额与错误码

---

## 8. 关键环境变量

- `DOUBAO_API_KEY`：豆包 API key
- `ADMIN_API_TOKEN`：管理后台鉴权 token
- `PROCESS_INPUT_RATE_LIMIT_PER_MIN`：AI 限流阈值（默认 30）
- `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY`：本地代理调用腾讯云 API
- `TCB_ENV_ID`：云开发环境 ID

---

## 9. 维护建议

- Battle 主文件建议长期控制在 500 行以内
- 新功能优先加到 `utils` 模块，不要回灌到主文件
- 涉及上报改动时，必须同时检查：
  - 客户端补发逻辑
  - 云函数幂等逻辑
  - 管理后台兼容逻辑
