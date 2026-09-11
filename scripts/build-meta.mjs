#!/usr/bin/env node
/* ====== 构建期元信息生成（零依赖，仅 GitHub Actions 调用）======
 * 产出（写入 --out 指定的站点目录）：
 *   1. posts/index.json  文章清单：前端 1 次请求拿到全部文章，避开 GitHub API 60 次/小时限流
 *   2. sitemap.xml       站点地图（含文章 hash 路由，便于后续改预渲染）
 *   3. rss.xml           RSS 订阅源
 *   4. robots.txt        指向 sitemap
 *   5. 404.html          Pages 404 兜底页
 *
 * 用法：
 *   node scripts/build-meta.mjs --out _site --url https://littledragon-wxl.github.io/blog/
 * 参数也可通过环境变量 SITE_URL / OUT_DIR 传入。
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT_DIR = arg('out', process.env.OUT_DIR || '_site');
const SITE_URL = (arg('url', process.env.SITE_URL || 'https://littledragon-wxl.github.io/blog/')
  .replace(/\/$/, '') + '/');
const POSTS_DIR = arg('posts', process.env.POSTS_DIR || 'posts');

/* ---------- front matter 解析（与 js/app.js 的 parseFrontmatter 保持一致）---------- */
function parseFrontmatter(md) {
  md = String(md || '').replace(/^﻿/, '');
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: md };
  const meta = {};
  m[1].split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i < 0) return;
    const k = line.slice(0, i).trim();
    if (!k) return;
    let v = line.slice(i + 1).trim();
    if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) v = v.slice(1, -1);
    if (v[0] === '[' && v[v.length - 1] === ']') {
      v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    meta[k] = v;
  });
  return { meta, body: m[2] };
}

/* ---------- 摘要：先剥 HTML（富文本编辑器可能存进来），再去 markdown 标记 ---------- */
function makeExcerpt(text) {
  let t = String(text || '');
  if (/<[a-z][\s\S]*>/i.test(t)) {
    t = t
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, ' ')
      .replace(/<[^>]*>/g, '');
  }
  t = t.replace(/[#*`>\[\]\(\)!_-]/g, '').replace(/\s+/g, ' ').trim();
  return t.slice(0, 80) + (t.length > 80 ? '…' : '');
}

function postFromParsed(meta, body, fallbackId) {
  const id = meta.id || fallbackId || '';
  const post = {
    id,
    title: meta.title || id,
    emoji: meta.emoji || '📝',
    date: meta.date || '',
    category: meta.category || '未分类',
    type: meta.type || 'daily',
    tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : ['未分类']),
    cover: meta.cover || '',
    cover_image: meta.cover_image || '',
    excerpt: meta.excerpt || makeExcerpt(body),
    content: body
  };
  if (!post.cover_image && body) {
    const m = body.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (m) post.cover_image = m[1];
  }
  return post;
}

/* ---------- 读取全部文章 ---------- */
const postsAbs = join(ROOT, POSTS_DIR);
if (!existsSync(postsAbs)) {
  console.error(`[build-meta] 找不到目录 ${POSTS_DIR}，跳过生成。`);
  process.exit(0);
}

const articles = [];
for (const name of readdirSync(postsAbs)) {
  if (!name.endsWith('.md')) continue;
  const raw = readFileSync(join(postsAbs, name), 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const id = meta.id || decodeURIComponent(name.replace(/\.md$/, ''));
  const post = postFromParsed(meta, body, id);
  if (post.id) articles.push(post);
}
articles.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
console.log(`[build-meta] 解析到 ${articles.length} 篇文章`);

function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }

/* ---------- 1. posts/index.json ---------- */
const manifestDir = join(ROOT, OUT_DIR, POSTS_DIR);
ensureDir(manifestDir);
writeFileSync(
  join(manifestDir, 'index.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), count: articles.length, articles }),
  'utf8'
);

/* ---------- XML / 文本转义 ---------- */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const postUrl = a => SITE_URL + '#/post/' + encodeURIComponent(a.id);
const toRFC822 = d => {
  const t = (d && Date.parse(d)) ? new Date(Date.parse(d)) : new Date();
  return t.toUTCString();
};

/* ---------- 2. sitemap.xml ---------- */
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  `  <url><loc>${esc(SITE_URL)}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
  ...articles.map(a => `  <url><loc>${esc(postUrl(a))}</loc><lastmod>${esc(String(a.date || ''))}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`),
  '</urlset>',
  ''
].join('\n');
writeFileSync(join(ROOT, OUT_DIR, 'sitemap.xml'), sitemap, 'utf8');

/* ---------- 3. rss.xml ---------- */
const rss = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0"><channel>',
  '  <title>独白 · 个人博客</title>',
  `  <link>${esc(SITE_URL)}</link>`,
  '  <description>记录代码、思考与生活的点滴。</description>',
  '  <language>zh-CN</language>',
  articles.slice(0, 20).map(a => [
    '  <item>',
    `    <title>${esc(a.title)}</title>`,
    `    <link>${esc(postUrl(a))}</link>`,
    `    <guid isPermaLink="false">${esc(a.id)}</guid>`,
    `    <pubDate>${esc(toRFC822(a.date))}</pubDate>`,
    `    <description>${esc(a.excerpt)}</description>`,
    '  </item>'
  ].join('\n')).join('\n'),
  '</channel></rss>',
  ''
].join('\n');
writeFileSync(join(ROOT, OUT_DIR, 'rss.xml'), rss, 'utf8');

/* ---------- 4. robots.txt ---------- */
writeFileSync(
  join(ROOT, OUT_DIR, 'robots.txt'),
  ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE_URL}sitemap.xml`, ''].join('\n'),
  'utf8'
);

/* ---------- 5. 404.html ---------- */
const notFound = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>页面不存在 · 独白</title>
<meta name="robots" content="noindex">
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
       background:#faf8f5;color:#2c2c2a;}
  .box{text-align:center;padding:40px;}
  .code{font-size:64px;font-weight:600;margin:0 0 8px;color:#c96f4a;}
  p{color:#6b6862;margin:0 0 24px;}
  a{display:inline-block;padding:10px 22px;border-radius:999px;background:#c96f4a;
    color:#fff;text-decoration:none;font-size:14px;}
</style>
</head>
<body>
  <div class="box">
    <h1 class="code">404</h1>
    <p>这个地址没有内容，可能链接已经失效。</p>
    <a href="${SITE_URL}">回到首页</a>
  </div>
</body>
</html>
`;
writeFileSync(join(ROOT, OUT_DIR, '404.html'), notFound, 'utf8');

console.log(`[build-meta] 已生成：${OUT_DIR}/posts/index.json, sitemap.xml, rss.xml, robots.txt, 404.html`);
