/**
 * 博客渲染模块 (Renderer)
 * 包含：首页、文章页、标签页、关于页、管理页等 HTML 生成与 DOM 注入
 */

const Renderer = {
  // 获取视图偏好
  getView() {
    try { return localStorage.getItem('blog-view') || 'card'; }
    catch (e) { return 'card'; }
  },
  setView(v) {
    try { localStorage.setItem('blog-view', v); } catch (e) {}
  },

  // 获取所有排序后的文章
  getAllArticles() {
    return API.ARTICLES.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  // 获取文章对象（通过 ID）
  getArticle(id) {
    return API.ARTICLES.find(a => a.id === id);
  },

  // 获取所有标签及其数量
  getAllTags() {
    const map = {};
    this.getAllArticles().forEach(a => a.tags.forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  },

  // ====== 页面渲染入口 ======

  // 1. 渲染首页
  renderHome(tagFilter) {
    const app = document.getElementById('app');
    let posts = this.getAllArticles();
    let heroOrFilter = '';

    if (tagFilter) {
      posts = posts.filter(a => a.tags.includes(tagFilter));
      heroOrFilter = `
        <div class="tag-filter-head fade-in">
          <a href="#/tags" class="back-link">← 全部标签</a>
          <h2><span class="hash">#</span>${Utils.escapeHtml(tagFilter)}</h2>
          <p style="color:var(--text-mute);font-size:.92rem;margin-top:6px">共 ${posts.length} 篇文章</p>
        </div>`;
    } else {
      heroOrFilter = `
        <section class="hero fade-in">
          <h1>记录<span class="accent">代码</span>，也记录<span class="accent">生活</span></h1>
          <p>一个全栈开发者的个人博客。这里写技术探索，也写深夜思考。<br>相信好的程序和好的文字，都需要耐心打磨。</p>
          <div class="hero-tags">
            <span>📝 ${this.getAllArticles().length} 篇文章</span>
            <span>🏷️ ${this.getAllTags().length} 个标签</span>
            <span>✍️ 可在线写作</span>
          </div>
        </section>`;
    }

    const listHtml = posts.map(a => `
      <a class="post-card fade-in" href="#/post/${a.id}">
        <div class="pc-meta">
          <span class="pc-cat">${a.category}</span>
          <span class="dot"></span>
          <span>${Utils.shortDate(a.date)}</span>
          <span class="dot"></span>
          <span>${Utils.readingTime(a.content)} 分钟阅读</span>
        </div>
        <h3>${Utils.escapeHtml(a.title)}</h3>
        <p class="pc-excerpt">${Utils.escapeHtml(a.excerpt)}</p>
        <div class="pc-footer">
          <div class="pc-tags">${a.tags.map(t => `<span class="pc-tag">#${Utils.escapeHtml(t)}</span>`).join('')}</div>
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
          <span class="cover-read">${Utils.readingTime(a.content)} 分钟</span>
        </div>
        <div class="xhs-body">
          <h3>${Utils.escapeHtml(a.title)}</h3>
          <p class="xhs-excerpt">${Utils.escapeHtml(a.excerpt)}</p>
          <div class="xhs-footer">
            <div class="xhs-tags">${a.tags.slice(0, 2).map(t => `<span class="xhs-tag">#${Utils.escapeHtml(t)}</span>`).join('')}</div>
            <span class="xhs-date">${Utils.shortDate(a.date)}</span>
          </div>
        </div>
      </a>`;
    }).join('');

    const empty = posts.length === 0
      ? `<div class="empty-state"><div class="es-icon">📭</div><h3>还没有文章</h3><p>这个标签下暂无内容</p></div>`
      : '';

    const view = this.getView();
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
        if (v === this.getView()) return;
        this.setView(v);
        this.renderHome(tagFilter);
      });
    }
  },

  // 2. 渲染文章详情页
  async renderPost(id, CONFIG) {
    const app = document.getElementById('app');
    let a = this.getArticle(id);
    if (!a) {
      try {
        const post = await API.fetchPostFile(id, CONFIG);
        if (post) { a = post; if (!API.ARTICLES.find(x => x.id === id)) API.ARTICLES.unshift(post); }
      } catch (e) {}
    }
    if (!a) {
      app.innerHTML = `<div class="container"><div class="empty-state"><div class="es-icon">🔍</div><h3>文章不存在</h3><p>可能已被移除或链接有误</p><p style="margin-top:18px"><a href="#/">← 返回首页</a></p></div></div>`;
      return;
    }

    const html = marked.parse(Utils.resolveImgSrc(a.content, a.id, CONFIG));
    const related = this.getAllArticles().filter(x => x.id !== id && x.tags.some(t => a.tags.includes(t))).slice(0, 2);
    const admin = API.isAdmin();

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
              <span>${Utils.formatDate(a.date)}</span>
              <span>·</span>
              <span>${Utils.readingTime(a.content)} 分钟阅读</span>
            </div>
            <h1>${Utils.escapeHtml(a.title)}</h1>
            <div class="ac-tags">${a.tags.map(t => `<a href="#/tags/${encodeURIComponent(t)}" class="ac-tag">#${Utils.escapeHtml(t)}</a>`).join('')}</div>
          </header>
          <div class="markdown-body">${html}</div>
          <footer class="article-footer">
            <div class="af-tags">${a.tags.map(t => `<a href="#/tags/${encodeURIComponent(t)}" class="ac-tag">#${Utils.escapeHtml(t)}</a>`).join('')}</div>
            <span class="share-note">感谢阅读 · ${Utils.formatDate(a.date)}</span>
          </footer>
        </article>
        ${related.length ? this.renderRelated(related) : ''}
      </div>`;

    // 删除按钮逻辑
    const delBtn = document.getElementById('delBtn');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!API.isAdmin()) { alert('登录已过期'); location.hash = '#/admin'; return; }
        if (!confirm('确定删除这篇文章吗？')) return;
        delBtn.disabled = true; delBtn.textContent = '⏳ 删除中…';
        try {
          await API.deletePost(a.id, CONFIG);
          alert('✅ 文章已删除。');
          location.hash = '#/';
        } catch (err) {
          alert('删除失败: ' + err.message);
          delBtn.disabled = false; delBtn.textContent = '🗑 删除';
        }
      });
    }
  },

  renderRelated(related) {
    return `
      <section style="max-width:var(--maxw);margin:56px auto 0;">
        <div class="section-head"><h2>相关阅读</h2></div>
        <div class="post-list">
          ${related.map(a => `
            <a class="post-card fade-in" href="#/post/${a.id}">
              <div class="pc-meta">
                <span class="pc-cat">${a.category}</span>
                <span class="dot"></span>
                <span>${Utils.shortDate(a.date)}</span>
              </div>
              <h3>${Utils.escapeHtml(a.title)}</h3>
              <p class="pc-excerpt">${Utils.escapeHtml(a.excerpt)}</p>
            </a>
          `).join('')}
        </div>
      </section>`;
  },

  // 3. 渲染标签页
  renderTags() {
    const app = document.getElementById('app');
    const tags = this.getAllTags();
    const cloud = tags.map(([t, n]) => `
      <a href="#/tags/${encodeURIComponent(t)}">
        #${Utils.escapeHtml(t)}
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
  },

  // 4. 渲染关于页
  renderAbout() {
    const app = document.getElementById('app');
    const adminBadge = API.isAdmin() ? `<div class="article-top-bar"><span></span><a href="#/admin" class="action-btn edit-btn">✏️ 编辑站点信息</a></div>` : '';
    const SITE = API.SITE;
    app.innerHTML = `
      <div class="container">
        <div class="about-page fade-in">
          ${adminBadge}
          <div class="about-hero">
            <div class="about-avatar">${Utils.escapeHtml(SITE.avatarText)}</div>
            <div class="about-hero-text">
              <h1>${Utils.escapeHtml(SITE.author)}</h1>
              <div class="about-role">${Utils.escapeHtml(SITE.role)}</div>
              <p class="about-bio">${Utils.escapeHtml(SITE.bio)}</p>
            </div>
          </div>

          <div class="about-grid">
            <div class="about-card">
              <div class="ac-icon">💻</div>
              <h3>技术栈</h3>
              <ul>${(SITE.skills || []).map(s => `<li>${Utils.escapeHtml(s)}</li>`).join('')}</ul>
            </div>
            <div class="about-card">
              <div class="ac-icon">🌙</div>
              <h3>兴趣与爱好</h3>
              <ul>${(SITE.interests || []).map(s => `<li>${Utils.escapeHtml(s)}</li>`).join('')}</ul>
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
            <p style="margin-bottom:16px;">${Utils.escapeHtml(SITE.contact)}</p>
            <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
              <a href="#/" class="ac-tag" style="padding:8px 18px;">浏览文章</a>
              <a href="#/tags" class="ac-tag" style="padding:8px 18px;">按标签找</a>
            </div>
          </div>
        </div>
      </div>`;
  },

  // 5. 渲染管理员面板
  renderAdmin(CONFIG) {
    const app = document.getElementById('app');
    if (API.isAdmin()) {
      const s = API.SITE;
      app.innerHTML = `
        <div class="container">
          <div class="admin-page fade-in">
            <div class="admin-card">
              <div class="admin-icon">✅</div>
              <h2>已登录作者账号</h2>
              <p class="admin-user">GitHub: @${Utils.escapeHtml(API.getAdminUser())}</p>
              <div class="admin-actions">
                <a href="#/write" class="ed-btn ed-btn-primary">✍️ 写新文章</a>
                <button class="ed-btn ed-btn-ghost" id="logoutBtn">退出登录</button>
              </div>
            </div>

            <div class="admin-card site-edit-card">
              <h2>✏️ 站点信息编辑</h2>
              <form id="siteForm" class="site-form">
                <div class="sf-row">
                  <div class="sf-field">
                    <label>博客名</label>
                    <input type="text" id="sfName" value="${Utils.escapeHtml(s.name||'')}" />
                  </div>
                  <div class="sf-field sf-field-small">
                    <label>头像文字</label>
                    <input type="text" id="sfAvatarText" maxlength="2" value="${Utils.escapeHtml(s.avatarText||'')}" />
                  </div>
                </div>
                <div class="sf-row">
                  <div class="sf-field">
                    <label>作者</label>
                    <input type="text" id="sfAuthor" value="${Utils.escapeHtml(s.author||'')}" />
                  </div>
                  <div class="sf-field">
                    <label>角色</label>
                    <input type="text" id="sfRole" value="${Utils.escapeHtml(s.role||'')}" />
                  </div>
                </div>
                <div class="sf-field">
                  <label>个人简介</label>
                  <textarea id="sfBio" rows="3">${Utils.escapeHtml(s.bio||'')}</textarea>
                </div>
                <div class="sf-field">
                  <label>技能（逗号分隔）</label>
                  <input type="text" id="sfSkills" value="${Utils.escapeHtml((s.skills||[]).join(', '))}" />
                </div>
                <div class="sf-field">
                  <label>兴趣爱好（逗号分隔）</label>
                  <input type="text" id="sfInterests" value="${Utils.escapeHtml((s.interests||[]).join(', '))}" />
                </div>
                <div class="sf-field">
                  <label>联系方式</label>
                  <input type="text" id="sfContact" value="${Utils.escapeHtml(s.contact||'')}" />
                </div>
                <div class="admin-actions" style="margin-top: 18px;">
                  <button type="submit" class="ed-btn ed-btn-primary" id="siteSaveBtn">保存设置</button>
                </div>
                <div id="siteSaveStatus" class="save-status"></div>
              </form>
            </div>
          </div>
        </div>`;
      
      document.getElementById('logoutBtn').addEventListener('click', () => {
        API.adminLogout();
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
        btn.disabled = true; btn.textContent = '⏳ 保存中…';
        try {
          await API.publishSite(newSite, CONFIG);
          alert('✅ 保存成功！');
          location.hash = '#/about';
        } catch (err) {
          alert('保存失败: ' + err.message);
          btn.disabled = false; btn.textContent = '保存设置';
        }
      });
      return;
    }

    // 登录表单
    app.innerHTML = `
      <div class="container">
        <div class="admin-page fade-in">
          <div class="admin-card">
            <div class="admin-icon">🔐</div>
            <h2>作者登录</h2>
            <form id="loginForm" class="login-form">
              <label>GitHub Personal Access Token</label>
              <input type="password" id="loginToken" placeholder="ghp_..." required />
              <button type="submit" class="ed-btn ed-btn-primary" id="loginBtn">验证并登录</button>
            </form>
          </div>
        </div>
      </div>`;

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('loginToken').value.trim();
      if (!token) return;
      const btn = document.getElementById('loginBtn');
      btn.disabled = true; btn.textContent = '⏳ 验证中…';
      const user = await API.validateToken(token);
      if (user) {
        sessionStorage.setItem(API.ADMIN_TOKEN_KEY, token);
        sessionStorage.setItem(API.ADMIN_USER_KEY, user);
        location.hash = '#/';
      } else {
        alert('❌ Token 无效');
        btn.disabled = false; btn.textContent = '验证并登录';
      }
    });
  },

  // 6. 发布成功页
  showPublishSuccess(article) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="container">
        <div class="publish-success fade-in">
          <div class="ps-icon">✅</div>
          <h2>发布成功！</h2>
          <p>《${Utils.escapeHtml(article.title)}》已提交到 GitHub。</p>
          <div class="ps-actions">
            <a href="#/post/${encodeURIComponent(article.id)}" class="ed-btn ed-btn-primary">查看文章</a>
            <a href="#/" class="ed-btn ed-btn-ghost">返回首页</a>
          </div>
        </div>
      </div>`;
  }
};
