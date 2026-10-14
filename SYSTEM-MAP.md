# SYSTEM-MAP

| 目录或文件 | 职责 |
| --- | --- |
| app.js / app.json / app.wxss | 小程序入口、云环境初始化与全局配置 |
| pages/ | 首页、对战、图鉴、排行、成就和设置 |
| utils/ | AI 解析、数值引擎、道具、分享、上报及结果处理 |
| cloudfunctions/ | 登录、AI 调用、游戏事件与管理查询 |
| assets/ | 游戏图片、主题样式及 GitHub 展示封面 |
| admin-dashboard.html / start-admin.py | 本机管理页面与腾讯云调用代理 |
| asset-manager.html | 本地素材管理辅助页面 |
| project.config.json | 供使用者填写 AppID 的开发者工具配置 |
| .env.example / requirements.txt | 本机代理的配置模板和 Python 依赖 |
| README.md / README_架构说明.md / README_非技术交接说明.md | 启动、代码与业务说明 |
| docs/PUBLISH-CHECKS.md | 公开副本的验证与未验证范围 |

调用链：页面 → utils 编排 → 云函数 → 模型 / 微信云数据库；管理页面 → 本机代理 → adminApi。

公开副本移除了原环境 ID、AppID 和私人路径。原业务目录与云环境未修改。
