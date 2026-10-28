#!/usr/bin/env node
// 脱敏导出：把她的记忆/日记数据转成“只保留结构与统计、正文全部掩码”的样本。
// 用法：node sanitize-export.mjs --src <原始目录> --out <输出目录>
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SRC = get('--src');
const OUT = get('--out');
if (!SRC || !OUT) { console.error('用法: node sanitize-export.mjs --src <目录> --out <目录>'); process.exit(1); }

const RULES = [
  // 凭据类：整体替换，长度也不留
  [/\bsk-[A-Za-z0-9_-]{8,}\b/g, '<KEY>'],
  [/\b[A-Za-z0-9_-]{32,}\b/g, '<TOKEN>'],
  // 网络
  [/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '<IP>'],
  [/\bhttps?:\/\/[^\s)"'\]]+/g, '<URL>'],
  [/\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g, '<EMAIL>'],
  // 号码
  [/\b1[3-9]\d{9}\b/g, '<PHONE>'],
  [/\b1[67]\d{11}\b/g, '<ts>'],
  [/\b\d{5,12}\b/g, (m) => `<num${m.length}>`],
  // 中文正文：保留“有文本”这一事实与字数桶，内容不留
  [/[\u4e00-\u9fa5]{2,}/g, (m) => `<cjk${m.length}>`],
  // 英文长串（可能是昵称/路径里的私有段）
  [/\b[A-Za-z]{12,}\b/g, (m) => `<en${m.length}>`],
  // 本机私有路径
  [/\/(?:data|storage|sdcard|home)\/[^\s"']+/g, '<PATH>'],
  [/[A-Za-z]:\\\\?[^\s"']*Users[^\s"']*/g, '<PATH>'],
];

function mask(text) {
  let out = text;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  return out;
}

const TEXT_EXT = new Set(['.md', '.txt', '.json', '.jsonl', '.yml', '.yaml', '.log']);

function walk(dir, base = dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, base, acc);
    else acc.push(p);
  }
  return acc;
}

const files = walk(SRC);
const manifest = {
  generatedAt: new Date().toISOString(),
  note: 'Body masked: CJK strings -> <cjkN>, numbers -> <numN>, plus IP/URL/credential/PATH. Structure, keys, lengths kept.',
  files: [],
};
fs.mkdirSync(OUT, { recursive: true });

for (const f of files) {
  const rel = path.relative(SRC, f);
  const ext = path.extname(f).toLowerCase();
  const buf = fs.readFileSync(f);
  const rec = { file: rel, bytes: buf.length };
  if (TEXT_EXT.has(ext)) {
    const text = buf.toString('utf8');
    rec.lines = text.split('\n').length;
    const m = mask(text);
    rec.maskedBytes = Buffer.byteLength(m);
    const dst = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, m);
  } else {
    rec.skipped = 'binary';
  }
  manifest.files.push(rec);
}

manifest.totalFiles = manifest.files.filter((x) => !x.skipped).length;
manifest.totalBytes = manifest.files.reduce((s, x) => s + (x.bytes || 0), 0);
fs.writeFileSync(path.join(OUT, '_manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`导出 ${manifest.totalFiles} 个文本文件 → ${OUT}（原始 ${(manifest.totalBytes / 1024).toFixed(1)} KB）`);

// 自检：输出里不该再出现连续中文 / 长整数 / IP（浮点小数与 _manifest 的体积统计不算）
let leaks = 0;
for (const f of walk(OUT)) {
  const rel = path.relative(OUT, f);
  if (rel === '_manifest.json') continue;
  const t = fs.readFileSync(f, 'utf8')
    .replace(/\d+\.\d+/g, ' ')            // 去掉小数（含浮点温度）
    .replace(/<cjk\d+>|<num\d+>|<en\d+>|<ts>|<IP>|<URL>|<PATH>|<KEY>|<TOKEN>|<EMAIL>|<PHONE>/g, ' ');
  if (/[\u4e00-\u9fa5]{2,}/.test(t)) { console.log('⚠ 仍有中文：', rel); leaks++; }
  if (/\b\d{6,}\b/.test(t)) { console.log('⚠ 仍有长数字：', rel); leaks++; }
  if (/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(t)) { console.log('⚠ 仍有 IP：', rel); leaks++; }
}
console.log(leaks === 0 ? '自检通过：无残留中文/号码/IP' : `自检发现 ${leaks} 处可疑`);
