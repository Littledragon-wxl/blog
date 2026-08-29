# 独白 · 技术设计文档

> 版本：20260829g ｜ 更新日期：2026-08-29 ｜ 状态：基础设计已完成，进入迭代期

「独白」是一个关于技术与生活随笔的个人博客。核心设计目标是：**零框架、零构建、GitHub 即后端**——仓库既是代码库也是数据库，push 即上线，打开即能用。

---

## 1. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                     浏览器（全部逻辑）                     │
│                                                         │
│  index.html ──► js/app.js（IIFE 自包含：路由/渲染/存储）   │
│                  ├─ marked.min.js（本地离线 MD 渲染）      │
│                  └─ localStorage / sessionStorage        │
└───────┬──────────────────────────────┬──────────────────┘
        │ 读（匿名，无需鉴权）           │ 写（PAT 鉴权）
        ▼                              ▼
  GitHub raw / jsDelivr         GitHub Contents API
  （posts/*.md、js/site.json）   （发布/删除/更新文件）
        │
        ▼
   GitHub Actions → GitHub Pages（push main 自动部署）
```

设计要点：

- **没有服务器**：读走 raw.githubusercontent.com / jsDelivr CDN，写走 GitHub Contents API，全部在浏览器端完成。
- **没有构建步骤**：`index.html` 直接引用源码文件，改完推送即生效。
- **单文件应用逻辑**：所有 JS 逻辑集中在 `js/app.js`（IIFE），有意不做模块拆分——项目规模（约 2000 行）下，单文件的可搜索性优于模块间跳转。

## 2. 目录结构

```
blog/
├── index.html              # 入口 + 导航骨架 + OG 分享标签
├── css/style.css           # 全部样式（约 3000 行，按版本块追加）
├── js/
│   ├── app.js              # 应用主体：路由、渲染、编辑器、GitHub 读写
│   ├── articles.js         # 仅存 CONFIG（仓库配置）+ COVERS（配色板）
│   ├── site.json           # 站点信息（运行时 fetch，管理页可在线改）
│   ├── posts.json          # 旧版文章数据，仅作加载兜底（只读）
│   └── lib/marked.min.js   # Markdown 解析（离线）
├── posts/
│   ├── <id>.md             # 每篇文章一个文件（front matter + Markdown）
│   └── <id>-assets/        # 该文章的配图目录
├── docs/DESIGN.md          # 本文档
├── push.ps1                # 版本号自增 + 提交推送 一条龙
├── start-blog.bat          # 本地预览服务器（开机自启用）
└── .github/workflows/deploy.yml  # GitHub Pages 自动部署
```

## 3. 数据模型

### 文章：`posts/<id>.md`（front matter + 正文）

```markdown
---
id: post-mt4kgihj
title: 广州太古里白鹅潭街拍
emoji: 📷
cover: ocean            # 无封面图时的渐变色 key
cover_image: ./posts/post-mt4kgihj-assets/cover.jpg
category: 生活随笔       # 技术 → dev 频道；其他 → daily 频道
tags: [摄影, 街拍]
date: 2026-08-22
excerpt: 摘要……
---
## Markdown 正文
```

关键取舍：**一篇文章一个文件**。发布/删除只触碰单个文件，多端同时写作不会像共享索引文件那样互相覆盖（早期版本把所有文章存一个 `posts.json`，存在并发覆盖问题，已迁移）。正文配图存 `posts/<id>-assets/`，删除文章时顺带清理，不留孤儿图片。

- 正文里的相对路径 `./<id>-assets/xx.jpg` 在渲染前被 `resolveImgSrc()` 改写为 jsDelivr 直链——发布后立即可见，不用等 Pages 部署。
- 存储仍用仓库相对路径，站点自包含，不依赖第三方图床。

### 站点信息：`js/site.json`

头像、简介、联系方式等。管理页在线编辑后经 Contents API 提交。

## 4. 核心机制

### 4.1 路由（hash 路由）

`#/daily`、`#/dev`、`#/post/<id>`、`#/tags`、`#/write`、`#/edit/<id>`、`#/admin`、`#/about`。监听 `hashchange`，一个 `router()` 函数分发到各 render 函数。放弃 path 路由换来 GitHub Pages 无需 404 兜底配置——已知代价是 SEO 弱，对个人博客可接受。

### 4.2 数据加载：缓存优先（stale-while-revalidate）

```
init()
 ├─ fetch js/site.json ──失败──► 错误提示页（要求 http:// 访问）
 └─ 读 localStorage『blog-posts-cache』
     ├─ 有缓存 ──► 立即渲染（0 网络等待）──► 后台静默 loadPosts()
     │              数据有变化且不在编辑页 ──► 重渲染当前路由
     └─ 无缓存 ──► 骨架屏占位 ──► loadPosts()（GitHub API 列目录+逐篇拉取）
                    失败 ──► localStorage 缓存 ──► js/posts.json 兜底 ──► 错误页
```

- 每次成功 `loadPosts()` 都会刷新 localStorage 缓存；删除文章会同步清缓存，防止「删了又复活」。
- 编辑页（`#/write`、`#/edit`）不触发后台重渲染，避免打断写作。

### 4.3 发布链路（GitHub Contents API）

发布 = `PUT /repos/:owner/:repo/contents/posts/<id>.md`（带 sha 即更新，无 sha 即新建），提交信息自动生成。删除同理（先清 `-assets/` 配图再删正文，409 sha 冲突自动重试一次）。发布成功后内存与 GitHub 重新对账（重新列目录），保证一致性。

### 4.4 在线编辑器

双模式：所见即所得编辑 + Markdown 源码模式切换；实时预览；草稿自动存 localStorage（800ms 防抖）；新文章先创建占位文件再传图（图必须挂在有文章 ID 的目录下）。

### 4.5 图片上传（浏览器端压缩）

粘贴 / 拖拽 / 文件选择 → canvas 压缩（最长边 1600px、质量 0.85）→ base64 → Contents API 上传二进制。超 900KB 自动降档重压（1280/0.6 → 1024/0.5），GIF 跳过压缩保动画。

### 4.6 鉴权

GitHub PAT（`repo` 权限）存 **sessionStorage**（关标签页即失效，降低泄露面）。登录时先调 `/user` 验证并回显用户名；写操作统一走 token 头，401/403 引导重新登录。

### 4.7 版本与缓存失效（双版本号必须一致）

- `index.html` 静态资源带 `?v=YYYYMMDDx` 查询参数；
- `js/app.js` 内有 `APP_VERSION`，启动时发现与本地记录不一致则清文章缓存并强刷。
- 两者由 `push.ps1` 一次性同步更新（见 §7），防止「改了没生效」。

## 5. 主题系统

`<html data-mode="daily|dev">` 驱动整套 CSS 变量（token）切换，模式选择器写入 localStorage。

| 频道 | 风格 | 布局 |
| --- | --- | --- |
| daily（日常，默认） | 暗黑科技自然风：深墨绿黑底 + 荧光青绿锚点 + 琥珀点缀，萤火虫粒子、球面高光水珠导航 | 个人主页式：左头像栏 + 右 About/Posts 双栏，短内容垂直居中 |
| dev（开发） | GitHub 浅色极简风 + 等宽字体 | Hero + 小红书卡片/列表双视图切换 |

CSS 组织约定：**样式按「版本块」向文件末尾追加**（`/* v4 导航水珠 */`、`/* v6 布局修复 */`……），后块覆盖前块，不做大规模重构。每个 token 重定义块都注明「删除本块可恢复」。

已知陷阱（踩过，记录备查）：

- 全局 `body` 背景是暗色 `var(--bg-dark)`，而 dev 主题 token 是浅色系——若新增全局规则用错变量，会出现「暗底暗字隐形」。v6 修复时已给 dev 显式声明 `body { background: #fff }`。
- dev 模式下导航水珠（glider）必须隐藏（dev 的 active 样式与水珠重复且 `.main-nav` 需保持 `position: relative` 作定位基准）。

## 6. 阅读体验增强（文章页）

- **TOC**：从 h2/h3 自动生成；桌面右侧悬浮玻璃面板（≤1200px 变顶部折叠），滚动 rAF 节流高亮；点击用 `scrollIntoView` 而非锚点（避免触发 hash 路由）。
- **代码复制**：hover 浮现按钮，clipboard API + execCommand 兜底，触屏常显。
- **阅读进度条**：顶部 3px 青绿→琥珀渐变，仅文章路由显示，离开自动收起。
- **图片灯箱**：正文图片点击放大，ESC/点击关闭；图片统一注入 `loading="lazy"` + `decoding="async"`。
- **入场动画**：列表卡片用 IntersectionObserver 进入视口逐个上浮（60ms 错开），`prefers-reduced-motion` 下直接显示。
- **骨架屏**：首次无缓存访问时按当前频道渲染结构化占位（shimmer）。

## 7. 工程与部署

### 7.1 push.ps1（发布一条龙）

读取 index.html 当前 `?v=` → 自增尾部字母（g→h…z→aa）→ 同步替换静态资源版本与 app.js 的 `APP_VERSION` → `git add -A && commit && push`。

⚠️ 工程约束（v20260829g 踩坑记录）：

- 脚本必须是**纯 ASCII**。PowerShell 5.1 对无 BOM 的 UTF-8 脚本按 ANSI 解析，中文注释/参数会引发难以排查的变量读空与参数错乱（曾导致全文 `v=` 被误替换、index.html 损坏）。
- 版本替换正则锁定查询串 `\?v=[0-9A-Za-z]+`，且读不到版本号时**直接退出**而非继续执行。
- 中文提交信息请用 `git commit` 直发，不要经 push.ps1 的 `-M` 参数传递。

### 7.2 部署

GitHub Actions（`.github/workflows/deploy.yml`）：push main → 拷贝 `index.html/css/js/assets` 至 `_site` → deploy-pages。约 1 分钟生效。

### 7.3 本地开发

`python -m http.server 8765`（`start-blog.bat` / `blog-autostart.vbs` 可开机自启）。数据实时来自线上 GitHub，本地所见即线上效果。直接双击 index.html 不可用（fetch 受 file:// 限制）。

## 8. 性能现状与取舍

| 项 | 状态 |
| --- | --- |
| 首屏 | 回访缓存优先秒开；首次骨架屏 + 串行 API（可再优化为并行） |
| 图片 | 上传压缩 + 懒加载；正文图走 jsDelivr CDN |
| 字体 | Google Fonts + 霞鹜文楷 CDN，`display=swap`；国内访问偏慢，暂接受 |
| 仓库体积 | 已清理 3MB 孤儿图与 870 行死代码（api/renderer/utils.js 已删） |

## 9. 已知限制 / 后续方向

- **SEO**：hash 路由 + 客户端渲染，搜索引擎基本不收录文章页；分享卡片（OG）已做但部分平台不执行 JS，拿不到文章级 meta。若需要 SEO，再评估构建期生成静态文章页。
- **匿名 API 限流**：GitHub 匿名请求 60 次/小时/IP，超限依赖 localStorage 缓存兜底。
- **单 PAT**：无服务端，token 只能存浏览器端，权限粒度依赖 GitHub PAT 本身。
- 可选演进：搜索功能、评论（giscus）、文章归档页、RSS（构建期生成）。
