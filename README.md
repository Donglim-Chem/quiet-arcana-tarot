# 静心塔罗 · Quiet Arcana

一个单文件的塔罗占卜网页，内置 78 张韦特塔罗牌（图片以 Base64 内嵌，无需外部资源），
支持多种牌阵、切牌/抽牌动画，并可调用大语言模型生成结构化的中文深度解读。

## 功能特性

- **纯前端占卜流程**：选牌阵 → 输入问题 → 切牌 → 抽牌 → 翻牌，全程本地完成。
- **多种牌阵**：单张牌、三张牌（过去/现在/未来 等）、四张牌等，含变体。
- **正逆位**：抽牌后可手动调整正位/逆位，牌面与解读随之更新。
- **AI 深度解读**：由后端代理调用 OpenAI 兼容接口，按「接收确认 / 逐牌解读 /
  牌阵串联 / 核心回答 / 行动建议 / 边界提醒」结构输出。
- **占卜记录**：使用浏览器 `localStorage` 保存历史，可随时回到某条记录查看原解读，
  或对旧记录「重新解读」。

## 项目结构

```
.
├── index.html                 # 前端（单文件，内嵌牌面图片与全部逻辑/样式）
├── server.py                  # 后端 AI 解读代理（Python 标准库，无第三方依赖）
├── tarot-ai.service           # systemd 服务单元示例
├── nginx-tarot.example.conf   # Nginx 站点/反代配置示例（前端 + /tarot/api/reading）
├── .env.example               # 后端环境变量示例（复制为 /etc/tarot-ai.env 后填写）
├── qa-browser.js              # Playwright 主流程 UI 测试
└── qa-history.js              # Playwright 占卜记录/恢复测试
```

## 架构说明

前端通过 `POST /tarot/api/reading` 把「问题 + 牌阵 + 牌面（含正逆位与参考牌义）」
发给后端。后端 `server.py` 是一个只用 Python 标准库实现的最小 HTTP 代理：

- 从环境变量读取 API 配置（**密钥不写死在代码里**）；
- 做输入校验、每 IP/全局限流；
- 以 `system + user` 消息调用 OpenAI 兼容的 `/chat/completions`；
- 只把模型返回的解读文本回传前端。

密钥始终只存在于服务器的 `/etc/tarot-ai.env`（权限 600），不进入前端、不进入版本库。

## 本地运行

```bash
# 1) 准备环境变量
cp .env.example .env          # 填入你自己的 TAROT_API_KEY 等
# 2) 启动后端（默认监听 127.0.0.1:8012）
set -a; . ./.env; set +a
python3 server.py
# 3) 前端：直接用浏览器打开 index.html，
#    或用任意静态服务器托管，并把 /tarot/api/reading 反代到 127.0.0.1:8012/reading
```

## 部署（Linux + systemd + Nginx）

1. 把 `server.py` 放到 `/opt/tarot-ai/server.py`，`index.html` 放到 `/var/www/html/tarot/`。
2. 复制 `.env.example` 为 `/etc/tarot-ai.env`，填写真实值，并执行
   `sudo chown root:root /etc/tarot-ai.env && sudo chmod 600 /etc/tarot-ai.env`。
3. 安装服务：`sudo cp tarot-ai.service /etc/systemd/system/ && sudo systemctl enable --now tarot-ai`。
4. 参考 `nginx-tarot.example.conf` 配置站点与反代，`sudo nginx -t && sudo systemctl reload nginx`。

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `TAROT_API_KEY` | 模型 API 密钥（**必填，保密**） | 无 |
| `TAROT_API_BASE` | OpenAI 兼容接口基址 | `https://api.xiaomimimo.com/v1` |
| `TAROT_MODEL` | 解读所用模型名 | `mimo-v2.6-pro` |
| `TAROT_PORT` | 后端监听端口 | `8012` |
| `TAROT_RATE_PER_HOUR` | 每 IP 每小时请求上限 | `12` |
| `TAROT_GLOBAL_PER_DAY` | 全局每日请求上限 | `250` |

## 测试

UI 测试基于 [Playwright](https://playwright.dev/)，需要本机安装 Chromium/Edge：

```bash
npm i playwright
# 可用环境变量指定站点地址与浏览器路径
QA_URL=http://127.0.0.1/tarot/ EDGE_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node qa-browser.js
QA_URL=http://127.0.0.1/tarot/ node qa-history.js
```

截图会输出到 `qa-artifacts/`（已在 `.gitignore` 中忽略）。

## 安全说明

- 本仓库不包含任何真实 API 密钥；密钥仅通过环境变量/服务器上的 `.env` 提供。
- `.env`、`*.env`（除 `.env.example`）、`__pycache__/`、`qa-artifacts/` 均被忽略。
- 塔罗解读仅供自我反思参考，不构成医疗、心理、法律或财务建议。

## 牌面图片来源

韦特塔罗（Rider–Waite–Smith）牌面由 Pamela Colman Smith 于 1909 年绘制，已进入公有领域。