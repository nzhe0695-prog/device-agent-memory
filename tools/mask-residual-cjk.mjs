#!/usr/bin/env node
/**
 * mask-residual-cjk.mjs — 样本脱敏的收尾一步
 *
 * 为什么需要这一步：
 *   sanitize-export.mjs 只替换「连续 ≥2 个汉字」的片段，于是单字内容（他/她/在/额/嗯…）
 *   和结构性中文（「第N段」「### 上午」）会漏下来。单字同样可能泄露情绪与语义，必须补一遍。
 *
 * 处理顺序（先保留结构，再抹掉内容）：
 *   1. 说话人标记：`他：` → `user:`，`她：` → `agent:`
 *   2. 段落标记：  `第N段` → `seg N`
 *   3. 其余任何汉字连续串 → `<cjkN>`（N=原字数，含单字）
 *
 * 用法：
 *   node tools/mask-residual-cjk.mjs --dir sample            # 原地处理
 *   node tools/mask-residual-cjk.mjs --dir sample --dry-run  # 只报告
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argOf = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const dir = path.resolve(argOf('--dir', 'sample'));
const dryRun = args.includes('--dry-run');

const TEXT_EXT = new Set(['.md', '.txt', '.json']);
// 文档自身不进掩码：README 是给人看的说明，_manifest 是清单
const SKIP = new Set(['README.md', '_manifest.json']);
const CJK = /[\u4e00-\u9fa5]+/g;

function mask(text) {
  let s = text;
  // 1) 结构：说话人
  s = s.replace(/他：/g, 'user:').replace(/她：/g, 'agent:');
  // 2) 结构：段落
  s = s.replace(/第(\d+)段/g, 'seg $1');
  // 3) 内容：任何汉字串
  s = s.replace(CJK, (m) => `<cjk${m.length}>`);
  return s;
}

function walk(root) {
  const out = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    const p = path.join(root, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (TEXT_EXT.has(path.extname(e.name)) && !SKIP.has(e.name)) out.push(p);
  }
  return out;
}

const files = walk(dir);
let changed = 0;
let before = 0;
let after = 0;
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const out = mask(raw);
  const n = (raw.match(CJK) || []).length;
  before += n;
  after += (out.match(CJK) || []).length;
  if (out !== raw) {
    changed += 1;
    if (!dryRun) fs.writeFileSync(f, out);
  }
}
console.log(`文件 ${files.length}，改动 ${changed}，汉字串 ${before} → ${after}${dryRun ? '（dry-run）' : ''}`);
if (after > 0) {
  console.error('仍有汉字残留，需检查映射规则');
  process.exit(1);
}
