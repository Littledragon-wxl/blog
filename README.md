# 码与生活 · 个人博客

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
| 文章存储 | 内置 JS 数据 + 浏览器 localStorage（用户写的文章） |
| 字体 | Noto Serif SC + Inter + JetBrains Mono |

## 📁 目录结构

```
blog/
├── index.html            # 入口
├── css/style.css         # 全部样式
├── js/
│   ├── articles.js       # 内置文章数据 + 站点信息 + 配色板
│   ├── app.js            # 路由、渲染、编辑器、存储逻辑
│   └── lib/marked.min.js # Markdown 解析（离线）
├── assets/               # 静态资源
├── .gitlab-ci.yml        # GitLab Pages 自动部署
└── start-blog.bat        # 本地一键启动（可选）
```

## 🚀 本地运行

### 方式一：直接打开
双击 `index.html` 即可（已离线化，无需联网）。

### 方式二：本地服务器
```bash
python -m http.server 8765
```
访问 http://localhost:8765

## ✍️ 写文章

1. 点击导航栏「✍️ 写作」
2. 填写标题、分类、标签，选择封面图标和配色
3. 在编辑区用 Markdown 写作，右侧实时预览
4. 点「发布文章」保存（存浏览器 localStorage）

你写的文章会出现在列表里，带「✍️ 我的」标记，可随时编辑/删除。

## 📤 新增内置文章

编辑 `js/articles.js`，往 `ARTICLES` 数组追加一项：
```javascript
{
  id: "article-id",
  title: "标题",
  emoji: "📝",
  cover: "ocean",        // ocean/indigo/teal/night/sunset/berry/forest/amber
  category: "技术",       // 或 "生活随笔"
  tags: ["标签1", "标签2"],
  date: "2026-07-21",
  excerpt: "摘要",
  content: "## Markdown 正文"
}
```

## ☁️ 部署到 GitLab Pages

1. 在 GitLab 新建空仓库
2. 按下方命令 push 代码
3. 进入仓库 **Settings → Pages** 查看上线地址
4. 每次 push 到 `main` 分支自动重新部署

访问地址：`https://<你的用户名>.gitlab.io/<仓库名>/`

## 📄 许可

MIT
