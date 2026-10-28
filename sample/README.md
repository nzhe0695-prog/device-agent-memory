# 脱敏样本说明

本目录是配套《设备侧 Agent 的分层记忆实现》一文的**数据样本**，用于说明记忆文件的实际结构与规模。

## 包含什么

- `memory/` — 记忆分层全量目录结构：`persona.card.md`、`persona-grow.md`、`he.md`、`why.md`、`life.md`、`recap/`、`chat/`、`dreams/`、`stream/`、`heat.json`、`qq-memory.json`、`qq-digest.md`、`manifest.md`
- `journal/` — 按天的主循环日志（含心跳、动作、模型调用记录）

## 掩码规则（`tools/sanitize-export.mjs`）

| 原始内容 | 替换为 |
|---|---|
| 任意连续中文（≥2 字） | `<cjkN>`，N = 原字数 |
| 5–12 位整数、13 位时间戳 | `<numN>` / `<ts>` |
| IPv4 / URL / 邮箱 | `<IP>` / `<URL>` / `<EMAIL>` |
| 手机号 | `<PHONE>` |
| API key、长 token | `<KEY>` / `<TOKEN>` |
| 本机路径（`/data/...`、`/sdcard/...`） | `<PATH>` |
| 长度 ≥12 的英文连续串 | `<enN>` |

**保留**：文件与目录名、Markdown 结构、字段名、JSON 键、日期（`YYYY-MM-DD`）、字数桶、行数、字节数。

因此样本能反映“一个记忆条目长什么样、有多少字、按什么格式组织”，但读不出任何一句真实对话。

## 自检

导出脚本内置自检：遍历输出文件，若仍出现连续中文、≥6 位整数或 IP 段则报错。本次导出结果：**0 处残留**。

```bash
node tools/sanitize-export.mjs --src <原始目录> --out <输出目录>
```

## 未导出的内容

- `config.json`（含 API key、token、账号标识）
- `state.json` / `qq-memory` 之外的运行态文件（含会话令牌）
- 通知原文、聊天截图、截图产物
- 数据库 `memory.db`（本系统为可选组件，未启用）

## 注意

即使经过掩码，**字数分布、时间分布、文件命名**仍可能推断出活动强度与作息。若用于公开发布，建议再对 `journal/` 的时间戳做粗化（`YYYY-MM`）。
