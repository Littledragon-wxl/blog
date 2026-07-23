/* ====== 博客应用：路由与渲染 ====== */
(function () {
  "use strict";

  // 版本检测：若 localStorage 中缓存的版本号与当前不一致，清除文章缓存并强制刷新
  // 防止浏览器/Github Pages 缓存旧版 app.js，导致保存仍走旧逻辑（改写 js/posts.json）
  const APP_VERSION = '20260723b';
  try {
    const cachedVersion = localStorage.getItem('blog-app-version');
    if (cachedVersion !== APP_VERSION) {
      localStorage.removeItem('blog-posts-cache');
      localStorage.setItem('blog-app-version', APP_VERSION);
      if (cachedVersion) {
        location.reload(true);
        return;
      }
    }
  } catch (e) {}

  const app = document.getElementById('app');
  const header = document.getElementById('siteHeader');
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  const backToTop = document.getElementById('backToTop');

  // 配置 marked
  if (window.marked) {
    marked.setOptions({ breaks: true, gfm: true });
  }

  // 文章数据（运行时从 posts/ 目录逐篇加载，每篇一个 <id>.md 文件）
  let ARTICLES = [];

  // 站点配置（运行时从 js/site.json 加载）
  let SITE = {};

  // ====== 工具函数 ======
  function readingTime(markdown) {
    // 中文按字数，英文按词，粗略估算
    const text = markdown.replace(/[#*`>\-\[\]\(\)!]/g, '');
    const chars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const words = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\S+/g) || []).length;
    const minutes = Math.ceil((chars / 400) + (words / 200));
    return Math.max(1, minutes);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const months = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    return `${d.getFullYear()} 年 ${months[d.getMonth()]} ${d.getDate()} 日`;
  }

  function shortDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ====== 文章文件（posts/<id>.md）的 front matter 解析与构建 ======
  // 解析：--- \n key: value \n --- \n 正文
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

  // 构建：把文章对象拼成 <id>.md 文本内容
  function buildMarkdown(post) {
    const tags = (post.tags && post.tags.length) ? post.tags : ['未分类'];
    const lines = [
      '---',
      'id: ' + (post.id || ''),
      'title: ' + (post.title || ''),
      'emoji: ' + (post.emoji || '📝'),
      'date: ' + (post.date || ''),
      'category: ' + (post.category || '未分类'),
      'tags: [' + tags.join(', ') + ']',
      'cover: ' + (post.cover || ''),
      'excerpt: ' + (post.excerpt || '').replace(/\r?\n/g, ' '),
      '---',
      '',
      post.content || ''
    ];
    return lines.join('\n');
  }

  // 由 front matter + 正文 还原成文章对象（与 posts.json 字段兼容）
  function postFromParsed(meta, body) {
    const id = meta.id || '';
    return {
      id: id,
      title: meta.title || id,
      emoji: meta.emoji || '📝',
      date: meta.date || '',
      category: meta.category || '未分类',
      tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : ['未分类']),
      cover: meta.cover || '',
      excerpt: meta.excerpt || makeExcerpt(body),
      content: body
    };
  }

  // ====== HTML → Markdown 转换器（富文本编辑器内容转回 markdown 存储）======
  function htmlToMarkdown(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    function walk(node) {
      if (!node) return '';
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      const inner = Array.from(node.childNodes).map(walk).join('');
      switch (tag) {
        case 'b': case 'strong': return '**' + inner + '**';
        case 'i': case 'em': return '*' + inner + '*';
        case 'code':
          if (node.parentNode && node.parentNode.tagName === 'PRE') return inner;
          return '`' + inner + '`';
        case 'pre': {
          const codeEl = node.querySelector('code') || node;
          let code = codeEl.textContent;
          if (code.endsWith('\n')) code = code.slice(0, -1);
          return '\n```\n' + code + '\n```\n';
        }
        case 'h1': return '\n# ' + inner.trim() + '\n\n';
        case 'h2': return '\n## ' + inner.trim() + '\n\n';
        case 'h3': return '\n### ' + inner.trim() + '\n\n';
        case 'h4': return '\n#### ' + inner.trim() + '\n\n';
        case 'blockquote':
          return '\n' + inner.trim().split('\n').map(l => '> ' + l).join('\n') + '\n\n';
        case 'ul':
          return '\n' + Array.from(node.children).filter(c => c.tagName === 'LI')
            .map(li => '- ' + walk(li).trim()).join('\n') + '\n\n';
        case 'ol':
          return '\n' + Array.from(node.children).filter(c => c.tagName === 'LI')
            .map((li, i) => (i + 1) + '. ' + walk(li).trim()).join('\n') + '\n\n';
        case 'li': return inner;
        case 'a': {
          const href = node.getAttribute('href') || '';
          return '[' + inner + '](' + href + ')';
        }
        case 'br': return '\n';
        case 'p': case 'div':
          // callout 提示框：保留为原始 HTML（marked 默认透传）
          if (tag === 'div' && node.classList && node.classList.contains('callout')) {
            return '\n<div class="callout">' + node.innerHTML.trim() + '</div>\n\n';
          }
          return inner + '\n\n';
        default: return inner;
      }
    }
    return walk(doc.body).replace(/\n{3,}/g, '\n\n').trim();
  }

  // 视图偏好（卡片 / 列表），记忆在 localStorage
  function getView() {
    try { return localStorage.getItem('blog-view') || 'card'; }
    catch (e) { return 'card'; }
  }
  function setView(v) {
    try { localStorage.setItem('blog-view', v); } catch (e) {}
  }

  function getArticle(id) {
    return getAllArticles().find(a => a.id === id);
  }

  function getAllArticles() {
    return ARTICLES.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // ====== 管理员权限（GitHub Token，存 sessionStorage，关浏览器即清空）======
  const ADMIN_TOKEN_KEY = 'blog-admin-token';
  const ADMIN_USER_KEY = 'blog-admin-user';

  function isAdmin() {
    try { return !!sessionStorage.getItem(ADMIN_TOKEN_KEY); } catch (e) { return false; }
  }
  function getAdminToken() {
    try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function getAdminUser() {
    try { return sessionStorage.getItem(ADMIN_USER_KEY) || ''; } catch (e) { return ''; }
  }
  function adminLogout() {
    try { sessionStorage.removeItem(ADMIN_TOKEN_KEY); sessionStorage.removeItem(ADMIN_USER_KEY); } catch (e) {}
  }

  // 验证 token（调 GitHub API 看是否有效，返回用户名或 null）
  async function validateToken(token) {
    try {
      const r = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' }
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d.login;
    } catch (e) { return null; }
  }

  // ====== GitHub 发布（提交 data/articles.json 到仓库，触发自动部署）======
  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function githubGetFile(path) {
    const token = getAdminToken();
    const url = 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' + path + '?ref=' + CONFIG.branch;
    const r = await fetch(url, {
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' }
    });
    if (!r.ok) throw new Error('获取文件失败: ' + r.status);
    return r.json();
  }

  async function githubCommitFile(content, sha, path, message) {
    const token = getAdminToken();
    const url = 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' + path;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message, content: b64encode(content), sha: sha, branch: CONFIG.branch })
    });
    if (!r.ok) {
      let detail = '';
      try { const e = await r.json(); detail = e.message || (e.errors && e.errors[0] && e.errors[0].message) || ''; } catch (e) {}
      throw new Error('HTTP ' + r.status + (detail ? ' - ' + detail : ''));
    }
    return r.json();
  }

  // 列出 posts/ 目录下的文件（无需 token，公开仓库即可）
  async function githubListDir(path) {
    const url = 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' + path + '?ref=' + CONFIG.branch;
    const r = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  }

  // 删除单个文件（DELETE 方法，需先拿 sha）
  async function githubDeleteFile(path, sha, message) {
    const token = getAdminToken();
    const url = 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' + path;
    const r = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message, sha: sha, branch: CONFIG.branch })
    });
    if (!r.ok) {
      let detail = '';
      try { const e = await r.json(); detail = e.message || (e.errors && e.errors[0] && e.errors[0].message) || ''; } catch (e) {}
      throw new Error('HTTP ' + r.status + (detail ? ' - ' + detail : ''));
    }
    return r.json();
  }

  // 单篇文章的完整路径（posts/<id>.md）
  function postPath(id) {
    return CONFIG.postsDir + '/' + encodeURIComponent(id) + '.md';
  }

  // 从 posts/ 目录加载所有文章（纯目录式，无共享文件）
  async function loadPosts() {
    const entries = await githubListDir(CONFIG.postsDir);
    const mdFiles = entries.filter(e => e.type === 'file' && e.name.endsWith('.md'));
    const articles = [];
    for (const f of mdFiles) {
      try {
        const raw = await fetch(f.download_url, { cache: 'no-store' });
        if (!raw.ok) continue;
        const text = await raw.text();
        const { meta, body } = parseFrontmatter(text);
        if (!meta.id) meta.id = decodeURIComponent(f.name.replace(/\.md$/, ''));
        const post = postFromParsed(meta, body);
        if (post.id) articles.push(post);
      } catch (e) { /* 单篇出错不影响其他 */ }
    }
    articles.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    try { localStorage.setItem('blog-posts-cache', JSON.stringify({ ts: Date.now(), articles })); } catch (e) {}
    return articles;
  }

  // 按需取单篇（深链 / 刷新场景，内存里没有时直接拉 raw）
  async function fetchPostFile(id) {
    const url = 'https://raw.githubusercontent.com/' + CONFIG.owner + '/' + CONFIG.repo + '/' + CONFIG.branch + '/' + postPath(id);
    const r = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    const text = await r.text();
    const { meta, body } = parseFrontmatter(text);
    if (!meta.id) meta.id = id;
    return postFromParsed(meta, body);
  }

  // 发布文章（新增或更新）—— 只写 posts/<id>.md 这一个文件
  async function publishPost(article) {
    const path = postPath(article.id);
    const content = buildMarkdown(article);
    let sha = null;
    try { const f = await githubGetFile(path); sha = f.sha; } catch (e) { sha = null; }
    await githubCommitFile(content, sha, path, (sha ? '更新文章: ' : '发布新文章: ') + article.title);
    const idx = ARTICLES.findIndex(a => a.id === article.id);
    if (idx >= 0) ARTICLES[idx] = article; else ARTICLES.unshift(article);
  }

  // 删除文章 —— 只 DELETE posts/<id>.md 这一个文件（彻底无共享文件冲突）
  async function deletePost(id) {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const file = await githubGetFile(postPath(id));
        await githubDeleteFile(postPath(id), file.sha, '删除文章: ' + id);
        ARTICLES = ARTICLES.filter(a => a.id !== id);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt === 0 && String(err.message).includes('409')) continue; // sha 冲突重试一次
        throw err;
      }
    }
    throw lastErr;
  }

  // 提交后重新从 GitHub 拉取最新文章（列目录），确保本地与线上一致
  async function refreshArticlesFromGitHub() {
    try {
      ARTICLES = await loadPosts();
      return true;
    } catch (e) {
      return false;
    }
  }

  // 保存成功后显示「发布成功」页面（不自动跳转，避免部署延迟导致文章找不到）
  function showPublishSuccess(article) {
    app.innerHTML = `
      <div class="container">
        <div class="publish-success fade-in">
          <div class="ps-icon">✅</div>
          <h2>发布成功！</h2>
          <p>《${escapeHtml(article.title)}》已提交到 GitHub，等待部署完成后访客即可看到。</p>
          <div class="ps-actions">
            <a href="#/post/${encodeURIComponent(article.id)}" class="ed-btn ed-btn-primary">查看文章</a>
            <a href="#/write" class="ed-btn ed-btn-ghost">再写一篇</a>
            <a href="#/" class="ed-btn ed-btn-ghost">返回首页</a>
          </div>
          <p class="ps-note">提示：GitHub Pages 部署约需 1 分钟。若点击「查看文章」显示不存在，请稍等片刻再试，或直接访问线上首页。</p>
        </div>
      </div>`;
  }

  // 发布站点信息 —— 提交 js/site.json
  async function publishSite(newSite) {
    const file = await githubGetFile(CONFIG.sitePath);
    await githubCommitFile(JSON.stringify(newSite, null, 2), file.sha, CONFIG.sitePath, '更新站点信息');
    SITE = newSite;
  }

  function getAllTags() {
    const map = {};
    getAllArticles().forEach(a => a.tags.forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  // 生成新 id
  function genId(title) {
    const base = (title || 'post').toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'post';
    return base + '-' + Date.now().toString(36);
  }

  // 从 markdown 生成摘要
  function makeExcerpt(markdown) {
    const text = markdown.replace(/[#*`>\[\]\(\)!_-]/g, '').replace(/\n+/g, ' ').trim();
    return text.slice(0, 80) + (text.length > 80 ? '…' : '');
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  // ====== 渲染：首页 ======
  function renderHome(tagFilter) {
    let posts = getAllArticles();
    let heroOrFilter = '';

    if (tagFilter) {
      posts = posts.filter(a => a.tags.includes(tagFilter));
      heroOrFilter = `
        <div class="tag-filter-head fade-in">
          <a href="#/tags" class="back-link">← 全部标签</a>
          <h2><span class="hash">#</span>${escapeHtml(tagFilter)}</h2>
          <p style="color:var(--text-mute);font-size:.92rem;margin-top:6px">共 ${posts.length} 篇文章</p>
        </div>`;
    } else {
      heroOrFilter = `
        <section class="hero fade-in">
          <h1>记录<span class="accent">代码</span>，也记录<span class="accent">生活</span></h1>
          <p>一个全栈开发者的个人博客。这里写技术探索，也写深夜思考。<br>相信好的程序和好的文字，都需要耐心打磨。</p>
          <div class="hero-tags">
            <span>📝 ${getAllArticles().length} 篇文章</span>
            <span>🏷️ ${getAllTags().length} 个标签</span>
            <span>✍️ 可在线写作</span>
          </div>
        </section>`;
    }

    const listHtml = posts.map(a => `
      <a class="post-card fade-in" href="#/post/${a.id}">
        <div class="pc-meta">
          <span class="pc-cat">${a.category}</span>
          <span class="dot"></span>
          <span>${shortDate(a.date)}</span>
          <span class="dot"></span>
          <span>${readingTime(a.content)} 分钟阅读</span>
        </div>
        <h3>${escapeHtml(a.title)}</h3>
        <p class="pc-excerpt">${escapeHtml(a.excerpt)}</p>
        <div class="pc-footer">
          <div class="pc-tags">${a.tags.map(t => `<span class="pc-tag">#${escapeHtml(t)}</span>`).join('')}</div>
          <span class="pc-read">阅读全文 →</span>
        </div>
      </a>
    `).join('');

    const cardHtml = posts.map(a => {
      const grad = COVERS[a.cover] || COVERS.ocean;
      return `
      <a class="xhs-card fade-in" href="#/post/${a.id}">
        <div class="xhs-cover" style="background:${grad}">
          <span class="cover-cat">${a.category}</span>
          <span class="cover-emoji">${a.emoji || '📄'}</span>
          <span class="cover-read">${readingTime(a.content)} 分钟</span>
        </div>
        <div class="xhs-body">
          <h3>${escapeHtml(a.title)}</h3>
          <p class="xhs-excerpt">${escapeHtml(a.excerpt)}</p>
          <div class="xhs-footer">
            <div class="xhs-tags">${a.tags.slice(0, 2).map(t => `<span class="xhs-tag">#${escapeHtml(t)}</span>`).join('')}</div>
            <span class="xhs-date">${shortDate(a.date)}</span>
          </div>
        </div>
      </a>`;
    }).join('');

    const empty = posts.length === 0
      ? `<div class="empty-state"><div class="es-icon">📭</div><h3>还没有文章</h3><p>这个标签下暂无内容</p></div>`
      : '';

    const view = getView();
    const gridSVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
    const listSVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>';

    app.innerHTML = `
      <div class="container">
        ${heroOrFilter}
        <div class="section-head with-toggle">
          <div class="head-left">
            <h2>${tagFilter ? '相关文章' : '最新文章'}</h2>
            <span class="count">${posts.length} 篇</span>
          </div>
          <div class="view-toggle" id="viewToggle">
            <button data-view="card" class="${view === 'card' ? 'active' : ''}" title="卡片视图" aria-label="卡片视图">${gridSVG}</button>
            <button data-view="list" class="${view === 'list' ? 'active' : ''}" title="列表视图" aria-label="列表视图">${listSVG}</button>
          </div>
        </div>
        ${view === 'card'
          ? `<div class="card-grid">${cardHtml}${empty}</div>`
          : `<div class="post-list">${listHtml}${empty}</div>`}
      </div>`;

    // 绑定切换按钮
    const toggle = document.getElementById('viewToggle');
    if (toggle) {
      toggle.addEventListener('click', e => {
        const btn = e.target.closest('button[data-view]');
        if (!btn) return;
        const v = btn.getAttribute('data-view');
        if (v === getView()) return;
        setView(v);
        renderHome(tagFilter);
      });
    }
  }

  // ====== 渲染：文章详情 ======
  async function renderPost(id) {
    let a = getArticle(id);
    if (!a) {
      // 内存里没有，可能是深链/刷新场景，按需取单篇
      try {
        const post = await fetchPostFile(id);
        if (post) { a = post; if (!ARTICLES.find(x => x.id === id)) ARTICLES.unshift(post); }
      } catch (e) {}
    }
    if (!a) {
      app.innerHTML = `<div class="container"><div class="empty-state"><div class="es-icon">🔍</div><h3>文章不存在</h3><p>可能已被移除或链接有误</p><p style="margin-top:18px"><a href="#/">← 返回首页</a></p></div></div>`;
      return;
    }

    const html = marked.parse(a.content);
    const related = getAllArticles().filter(x => x.id !== id && x.tags.some(t => a.tags.includes(t))).slice(0, 2);
    const admin = isAdmin();

    app.innerHTML = `
      <div class="container">
        <article class="article-wrap fade-in">
          <div class="article-top-bar">
            <a href="#/" class="back-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              返回文章列表
            </a>
            ${admin ? `<div class="article-actions">
              <a href="#/edit/${a.id}" class="action-btn edit-btn">✏️ 编辑</a>
              <button class="action-btn del-btn" id="delBtn">🗑 删除</button>
            </div>` : `<a href="#/admin" class="write-cta">🔐 作者登录</a>`}
          </div>
          <header class="article-header">
            <div class="ac-meta">
              <span class="ac-cat">${a.category}</span>
              ${admin ? '<span class="ac-mine">✍️ 已登录</span>' : ''}
              <span>·</span>
              <span>${formatDate(a.date)}</span>
              <span>·</span>
              <span>${readingTime(a.content)} 分钟阅读</span>
            </div>
            <h1>${escapeHtml(a.title)}</h1>
            <div class="ac-tags">${a.tags.map(t => `<a href="#/tags/${encodeURIComponent(t)}" class="ac-tag">#${escapeHtml(t)}</a>`).join('')}</div>
          </header>
          <div class="markdown-body">${html}</div>
          <footer class="article-footer">
            <div class="af-tags">${a.tags.map(t => `<a href="#/tags/${encodeURIComponent(t)}" class="ac-tag">#${escapeHtml(t)}</a>`).join('')}</div>
            <span class="share-note">感谢阅读 · ${formatDate(a.date)}</span>
          </footer>
        </article>
        ${related.length ? renderRelated(related) : ''}
      </div>`;

    // 删除按钮（提交到 GitHub）
    const delBtn = document.getElementById('delBtn');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!isAdmin()) {
          alert('登录已过期，请重新登录作者账号。');
          location.hash = '#/admin';
          return;
        }
        if (!confirm('确定删除这篇文章吗？\n这将提交到 GitHub 并重新部署，所有访客都会看到删除结果。')) return;
        delBtn.disabled = true;
        delBtn.textContent = '⏳ 删除中…';
        try {
          await deletePost(a.id);
          // 本地立即生效：内存已更新，直接重渲染首页（不依赖部署延迟）
          alert('✅ 文章已删除。\n\n本地立即生效；线上约 1 分钟后同步（GitHub Pages 部署需要一点时间）。');
          location.hash = '#/';
        } catch (err) {
          const msg = String(err.message || '');
          if (msg.includes('401') || msg.includes('403') || msg.includes('Bad credentials')) {
            alert('删除失败：Token 已失效或无权限。\n请重新登录 #/admin 并输入有效 token。');
            adminLogout();
            location.hash = '#/admin';
          } else {
            alert('删除失败（' + msg + '）\n\n请把上面括号里的错误信息发给我，我据此定位。');
          }
          delBtn.disabled = false;
          delBtn.textContent = '🗑 删除';
        }
      });
    }
  }

  function renderRelated(related) {
    return `
      <section style="max-width:var(--maxw);margin:56px auto 0;">
        <div class="section-head"><h2>相关阅读</h2></div>
        <div class="post-list">
          ${related.map(a => `
            <a class="post-card fade-in" href="#/post/${a.id}">
              <div class="pc-meta">
                <span class="pc-cat">${a.category}</span>
                <span class="dot"></span>
                <span>${shortDate(a.date)}</span>
              </div>
              <h3>${escapeHtml(a.title)}</h3>
              <p class="pc-excerpt">${escapeHtml(a.excerpt)}</p>
            </a>
          `).join('')}
        </div>
      </section>`;
  }

  // ====== 渲染：写作编辑器 ======
  function renderWrite(editId) {
    const editing = editId ? getArticle(editId) : null;
    const a = editing || { id: '', title: '', category: '技术', tags: [], date: new Date().toISOString().slice(0, 10), excerpt: '', content: '', emoji: '📝', cover: 'ocean' };

    const coverOpts = Object.keys(COVERS).map(k =>
      `<option value="${k}" ${k === a.cover ? 'selected' : ''}>${k}</option>`
    ).join('');
    const emojiPicks = ['📝','💻','⚡','🎨','🌙','☕','📚','🛠️','🌱','🔥','✨','🚀','📖','🎧','🏞️','💡'];
    const emojiHtml = emojiPicks.map(e =>
      `<button type="button" class="emoji-pick ${e === a.emoji ? 'active' : ''}" data-emoji="${e}">${e}</button>`
    ).join('');

    app.innerHTML = `
      <div class="container">
        <div class="editor-page fade-in">
          <div class="editor-top">
            <a href="#/" class="back-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              ${editing ? '返回文章' : '返回首页'}
            </a>
            <h2>${editing ? '✏️ 编辑文章' : '✍️ 写新文章'}</h2>
            <span class="save-status" id="saveStatus">${editing ? '已保存的内容已载入' : '自动保存草稿'}</span>
          </div>

          <div class="editor-form">
            <input type="text" id="edTitle" class="ed-title-input" placeholder="给文章起个标题……" value="${escapeHtml(a.title)}" />

            <div class="ed-meta-row">
              <div class="ed-field">
                <label>分类</label>
                <select id="edCategory">
                  <option ${a.category === '技术' ? 'selected' : ''}>技术</option>
                  <option ${a.category === '生活随笔' ? 'selected' : ''}>生活随笔</option>
                </select>
              </div>
              <div class="ed-field ed-field-grow">
                <label>标签（逗号分隔）</label>
                <input type="text" id="edTags" placeholder="前端, JavaScript" value="${escapeHtml(a.tags.join(', '))}" />
              </div>
              <div class="ed-field">
                <label>封面配色</label>
                <select id="edCover">${coverOpts}</select>
              </div>
            </div>

            <div class="ed-emoji-row">
              <label>封面图标</label>
              <div class="emoji-picks" id="emojiPicks">${emojiHtml}</div>
              <input type="text" id="edEmojiText" class="ed-emoji-text" value="${escapeHtml(a.emoji)}" maxlength="4" placeholder="或输入" />
            </div>

            <div class="ed-toolbar" id="edToolbar">
              <button type="button" data-cmd="formatBlock-h2" title="二级标题">H2</button>
              <button type="button" data-cmd="formatBlock-h3" title="三级标题">H3</button>
              <button type="button" data-cmd="formatBlock-h4" title="四级标题">H4</button>
              <span class="tb-sep"></span>
              <button type="button" data-cmd="bold" title="粗体 (Ctrl+B)"><b>B</b></button>
              <button type="button" data-cmd="italic" title="斜体 (Ctrl+I)"><i>I</i></button>
              <button type="button" data-cmd="underline" title="下划线"><u>U</u></button>
              <button type="button" data-cmd="inlineCode" title="行内代码">&lt;/&gt;</button>
              <span class="tb-sep"></span>
              <button type="button" data-cmd="formatBlock-blockquote" title="引用">❝ 引用</button>
              <button type="button" data-cmd="callout" title="彩色提示框">📌 提示框</button>
              <button type="button" data-cmd="insertUnorderedList" title="无序列表">• 列表</button>
              <button type="button" data-cmd="insertOrderedList" title="有序列表">1. 列表</button>
              <button type="button" data-cmd="createLink" title="插入链接">🔗</button>
              <button type="button" data-cmd="codeBlock" title="代码块">{ }</button>
              <span class="tb-sep"></span>
              <button type="button" data-cmd="sourceToggle" title="切换源码模式" id="srcToggle">{'</>'} 源码</button>
            </div>

            <div class="ed-wysiwyg-wrap" id="edWysiwygWrap">
              <div id="edContent" class="ed-wysiwyg markdown-body" contenteditable="true"
                data-placeholder="开始你的故事……按 Ctrl+B 加粗、Ctrl+I 斜体；用上方工具栏或快捷键"></div>
              <textarea id="edSource" class="ed-textarea ed-source" style="display:none"
                placeholder="在这里直接写 Markdown……"></textarea>

              <div class="block-add" id="blockAdd" title="插入块">+</div>
              <div class="block-menu" id="blockMenu">
                <button type="button" data-block="p">¶ 段落</button>
                <button type="button" data-block="h2">H2 标题</button>
                <button type="button" data-block="h3">H3 标题</button>
                <button type="button" data-block="h4">H4 标题</button>
                <button type="button" data-block="blockquote">❝ 引用</button>
                <button type="button" data-block="callout">📌 提示框</button>
                <button type="button" data-block="ul">• 无序列表</button>
                <button type="button" data-block="ol">1. 有序列表</button>
                <button type="button" data-block="pre">{} 代码块</button>
                <button type="button" data-block="hr">―― 分隔线</button>
              </div>
            </div>

            <div class="ed-actions">
              <a href="#/" class="ed-btn ed-btn-ghost">取消</a>
              <button type="button" class="ed-btn ed-btn-primary" id="edSave">${editing ? '保存修改' : '发布文章'}</button>
            </div>
          </div>
        </div>
      </div>`;

    // ====== 编辑器交互（富文本 WYSIWYG，可切源码）======
    const edEl = document.getElementById('edContent');      // contenteditable 富文本
    const srcEl = document.getElementById('edSource');      // 源码 textarea
    const titleEl = document.getElementById('edTitle');
    const statusEl = document.getElementById('saveStatus');
    const srcToggleBtn = document.getElementById('srcToggle');
    let currentEmoji = a.emoji;
    let sourceMode = false;

    // 获取当前 markdown
    function getMarkdown() {
      if (sourceMode) return srcEl.value;
      return htmlToMarkdown(edEl.innerHTML);
    }

    // 把 markdown 渲染进富文本
    function loadToWysiwyg(md) {
      edEl.innerHTML = marked.parse(md || '');
    }

    // 初始载入
    if (a.content) loadToWysiwyg(a.content);

    // 草稿自动保存（仅新建时）
    const draftKey = 'blog-draft';
    if (!editing) {
      try {
        const draft = localStorage.getItem(draftKey);
        if (draft && !a.content) {
          const d = JSON.parse(draft);
          if (d.content) { loadToWysiwyg(d.content); titleEl.value = d.title || ''; }
        }
      } catch (e) {}
    }

    let draftTimer;
    function autoDraft() {
      if (editing) return;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        try { localStorage.setItem(draftKey, JSON.stringify({ title: titleEl.value, content: getMarkdown() })); } catch (e) {}
      }, 800);
    }

    edEl.addEventListener('input', autoDraft);
    srcEl.addEventListener('input', autoDraft);

    // 粘贴：转纯文本，去除外来格式
    edEl.addEventListener('paste', e => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    // emoji 选择
    const emojiPicksEl = document.getElementById('emojiPicks');
    const emojiTextEl = document.getElementById('edEmojiText');
    emojiPicksEl.addEventListener('click', e => {
      const btn = e.target.closest('.emoji-pick');
      if (!btn) return;
      currentEmoji = btn.dataset.emoji;
      emojiTextEl.value = currentEmoji;
      emojiPicksEl.querySelectorAll('.emoji-pick').forEach(b => b.classList.toggle('active', b === btn));
    });
    emojiTextEl.addEventListener('input', () => { currentEmoji = emojiTextEl.value || '📝'; });

    // 工具栏
    const toolbar = document.getElementById('edToolbar');
    function wrapWithTag(tagName, placeholder) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        const el = document.createElement(tagName);
        el.textContent = placeholder || '';
        range.insertNode(el);
        const r = document.createRange();
        r.selectNodeContents(el);
        sel.removeAllRanges(); sel.addRange(r);
      } else {
        const el = document.createElement(tagName);
        try { el.appendChild(range.extractContents()); } catch (e) { return; }
        range.insertNode(el);
      }
      edEl.focus();
      autoDraft();
    }

    toolbar.addEventListener('click', e => {
      const btn = e.target.closest('button[data-cmd]');
      if (!btn) return;
      const cmd = btn.dataset.cmd;

      // 源码模式：只允许切换回富文本
      if (sourceMode && cmd !== 'sourceToggle') return;

      edEl.focus();

      if (cmd === 'sourceToggle') {
        if (sourceMode) {
          // 源码 → 富文本
          loadToWysiwyg(srcEl.value);
          edEl.style.display = '';
          srcEl.style.display = 'none';
          srcToggleBtn.innerHTML = '{</>} 源码';
          sourceMode = false;
        } else {
          // 富文本 → 源码
          srcEl.value = getMarkdown();
          edEl.style.display = 'none';
          srcEl.style.display = '';
          srcToggleBtn.innerHTML = '👁 富文本';
          sourceMode = true;
          srcEl.focus();
        }
        return;
      }

      if (cmd.startsWith('formatBlock-')) {
        const tag = cmd.split('-')[1];
        document.execCommand('formatBlock', false, tag);
      } else if (cmd === 'inlineCode') {
        wrapWithTag('code', 'code');
      } else if (cmd === 'codeBlock') {
        const sel = window.getSelection();
        const hasSel = sel.rangeCount && !sel.getRangeAt(0).collapsed;
        if (hasSel) {
          wrapWithTag('pre', '');
        } else {
          document.execCommand('formatBlock', false, 'pre');
        }
      } else if (cmd === 'callout') {
        // 插入/切换彩色提示框（callout）
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        // 检查是否已在 callout 内
        const node = sel.anchorNode;
        const block = node.nodeType === 1 ? node : node.parentNode;
        const inCallout = block.closest && block.closest('.callout');
        if (inCallout) {
          // 移出 callout
          const p = document.createElement('p');
          while (inCallout.firstChild) p.appendChild(inCallout.firstChild);
          inCallout.parentNode.replaceChild(p, inCallout);
        } else {
          const div = document.createElement('div');
          div.className = 'callout';
          div.setAttribute('data-callout', '');
          if (range.collapsed) {
            div.innerHTML = '提示内容…';
          } else {
            try { div.appendChild(range.extractContents()); } catch (e) { return; }
          }
          range.insertNode(div);
          // 光标放进 callout 末尾
          const r = document.createRange();
          r.selectNodeContents(div);
          r.collapse(false);
          sel.removeAllRanges(); sel.addRange(r);
        }
        edEl.focus();
      } else if (cmd === 'createLink') {
        const url = prompt('请输入链接地址（http:// 或 https://）：', 'https://');
        if (url && url !== 'https://') document.execCommand('createLink', false, url);
      } else {
        // bold / italic / underline / insertUnorderedList / insertOrderedList
        document.execCommand(cmd, false, null);
      }
      autoDraft();
    });

    // ====== 飞书式 + 快捷插入（左侧跟随光标）======
    const wrapEl = document.getElementById('edWysiwygWrap');
    const blockAdd = document.getElementById('blockAdd');
    const blockMenu = document.getElementById('blockMenu');
    const blockMenuBtns = blockMenu.querySelectorAll('button[data-block]');

    function currentBlock() {
      const sel = window.getSelection();
      if (!sel.rangeCount) return null;
      const node = sel.anchorNode;
      if (!node || !edEl.contains(node)) return null;
      let el = node.nodeType === 1 ? node : node.parentNode;
      // 找最近的块级元素
      while (el && el !== edEl && !/^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|LI)$/.test(el.tagName) && !el.classList.contains('callout')) {
        el = el.parentNode;
      }
      if (!el || el === edEl) return edEl;
      return el;
    }

    function positionBlockAdd() {
      if (sourceMode) { wrapEl.classList.remove('show-add'); return; }
      const block = currentBlock();
      if (!block) { wrapEl.classList.remove('show-add'); return; }
      // 块的相对 wrap 位置
      const wrapRect = wrapEl.getBoundingClientRect();
      const blockRect = block.getBoundingClientRect();
      const top = blockRect.top - wrapRect.top + wrapEl.scrollTop;
      blockAdd.style.top = top + 'px';
      wrapEl.classList.add('show-add');
    }

    document.addEventListener('selectionchange', () => {
      // 仅在富文本模式下、焦点在 edEl 时显示
      if (sourceMode) { wrapEl.classList.remove('show-add'); return; }
      if (document.activeElement === edEl) positionBlockAdd();
      else wrapEl.classList.remove('show-add');
    });
    // 编辑器点击/键盘/滚动时也刷新位置
    edEl.addEventListener('keyup', positionBlockAdd);
    edEl.addEventListener('click', positionBlockAdd);
    wrapEl.addEventListener('scroll', positionBlockAdd);
    window.addEventListener('scroll', positionBlockAdd);

    // 打开/关闭菜单
    function closeBlockMenu() {
      blockMenu.classList.remove('open');
    }
    blockAdd.addEventListener('click', e => {
      e.stopPropagation();
      if (blockMenu.classList.contains('open')) {
        closeBlockMenu();
      } else {
        // 定位菜单在 + 按钮右边
        const addRect = blockAdd.getBoundingClientRect();
        const wrapRect = wrapEl.getBoundingClientRect();
        blockMenu.style.top = (addRect.bottom - wrapRect.top + wrapEl.scrollTop + 6) + 'px';
        blockMenu.style.left = (addRect.right - wrapRect.left + wrapEl.scrollLeft + 6) + 'px';
        blockMenu.classList.add('open');
      }
    });
    document.addEventListener('click', e => {
      if (!blockMenu.contains(e.target) && e.target !== blockAdd) closeBlockMenu();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeBlockMenu();
    });

    // 菜单操作：把当前块转为目标块
    blockMenuBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.block;
        const block = currentBlock();
        if (!block) { closeBlockMenu(); return; }
        edEl.focus();
        // 先把光标放到当前块内
        const sel = window.getSelection();
        const r = document.createRange();
        r.selectNodeContents(block); r.collapse(false);
        sel.removeAllRanges(); sel.addRange(r);

        if (type === 'p') {
          document.execCommand('formatBlock', false, 'p');
        } else if (type === 'h2' || type === 'h3' || type === 'h4') {
          document.execCommand('formatBlock', false, type);
        } else if (type === 'blockquote') {
          document.execCommand('formatBlock', false, 'blockquote');
        } else if (type === 'pre') {
          document.execCommand('formatBlock', false, 'pre');
        } else if (type === 'ul') {
          document.execCommand('insertUnorderedList');
        } else if (type === 'ol') {
          document.execCommand('insertOrderedList');
        } else if (type === 'hr') {
          document.execCommand('insertHorizontalRule');
        } else if (type === 'callout') {
          // 包成 callout
          const div = document.createElement('div');
          div.className = 'callout';
          div.setAttribute('data-callout', '');
          while (block.firstChild) div.appendChild(block.firstChild);
          if (!div.textContent.trim()) div.innerHTML = '提示内容…';
          block.parentNode.replaceChild(div, block);
          const nr = document.createRange();
          nr.selectNodeContents(div); nr.collapse(false);
          sel.removeAllRanges(); sel.addRange(nr);
        }
        closeBlockMenu();
        autoDraft();
        positionBlockAdd();
      });
    });

    // 保存（提交到 GitHub 发布）
    document.getElementById('edSave').addEventListener('click', async () => {
      if (!isAdmin()) {
        alert('需要先登录作者账号才能发布。\n即将跳转到登录页。');
        location.hash = '#/admin';
        return;
      }
      const title = titleEl.value.trim();
      const content = getMarkdown().trim();
      if (!title) { titleEl.focus(); alert('请填写标题'); return; }
      if (!content) { edEl.focus(); alert('请填写正文内容'); return; }
      const category = document.getElementById('edCategory').value;
      const tagsRaw = document.getElementById('edTags').value;
      const tags = tagsRaw.split(/[,，、]/).map(t => t.trim()).filter(Boolean);
      const cover = document.getElementById('edCover').value;
      const article = {
        id: editing ? editing.id : genId(title),
        title: title,
        category: category,
        tags: tags.length ? tags : ['未分类'],
        date: editing ? editing.date : new Date().toISOString().slice(0, 10),
        excerpt: makeExcerpt(content),
        content: content,
        emoji: currentEmoji,
        cover: cover
      };
      const saveBtn = document.getElementById('edSave');
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ 发布中…';
      statusEl.textContent = '正在提交到 GitHub…';
      try {
        await publishPost(article);
        try { localStorage.removeItem(draftKey); } catch (e) {}
        statusEl.textContent = '✅ 已发布！正在刷新本地数据…';
        // 提交后从 GitHub 重新拉取，确保本地与线上一致
        await refreshArticlesFromGitHub();
        // 显示成功页面（不自动跳转，避免部署延迟导致文章找不到）
        showPublishSuccess(article);
      } catch (err) {
        const msg = String(err.message || '');
        statusEl.textContent = '❌ 发布失败：' + err.message;
        saveBtn.disabled = false;
        saveBtn.textContent = editing ? '保存修改' : '发布文章';
        if (msg.includes('401') || msg.includes('403') || msg.includes('Bad credentials')) {
          alert('发布失败：Token 已失效或无权限。\n请重新登录 #/admin 并输入有效 token。');
          adminLogout();
          location.hash = '#/admin';
        } else {
          alert('发布失败：' + err.message + '\n\n请检查：\n1. Token 是否有效且有 repo 权限\n2. 网络是否正常');
        }
      }
    });
  }

  // ====== 渲染：管理员登录/管理 ======
  function renderAdmin() {
    if (isAdmin()) {
      // 已登录：显示管理面板
      const s = SITE || {};
      app.innerHTML = `
        <div class="container">
          <div class="admin-page fade-in">
            <div class="admin-card">
              <div class="admin-icon">✅</div>
              <h2>已登录作者账号</h2>
              <p class="admin-user">GitHub: @${escapeHtml(getAdminUser())}</p>
              <p class="admin-tip">你现在可以新建、编辑、删除任意文章，发布后会自动提交到 GitHub 并重新部署。</p>
              <div class="admin-actions">
                <a href="#/write" class="ed-btn ed-btn-primary">✍️ 写新文章</a>
                <a href="#/about" class="ed-btn ed-btn-ghost">关于页</a>
                <a href="#/" class="ed-btn ed-btn-ghost">浏览文章</a>
                <button class="ed-btn ed-btn-ghost" id="logoutBtn">退出登录</button>
              </div>
              <div class="admin-warn">
                <strong>⚠️ 安全提示</strong>：Token 仅存在当前浏览器的 sessionStorage，关闭浏览器即清空。
                请勿在公共电脑上保持登录。用完建议主动退出。
              </div>
            </div>

            <div class="admin-card site-edit-card">
              <h2>✏️ 站点信息编辑</h2>
              <p class="admin-tip">修改后点"保存设置"会提交到 GitHub，约 1 分钟后关于页更新。</p>
              <form id="siteForm" class="site-form">
                <div class="sf-row">
                  <div class="sf-field">
                    <label>博客名</label>
                    <input type="text" id="sfName" value="${escapeHtml(s.name||'')}" />
                  </div>
                  <div class="sf-field sf-field-small">
                    <label>头像文字</label>
                    <input type="text" id="sfAvatarText" maxlength="2" value="${escapeHtml(s.avatarText||'')}" />
                  </div>
                </div>
                <div class="sf-row">
                  <div class="sf-field">
                    <label>作者</label>
                    <input type="text" id="sfAuthor" value="${escapeHtml(s.author||'')}" />
                  </div>
                  <div class="sf-field">
                    <label>角色</label>
                    <input type="text" id="sfRole" value="${escapeHtml(s.role||'')}" />
                  </div>
                </div>
                <div class="sf-field">
                  <label>个人简介</label>
                  <textarea id="sfBio" rows="3">${escapeHtml(s.bio||'')}</textarea>
                </div>
                <div class="sf-field">
                  <label>技能（逗号分隔）</label>
                  <input type="text" id="sfSkills" value="${escapeHtml((s.skills||[]).join(', '))}" />
                </div>
                <div class="sf-field">
                  <label>兴趣爱好（逗号分隔）</label>
                  <input type="text" id="sfInterests" value="${escapeHtml((s.interests||[]).join(', '))}" />
                </div>
                <div class="sf-field">
                  <label>联系方式</label>
                  <input type="text" id="sfContact" value="${escapeHtml(s.contact||'')}" />
                </div>
                <div class="admin-actions" style="margin-top: 18px;">
                  <button type="submit" class="ed-btn ed-btn-primary" id="siteSaveBtn">保存设置</button>
                  <a href="#/about" class="ed-btn ed-btn-ghost">预览关于页</a>
                </div>
                <div id="siteSaveStatus" class="save-status" style="margin-top:10px;"></div>
              </form>
            </div>
          </div>
        </div>`;
      document.getElementById('logoutBtn').addEventListener('click', () => {
        adminLogout();
        alert('已退出登录。');
        location.hash = '#/';
      });
      document.getElementById('siteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newSite = {
          name: document.getElementById('sfName').value.trim(),
          author: document.getElementById('sfAuthor').value.trim(),
          role: document.getElementById('sfRole').value.trim(),
          avatarText: document.getElementById('sfAvatarText').value.trim().slice(0, 2),
          bio: document.getElementById('sfBio').value.trim(),
          skills: document.getElementById('sfSkills').value.split(/[,，、]/).map(t => t.trim()).filter(Boolean),
          interests: document.getElementById('sfInterests').value.split(/[,，、]/).map(t => t.trim()).filter(Boolean),
          contact: document.getElementById('sfContact').value.trim()
        };
        const btn = document.getElementById('siteSaveBtn');
        const status = document.getElementById('siteSaveStatus');
        btn.disabled = true; btn.textContent = '⏳ 保存中…';
        status.textContent = '正在提交到 GitHub…';
        try {
          await publishSite(newSite);
          status.textContent = '✅ 已保存！约 1 分钟后关于页更新。';
          setTimeout(() => { location.hash = '#/about'; }, 800);
        } catch (err) {
          status.textContent = '❌ 保存失败：' + err.message;
          btn.disabled = false; btn.textContent = '保存设置';
          alert('保存失败：' + err.message);
        }
      });
      return;
    }

    // 未登录：登录表单
    app.innerHTML = `
      <div class="container">
        <div class="admin-page fade-in">
          <div class="admin-card">
            <div class="admin-icon">🔐</div>
            <h2>作者登录</h2>
            <p class="admin-tip">登录后可在线编辑、发布文章。仅博客作者需要登录，访客可直接浏览。</p>
            <form id="loginForm" class="login-form">
              <label>GitHub Personal Access Token</label>
              <input type="password" id="loginToken" placeholder="ghp_..." autocomplete="off" required />
              <button type="submit" class="ed-btn ed-btn-primary" id="loginBtn">验证并登录</button>
            </form>
            <details class="login-help">
              <summary>如何获取 Token？</summary>
              <ol>
                <li>打开 <a href="https://github.com/settings/tokens" target="_blank">github.com/settings/tokens</a></li>
                <li>Generate new token (classic)，勾选 <code>repo</code> 权限</li>
                <li>复制生成的 token 粘贴到上方</li>
              </ol>
              <p>Token 只存在你浏览器的 sessionStorage（关浏览器即清空），不会出现在公开代码里。</p>
            </details>
          </div>
        </div>
      </div>`;

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('loginToken').value.trim();
      if (!token) return;
      const btn = document.getElementById('loginBtn');
      btn.disabled = true;
      btn.textContent = '⏳ 验证中…';
      const user = await validateToken(token);
      if (user) {
        try {
          sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
          sessionStorage.setItem(ADMIN_USER_KEY, user);
        } catch (e) {}
        alert('✅ 登录成功！欢迎，' + user);
        location.hash = '#/';
      } else {
        btn.disabled = false;
        btn.textContent = '验证并登录';
        alert('❌ Token 无效，请检查 token 是否正确且有 repo 权限。');
      }
    });
  }

  // ====== 渲染：标签页 ======
  function renderTags() {
    const tags = getAllTags();
    const cloud = tags.map(([t, n]) => `
      <a href="#/tags/${encodeURIComponent(t)}">
        #${escapeHtml(t)}
        <span class="tag-count">${n}</span>
      </a>
    `).join('');

    app.innerHTML = `
      <div class="container">
        <div class="tags-page fade-in">
          <div class="section-head">
            <h2>标签分类</h2>
            <span class="count">${tags.length} 个标签</span>
          </div>
          <p style="color:var(--text-soft);margin-bottom:24px;">点击标签，查看相关文章。</p>
          <div class="tag-cloud">${cloud}</div>
        </div>
      </div>`;
  }

  // ====== 渲染：关于页 ======
  function renderAbout() {
    const adminBadge = isAdmin() ? `<div class="article-top-bar"><span></span><a href="#/admin" class="action-btn edit-btn">✏️ 编辑站点信息</a></div>` : '';
    app.innerHTML = `
      <div class="container">
        <div class="about-page fade-in">
          ${adminBadge}
          <div class="about-hero">
            <div class="about-avatar">${escapeHtml(SITE.avatarText)}</div>
            <div class="about-hero-text">
              <h1>${escapeHtml(SITE.author)}</h1>
              <div class="about-role">${escapeHtml(SITE.role)}</div>
              <p class="about-bio">${escapeHtml(SITE.bio)}</p>
            </div>
          </div>

          <div class="about-grid">
            <div class="about-card">
              <div class="ac-icon">💻</div>
              <h3>技术栈</h3>
              <ul>${SITE.skills.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
            </div>
            <div class="about-card">
              <div class="ac-icon">🌙</div>
              <h3>兴趣与爱好</h3>
              <ul>${SITE.interests.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
            </div>
            <div class="about-card">
              <div class="ac-icon">📚</div>
              <h3>关于这个博客</h3>
              <p>用纯 HTML / CSS / JavaScript 手写，零框架、零构建。Markdown 渲染由 marked.js 提供。代码开源，欢迎交流。</p>
            </div>
          </div>

          <div class="about-card" style="text-align:center;padding:40px;">
            <div class="ac-icon">✉️</div>
            <h3>保持联系</h3>
            <p style="margin-bottom:16px;">${escapeHtml(SITE.contact)}</p>
            <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
              <a href="#/" class="ac-tag" style="padding:8px 18px;">浏览文章</a>
              <a href="#/tags" class="ac-tag" style="padding:8px 18px;">按标签找</a>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ====== 路由 ======
  function router() {
    const hash = location.hash.slice(1) || '/';
    // 关闭移动端菜单
    mainNav.classList.remove('open');
    // 高亮导航
    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));

    if (hash === '/' || hash === '') {
      document.querySelector('.main-nav a[data-route="home"]').classList.add('active');
      renderHome();
    } else if (hash === '/tags') {
      document.querySelector('.main-nav a[data-route="tags"]').classList.add('active');
      renderTags();
    } else if (hash.startsWith('/tags/')) {
      document.querySelector('.main-nav a[data-route="tags"]').classList.add('active');
      renderHome(decodeURIComponent(hash.slice(6)));
    } else if (hash === '/about') {
      document.querySelector('.main-nav a[data-route="about"]').classList.add('active');
      renderAbout();
    } else if (hash === '/write') {
      document.querySelector('.main-nav a[data-route="write"]').classList.add('active');
      renderWrite();
    } else if (hash.startsWith('/edit/')) {
      document.querySelector('.main-nav a[data-route="write"]').classList.add('active');
      renderWrite(decodeURIComponent(hash.slice(6)));
    } else if (hash === '/admin') {
      renderAdmin();
    } else if (hash.startsWith('/post/')) {
      renderPost(decodeURIComponent(hash.slice(6)));
    } else {
      renderHome();
    }
    scrollToTop();
  }

  // ====== 交互 ======
  // 移动端菜单
  navToggle.addEventListener('click', () => mainNav.classList.toggle('open'));

  // 滚动效果
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 10);
    backToTop.classList.toggle('show', y > 400);
  }, { passive: true });

  // 回到顶部
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // 启动：先加载文章和站点数据，再启动路由
  async function init() {
    // 站点信息（仍用 js/site.json）
    let siteOk = false;
    try {
      const sr = await fetch('js/site.json', { cache: 'no-store' });
      if (sr.ok) { SITE = await sr.json(); siteOk = true; }
    } catch (e) {}
    if (!siteOk) {
      app.innerHTML = '<div class="container"><div class="empty-state"><div class="es-icon">⚠️</div><h3>站点信息加载失败</h3><p>请通过本地服务器（http://）访问，而非直接双击打开文件。</p></div></div>';
      return;
    }
    // 文章：从 posts/ 目录加载（带缓存兜底）
    try {
      ARTICLES = await loadPosts();
    } catch (e) {
      try {
        const c = JSON.parse(localStorage.getItem('blog-posts-cache') || 'null');
        if (c && c.articles && c.articles.length) {
          ARTICLES = c.articles;
        } else {
          throw e;
        }
      } catch (e2) {
        // 最后的兜底：本地的 js/posts.json（迁移备份），便于本地预览 / API 限流时仍可读
        try {
          const pr = await fetch('js/posts.json', { cache: 'no-store' });
          if (pr.ok) { ARTICLES = await pr.json(); }
          else throw e2;
        } catch (e3) {
          app.innerHTML = '<div class="container"><div class="empty-state"><div class="es-icon">📡</div><h3>文章加载失败</h3><p>' + String(e && e.message || '') + '</p><p style="margin-top:10px">请通过本地服务器（http://）访问，而非直接双击打开文件。</p></div></div>';
          return;
        }
      }
    }
    window.addEventListener('hashchange', router);
    router();
  }
  init();
})();
