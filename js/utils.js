/**
 * 博客工具函数模块 (Utils)
 * 包含：日期处理、文本处理、内容转换等纯函数
 */

const Utils = {
  // 中文按字数，英文按词，粗略估算阅读时间
  readingTime(markdown) {
    if (!markdown) return 0;
    const text = markdown.replace(/[#*`>\-\[\]\(\)!]/g, '');
    const chars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const words = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\S+/g) || []).length;
    const minutes = Math.ceil((chars / 400) + (words / 200));
    return Math.max(1, minutes);
  },

  // 格式化日期：2026 年 七月 26 日
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    return `${d.getFullYear()} 年 ${months[d.getMonth()]} ${d.getDate()} 日`;
  },

  // 短日期：2026-07-26
  shortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  // HTML 转义
  escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  },

  // Base64 编码（支持中文，用于 GitHub API）
  b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  },

  // 生成文章 ID
  genId(title) {
    const base = (title || 'post').toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'post';
    return base + '-' + Date.now().toString(36);
  },

  // 从 Markdown 生成摘要
  makeExcerpt(markdown) {
    if (!markdown) return '';
    const text = markdown.replace(/[#*`>\[\]\(\)!_-]/g, '').replace(/\n+/g, ' ').trim();
    return text.slice(0, 80) + (text.length > 80 ? '…' : '');
  },

  // 滚动到顶部
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  },

  // 解析 Markdown Frontmatter
  parseFrontmatter(md) {
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
  },

  // 构建 Markdown 内容（带 Frontmatter）
  buildMarkdown(post) {
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
  },

  // 统一转换图片路径为 jsDelivr CDN 直链
  resolveImgSrc(md, id, CONFIG) {
    if (!md || !id || !CONFIG) return md;
    const RAW_BASE = 'https://cdn.jsdelivr.net/gh/' + CONFIG.owner + '/' + CONFIG.repo + '@' + CONFIG.branch + '/';
    const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const toRaw = (m, alt, prefix, name) => {
      const raw = RAW_BASE + CONFIG.postsDir + '/' + encodeURIComponent(id) + '-assets/' + name;
      return '![' + alt + '](' + raw + ')';
    };
    const re1 = new RegExp('!\\[([^\\]]*)\\]\\((\\.?/?)' + safeId + '-assets/([^)]+)\\)', 'g');
    const re2 = new RegExp('!\\[([^\\]]*)\\]\\((\\.?/?)' + CONFIG.postsDir + '/' + safeId + '-assets/([^)]+)\\)', 'g');
    md = md.replace(re1, toRaw);
    md = md.replace(re2, toRaw);
    return md;
  },

  // 将 CDN 直链转回相对路径
  rawToRel(src, id, CONFIG) {
    if (!CONFIG) return src;
    const RAW_BASE = 'https://cdn.jsdelivr.net/gh/' + CONFIG.owner + '/' + CONFIG.repo + '@' + CONFIG.branch + '/';
    if (!src || !id || src.indexOf(RAW_BASE) !== 0) return src;
    let rel = src.slice(RAW_BASE.length);
    try { rel = decodeURIComponent(rel); } catch (e) {}
    return './' + rel;
  },

  // HTML 转 Markdown（用于编辑器保存）
  htmlToMarkdown(html, articleId, CONFIG) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const self = this;
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
        case 'img': {
          const src = node.getAttribute('src') || '';
          const rel = node.getAttribute('data-rel') || self.rawToRel(src, articleId, CONFIG);
          if (!rel || node.getAttribute('data-uploading')) return '';
          const alt = node.getAttribute('alt') || '';
          return '![' + alt + '](' + rel + ')\n\n';
        }
        case 'p': case 'div':
          if (tag === 'div' && node.classList && node.classList.contains('callout')) {
            return '\n<div class="callout">' + node.innerHTML.trim() + '</div>\n\n';
          }
          return inner + '\n\n';
        default: return inner;
      }
    }
    return walk(doc.body).replace(/\n{3,}/g, '\n\n').trim();
  }
};
