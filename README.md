# 独白 · 个人博客

一个关于**技术**与**生活随笔**的个人博客。纯静态实现，零框架、零构建，打开即用、push 即上线。

## ✨ 功能

- **文章列表**：小红书卡片视图 + 列表视图，一键切换，记忆偏好
- **文章详情**：Markdown 渲染、代码高亮块、相关文章推荐
- **标签分类**：标签云 + 点击筛选
- **在线写作**：网页内置 Markdown 编辑器，实时预览，工具栏，草稿自动保存
- **关于页面**：个人介绍
- **响应式**：移动端适配

## 🛠️ 技术栈

| 部分 | 方案 |
| --- | --- |
| 页面 | 纯 HTML / CSS / JavaScript |
| Markdown 渲染 | [marked.js](https://marked.js.org/)（本地离线） |
| 路由 | hash 路由（无框架） |
| 文章存储 | `posts/<id>.md`（Markdown + front matter，一篇一文件） |
| 文章清单 | 构建期生成 `posts/index.json`，首屏 1 次请求拿全部文章 |
| 后台 | GitHub 即后端：内容 API 读写 md，jsDelivr / Pages 托管配图 |
| 部署 | GitHub Actions → GitHub Pages |
| 字体 | Noto Serif SC + Inter + JetBrains Mono |

## 📁 目录结构

```
blog/
├── index.html            # 入口
├── css/style.css         # 全部样式
├── js/
│   ├── articles.js       # GitHub 仓库配置 + 封面配色板
│   ├── app.js            # 路由、渲染、编辑器、存储逻辑
│   ├── site.json         # 站点信息（可在 /#/admin 在线编辑）
│   └── lib/marked.min.js # Markdown 解析（离线）
├── posts/                # 文章：每篇一个 <id>.md，配图放 <id>-assets/
├── scripts/
│   └── build-meta.mjs    # 构建期脚本：index.json / sitemap / rss / 404（零依赖）
├── .github/workflows/deploy.yml  # GitHub Pages 自动部署
└── push.ps1 / start-blog.bat     # 一键推送 / 本地预览
```

## 🚀 本地运行

### 方式一：本地服务器（推荐，和线上行为一致）
```bash
python -m http.server 8765
```
访问 http://localhost:8765

### 方式二：直接双击
打开 `index.html` 也能跑，但 `fetch` 会被浏览器的 file:// 限制拦住，会提示「请通过本地服务器访问」。

> 本地没跑过构建脚本时，文章会回退到逐个请求 GitHub API 加载（能用，但受 60 次/小时限流）。
> 想和线上完全一致，先执行一次：
> ```bash
> node scripts/build-meta.mjs --out . --url http://localhost:8765/
> ```

## ✍️ 写文章

1. 点击导航栏「✍️ 写作」
2. 填写标题、分类、标签，选择封面图标和配色
3. 在编辑区用 Markdown 写作，右侧实时预览
4. 点「发布文章」（提交到 GitHub，写入 `posts/<id>.md`）

你写的文章会出现在列表里，可随时编辑/删除。发布后作者本机会立刻看到（会话内合并），访客约 1 分钟后随 Pages 重新部署生效。

## 📤 手动新增文章

在 `posts/` 下新建一个 `<id>.md`（Markdown + front matter）：

```markdown
---
id: my-post
title: 文章标题
emoji: 📝
date: 2026-07-21
category: 技术
type: dev            # dev = 开发频道，daily = 日常频道
tags: [标签1, 标签2]
cover: ocean         # ocean/aurora/forest/galaxy/sunset/berry/night/tech/nature/cosmic
cover_image:         # 可选，留空则用正文第一张图或渐变色块
excerpt: 摘要        # 可选，留空则自动取正文前 80 字
---

## 这里是 Markdown 正文
```

配图放在 `posts/<id>-assets/`，正文里写 `![](./posts/<id>-assets/xxx.jpg)`。

## ☁️ 部署到 GitHub Pages

1. 在 GitHub 新建空仓库（不要勾选 Initialize with README）
2. push 代码到 main 分支
3. 进入仓库 **Settings → Pages → Source** 选 **GitHub Actions**
4. 每次 push 到 `main` 自动部署，Actions 标签页可查看状态

部署流程（`deploy.yml`）：

1. 把 `index.html css js posts` 拷进 `_site`
2. 跑 `scripts/build-meta.mjs`，生成 `posts/index.json`、`sitemap.xml`、`rss.xml`、`robots.txt`、`404.html`
3. 上传产物并发布到 Pages

访问地址：`https://<你的用户名>.github.io/<仓库名>/`

> `posts/` 会随站点一起发布，所以文章配图走同源相对路径，不依赖第三方 CDN；
> 只有图片尚未同步到 Pages 时（刚上传、部署未完成），前端才会自动回退到 jsDelivr。
> 文章正文不进 Pages，由浏览器运行时读取，发文只需 push 一个 md。

> push 密码用 Personal Access Token（Settings → Developer settings → Tokens），勾选 `repo` 权限。
> 浏览器「作者登录」用的 token 建议单独开一个只授权本仓库的 fine-grained token。

## 📄 许可

MIT
