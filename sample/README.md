# 脱敏样本说明

本目录是配套《设备侧 Agent 的分层记忆实现》一文的数据样本，用于说明记忆文件的实际结构与规模。

## 包含什么

- `memory/` — 记忆分层全量目录结构：`persona.card.md`、`persona-grow.md`、`he.md`、`why.md`、`life.md`、`recap/`、`chat/`、`dreams/`、`stream/`、`heat.json`、`qq-memory.json`、`qq-digest.md`、`manifest.md`
- `journal/` — 按天的主循环日志（心跳、动作、模型调用记录）
- `_manifest.json` — 文件清单与字节数（用于核对总量，不含内容）

## 脱敏三步

1. **内容掩码**（`tools/sanitize-export.mjs`）
2. **残留汉字**（`tools/mask-residual-cjk.mjs`）
3. **时间粗化**（`tools/coarsen-dates.mjs`）

### 第一步：内容掩码

| 原始内容 | 替换为 |
|---|---|
| 连续中文（≥2 字） | `<cjkN>`，N = 原字数 |
| 5–12 位整数、13 位时间戳 | `<numN>` / `<ts>` |
| IPv4 / URL / 邮箱 | `<IP>` / `<URL>` / `<EMAIL>` |
| 手机号 | `<PHONE>` |
| API key、长 token | `<KEY>` / `<TOKEN>` |
| 本机路径（`/data/...`、`/sdcard/...`） | `<PATH>` |
| 长度 ≥12 的英文连续串 | `<enN>` |

### 第二步：残留汉字

`sanitize-export.mjs` 只处理「连续 ≥2 个汉字」，于是单字内容（他/她/在/额/嗯…）和结构性中文会漏下来。第二遍先把结构映射掉，再抹掉内容：

| 原始 | 替换为 |
|---|---|
| `他：` / `她：`（说话人） | `user:` / `agent:` |
| `第N段`（时段标记） | `seg N` |
| 其余任何汉字串（含单字） | `<cjkN>` |

这一步之后，样本内**汉字数为 0**。

### 第三步：时间粗化

把日期换成不透明序号，避免从时间分布反推作息：

| 原始 | 替换为 |
|---|---|
| 文件名与正文里的 `YYYY-MM-DD` / `YYYY/MM/DD` | `day01`…`day08`（样本内出现的 8 个日期，按先后编号） |
| 一天内的具体时刻（`HH:MM`、`HH:MM:SS`、`[HH:MM:SS]`） | `<t>` |
| 其余年/月/日写法 | `<year>` / `<month>` / `<date>` |

**保留**：文件与目录名、Markdown 结构、字段名、JSON 键、字数桶、行数、字节数。

## 自检

三步都带自检：任何一步若仍有连续中文、≥6 位整数、IP 段或真实日期，脚本直接报错退出。

本次导出结果：**38 个文件 / 294,465 字节 / 0 汉字 / 0 真实日期**。

> 个别样本里会出现 `138:10` 这类数字，那是 Node 堆栈里的行号列号，不是时刻。

## 复现

```bash
node tools/sanitize-export.mjs   --src <原始目录> --out <输出目录>
node tools/mask-residual-cjk.mjs --dir <输出目录>
node tools/coarsen-dates.mjs     --dir <输出目录>
```

## 未导出的内容

- `config.json`（含 API key、token、账号标识）
- 运行态文件（会话令牌、待回队列、状态快照）
- 通知原文、聊天截图与截图产物
- 数据库 `memory.db`（本系统的可选组件，未启用）

## 注意

即使经过三步处理，**字数分布与文件数量**仍能推断出活动强度；时间是顺序信息：`day01…day08` 保留了先后，不保留绝对日期。若需要更严，可对文件数量再抽样。
