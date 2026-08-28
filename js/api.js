/**
 * 博客数据与 API 模块 (API)
 * 包含：全局状态、权限检查、GitHub 文件操作、文章加载与发布
 */

const API = {
  ARTICLES: [],
  SITE: {},
  ADMIN_TOKEN_KEY: 'blog-admin-token',
  ADMIN_USER_KEY: 'blog-admin-user',

  // ====== 权限管理 ======
  isAdmin() {
    try { return !!sessionStorage.getItem(this.ADMIN_TOKEN_KEY); } catch (e) { return false; }
  },
  getAdminToken() {
    try { return sessionStorage.getItem(this.ADMIN_TOKEN_KEY) || ''; } catch (e) { return ''; }
  },
  getAdminUser() {
    try { return sessionStorage.getItem(this.ADMIN_USER_KEY) || ''; } catch (e) { return ''; }
  },
  adminLogout() {
    try {
      sessionStorage.removeItem(this.ADMIN_TOKEN_KEY);
      sessionStorage.removeItem(this.ADMIN_USER_KEY);
    } catch (e) {}
  },
  async validateToken(token) {
    try {
      const r = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' }
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d.login;
    } catch (e) { return null; }
  },

  // ====== GitHub 文件操作基础 ======
  async githubGetFile(path, CONFIG) {
    const token = this.getAdminToken();
    const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}`;
    const r = await fetch(url, {
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' }
    });
    if (!r.ok) throw new Error('获取文件失败: ' + r.status);
    return r.json();
  },

  async githubCommitFile(content, sha, path, message, CONFIG) {
    const token = this.getAdminToken();
    const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        content: Utils.b64encode(content),
        sha: sha,
        branch: CONFIG.branch
      })
    });
    if (!r.ok) {
      let detail = '';
      try { const e = await r.json(); detail = e.message || (e.errors && e.errors[0] && e.errors[0].message) || ''; } catch (e) {}
      throw new Error('HTTP ' + r.status + (detail ? ' - ' + detail : ''));
    }
    return r.json();
  },

  async githubListDir(path, CONFIG) {
    const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  },

  async githubDeleteFile(path, sha, message, CONFIG) {
    const token = this.getAdminToken();
    const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
    const r = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: message, sha: sha, branch: CONFIG.branch })
    });
    if (!r.ok) {
      let detail = '';
      try { const e = await r.json(); detail = e.message || (e.errors && e.errors[0] && e.errors[0].message) || ''; } catch (e) {}
      throw new Error('HTTP ' + r.status + (detail ? ' - ' + detail : ''));
    }
    return r.json();
  },

  async githubUploadBinary(base64Content, path, message, CONFIG) {
    const token = this.getAdminToken();
    const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': 'token ' + token,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: message, content: base64Content, branch: CONFIG.branch })
        });
        if (r.ok) return r.json();
        if (r.status >= 400 && r.status < 500) {
          let detail = '';
          try { const e = await r.json(); detail = e.message || (e.errors && e.errors[0] && e.errors[0].message) || ''; } catch (e) {}
          throw new Error('HTTP ' + r.status + (detail ? ' - ' + detail : ''));
        }
        lastErr = new Error('HTTP ' + r.status + '（服务器临时错误，重试中…）');
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('图片上传失败');
  },

  // ====== 业务数据处理 ======
  postPath(id, CONFIG) {
    return CONFIG.postsDir + '/' + encodeURIComponent(id) + '.md';
  },
  assetDir(id, CONFIG) {
    return CONFIG.postsDir + '/' + encodeURIComponent(id) + '-assets';
  },

  async loadPosts(CONFIG) {
    const entries = await this.githubListDir(CONFIG.postsDir, CONFIG);
    const mdFiles = entries.filter(e => e.type === 'file' && e.name.endsWith('.md'));
    const articles = [];
    for (const f of mdFiles) {
      try {
        const raw = await fetch(f.download_url, { cache: 'no-store' });
        if (!raw.ok) continue;
        const text = await raw.text();
        const { meta, body } = Utils.parseFrontmatter(text);
        if (!meta.id) meta.id = decodeURIComponent(f.name.replace(/\.md$/, ''));
        
        // 兼容性映射：将解析后的 meta 和 body 转为文章对象
        const post = {
          id: meta.id || '',
          title: meta.title || meta.id,
          emoji: meta.emoji || '📝',
          date: meta.date || '',
          category: meta.category || '未分类',
          tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : ['未分类']),
          cover: meta.cover || 'ocean',
          excerpt: meta.excerpt || Utils.makeExcerpt(body),
          content: body
        };
        if (post.id) articles.push(post);
      } catch (e) {}
    }
    articles.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    this.ARTICLES = articles;
    try { localStorage.setItem('blog-posts-cache', JSON.stringify({ ts: Date.now(), articles })); } catch (e) {}
    return articles;
  },

  async fetchPostFile(id, CONFIG) {
    const path = this.postPath(id, CONFIG);
    const url = `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${path}`;
    const r = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    const text = await r.text();
    const { meta, body } = Utils.parseFrontmatter(text);
    const post = {
      id: meta.id || id,
      title: meta.title || id,
      emoji: meta.emoji || '📝',
      date: meta.date || '',
      category: meta.category || '未分类',
      tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : ['未分类']),
      cover: meta.cover || 'ocean',
      excerpt: meta.excerpt || Utils.makeExcerpt(body),
      content: body
    };
    return post;
  },

  async publishPost(article, CONFIG) {
    const path = this.postPath(article.id, CONFIG);
    const content = Utils.buildMarkdown(article);
    let sha = null;
    try { const f = await this.githubGetFile(path, CONFIG); sha = f.sha; } catch (e) { sha = null; }
    await this.githubCommitFile(content, sha, path, (sha ? '更新文章: ' : '发布新文章: ') + article.title, CONFIG);
    
    const idx = this.ARTICLES.findIndex(a => a.id === article.id);
    if (idx >= 0) this.ARTICLES[idx] = article; else this.ARTICLES.unshift(article);
  },

  async deletePost(id, CONFIG) {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        try {
          const assets = await this.githubListDir(this.assetDir(id, CONFIG), CONFIG);
          for (const f of assets.filter(x => x.type === 'file')) {
            try { await this.githubDeleteFile(this.assetDir(id, CONFIG) + '/' + f.name, f.sha, '删除图片: ' + f.name, CONFIG); } catch (e) {}
          }
        } catch (e) {}
        const file = await this.githubGetFile(this.postPath(id, CONFIG), CONFIG);
        await this.githubDeleteFile(this.postPath(id, CONFIG), file.sha, '删除文章: ' + id, CONFIG);
        this.ARTICLES = this.ARTICLES.filter(a => a.id !== id);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt === 0 && String(err.message).includes('409')) continue;
        throw err;
      }
    }
    throw lastErr;
  },

  async publishSite(newSite, CONFIG) {
    const file = await this.githubGetFile(CONFIG.sitePath, CONFIG);
    await this.githubCommitFile(JSON.stringify(newSite, null, 2), file.sha, CONFIG.sitePath, '更新站点信息', CONFIG);
    this.SITE = newSite;
  }
};
