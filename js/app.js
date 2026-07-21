/* ====== 博客应用：路由与渲染 ====== */
(function () {
  "use strict";

  const app = document.getElementById('app');
  const header = document.getElementById('siteHeader');
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  const backToTop = document.getElementById('backToTop');

  // 配置 marked
  if (window.marked) {
    marked.setOptions({ breaks: true, gfm: true });
  }

  // 文章数据（运行时从 data/articles.json 加载）
  let ARTICLES = [];

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
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
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

  async function githubGetFile() {
    const token = getAdminToken();
    const url = 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' + CONFIG.dataPath + '?ref=' + CONFIG.branch;
    const r = await fetch(url, {
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' }
    });
    if (!r.ok) throw new Error('获取文件失败: ' + r.status);
    return r.json();
  }

  async function githubCommitFile(content, sha, message) {
    const token = getAdminToken();
    const url = 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' + CONFIG.dataPath;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message, content: b64encode(content), sha: sha, branch: CONFIG.branch })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error('提交失败: ' + r.status + ' ' + (e.message || ''));
    }
    return r.json();
  }

  // 发布文章（新增或更新）—— 提交到 GitHub
  async function publishArticle(article) {
    const file = await githubGetFile();
    let list = ARTICLES.slice();
    const idx = list.findIndex(a => a.id === article.id);
    const isUpdate = idx >= 0;
    if (isUpdate) list[idx] = article; else list.unshift(article);
    await githubCommitFile(JSON.stringify(list, null, 2), file.sha, (isUpdate ? '更新文章: ' : '发布新文章: ') + article.title);
    if (isUpdate) ARTICLES[idx] = article; else ARTICLES.unshift(article);
  }

  // 删除文章 —— 提交到 GitHub
  async function deleteArticlePub(id) {
    const file = await githubGetFile();
    const target = ARTICLES.find(a => a.id === id);
    const list = ARTICLES.filter(a => a.id !== id);
    await githubCommitFile(JSON.stringify(list, null, 2), file.sha, '删除文章: ' + (target ? target.title : id));
    ARTICLES = list;
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
  function renderPost(id) {
    const a = getArticle(id);
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
        if (!confirm('确定删除这篇文章吗？\n这将提交到 GitHub 并重新部署，所有访客都会看到删除结果。')) return;
        delBtn.disabled = true;
        delBtn.textContent = '⏳ 删除中…';
        try {
          await deleteArticlePub(a.id);
          alert('✅ 已删除，约 1 分钟后线上更新。');
          location.hash = '#/';
        } catch (err) {
          alert('删除失败：' + err.message);
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
              <button type="button" data-md="h1" title="一级标题">H1</button>
              <button type="button" data-md="h2" title="二级标题">H2</button>
              <button type="button" data-md="h3" title="三级标题">H3</button>
              <span class="tb-sep"></span>
              <button type="button" data-md="bold" title="粗体"><b>B</b></button>
              <button type="button" data-md="italic" title="斜体"><i>I</i></button>
              <button type="button" data-md="code" title="行内代码">&lt;/&gt;</button>
              <button type="button" data-md="codeblock" title="代码块">{ }</button>
              <span class="tb-sep"></span>
              <button type="button" data-md="quote" title="引用">❝</button>
              <button type="button" data-md="ul" title="无序列表">• 列表</button>
              <button type="button" data-md="ol" title="有序列表">1. 列表</button>
              <button type="button" data-md="link" title="链接">🔗</button>
              <button type="button" data-md="hr" title="分隔线">――</button>
            </div>

            <div class="ed-split">
              <div class="ed-editor-pane">
                <textarea id="edContent" class="ed-textarea" placeholder="在这里用 Markdown 写作……&#10;&#10;## 开始你的故事&#10;&#10;支持 **粗体**、*斜体*、\`代码\`、引用、列表等。">${escapeHtml(a.content)}</textarea>
              </div>
              <div class="ed-preview-pane">
                <div class="ed-preview-label">预览</div>
                <div class="markdown-body" id="edPreview"></div>
              </div>
            </div>

            <div class="ed-actions">
              <a href="#/" class="ed-btn ed-btn-ghost">取消</a>
              <button type="button" class="ed-btn ed-btn-primary" id="edSave">${editing ? '保存修改' : '发布文章'}</button>
            </div>
          </div>
        </div>
      </div>`;

    // ====== 编辑器交互 ======
    const ta = document.getElementById('edContent');
    const preview = document.getElementById('edPreview');
    const titleEl = document.getElementById('edTitle');
    const statusEl = document.getElementById('saveStatus');
    let currentEmoji = a.emoji;

    // 实时预览
    function updatePreview() {
      preview.innerHTML = marked.parse(ta.value || '*预览区会实时显示你的 Markdown 内容*');
    }
    updatePreview();

    // 草稿自动保存（仅新建时）
    const draftKey = 'blog-draft';
    if (!editing) {
      try {
        const draft = localStorage.getItem(draftKey);
        if (draft && !a.content) {
          const d = JSON.parse(draft);
          if (d.content) { ta.value = d.content; titleEl.value = d.title || ''; updatePreview(); }
        }
      } catch (e) {}
    }

    let draftTimer;
    function autoDraft() {
      if (editing) return;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        try { localStorage.setItem(draftKey, JSON.stringify({ title: titleEl.value, content: ta.value })); } catch (e) {}
      }, 800);
    }

    ta.addEventListener('input', () => { updatePreview(); autoDraft(); });

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

    // 封面实时预览（更新 emoji pick 高亮）
    // 工具栏：插入 Markdown
    function wrapSelection(before, after, placeholder) {
      const start = ta.selectionStart, end = ta.selectionEnd;
      const sel = ta.value.slice(start, end) || placeholder || '';
      const newText = before + sel + (after || '');
      ta.value = ta.value.slice(0, start) + newText + ta.value.slice(end);
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + sel.length);
      updatePreview(); autoDraft();
    }
    function prefixLines(prefix) {
      const start = ta.selectionStart, end = ta.selectionEnd;
      const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
      const block = ta.value.slice(lineStart, end);
      const newBlock = block.split('\n').map((l, i) => prefix.replace('N', i + 1) + l).join('\n');
      ta.value = ta.value.slice(0, lineStart) + newBlock + ta.value.slice(end);
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + newBlock.length);
      updatePreview(); autoDraft();
    }

    const toolbar = document.getElementById('edToolbar');
    toolbar.addEventListener('click', e => {
      const btn = e.target.closest('button[data-md]');
      if (!btn) return;
      const type = btn.dataset.md;
      switch (type) {
        case 'h1': prefixLines('# '); break;
        case 'h2': prefixLines('## '); break;
        case 'h3': prefixLines('### '); break;
        case 'bold': wrapSelection('**', '**', '粗体文字'); break;
        case 'italic': wrapSelection('*', '*', '斜体文字'); break;
        case 'code': wrapSelection('`', '`', 'code'); break;
        case 'codeblock': wrapSelection('\n```\n', '\n```\n', '代码'); break;
        case 'quote': prefixLines('> '); break;
        case 'ul': prefixLines('- '); break;
        case 'ol': prefixLines('N. '); break;
        case 'link': wrapSelection('[', '](https://)', '链接文字'); break;
        case 'hr': wrapSelection('\n---\n', '', ''); break;
      }
    });

    // 保存（提交到 GitHub 发布）
    document.getElementById('edSave').addEventListener('click', async () => {
      if (!isAdmin()) {
        alert('需要先登录作者账号才能发布。\n即将跳转到登录页。');
        location.hash = '#/admin';
        return;
      }
      const title = titleEl.value.trim();
      const content = ta.value.trim();
      if (!title) { titleEl.focus(); alert('请填写标题'); return; }
      if (!content) { ta.focus(); alert('请填写正文内容'); return; }
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
        await publishArticle(article);
        try { localStorage.removeItem(draftKey); } catch (e) {}
        statusEl.textContent = '✅ 已发布！约 1 分钟后线上更新。';
        setTimeout(() => { location.hash = '#/post/' + article.id; }, 800);
      } catch (err) {
        statusEl.textContent = '❌ 发布失败：' + err.message;
        saveBtn.disabled = false;
        saveBtn.textContent = editing ? '保存修改' : '发布文章';
        alert('发布失败：' + err.message + '\n\n请检查：\n1. Token 是否有效且有 repo 权限\n2. 网络是否正常');
      }
    });
  }

  // ====== 渲染：管理员登录/管理 ======
  function renderAdmin() {
    if (isAdmin()) {
      // 已登录：显示管理面板
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
                <a href="#/" class="ed-btn ed-btn-ghost">浏览文章</a>
                <button class="ed-btn ed-btn-ghost" id="logoutBtn">退出登录</button>
              </div>
              <div class="admin-warn">
                <strong>⚠️ 安全提示</strong>：Token 仅存在当前浏览器的 sessionStorage，关闭浏览器即清空。
                请勿在公共电脑上保持登录。用完建议主动退出。
              </div>
            </div>
          </div>
        </div>`;
      document.getElementById('logoutBtn').addEventListener('click', () => {
        adminLogout();
        alert('已退出登录。');
        location.hash = '#/';
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
    app.innerHTML = `
      <div class="container">
        <div class="about-page fade-in">
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
      renderWrite(hash.slice(6));
    } else if (hash === '/admin') {
      renderAdmin();
    } else if (hash.startsWith('/post/')) {
      renderPost(hash.slice(6));
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

  // 启动：先加载文章数据，再启动路由
  async function init() {
    try {
      const r = await fetch('js/posts.json', { cache: 'no-store' });
      if (r.ok) { ARTICLES = await r.json(); }
      else { app.innerHTML = '<div class="container"><div class="empty-state"><div class="es-icon">⚠️</div><h3>文章加载失败</h3><p>HTTP ' + r.status + '</p></div></div>'; return; }
    } catch (e) {
      app.innerHTML = '<div class="container"><div class="empty-state"><div class="es-icon">📡</div><h3>无法加载文章数据</h3><p>请通过本地服务器（http://）访问，而非直接双击打开文件。</p></div></div>';
      return;
    }
    window.addEventListener('hashchange', router);
    router();
  }
  init();
})();
