---
id: build-personal-blog
title: 从零搭建个人博客：技术选型与实现
emoji: 🛠️
date: 2026-07-18
category: 技术
tags: [前端, CSS, JavaScript]
cover: ocean
excerpt: 为什么选择纯静态方案 市面上的博客框架很多——Hexo、Hugo、Jekyll、WordPress……但我最终选择用最朴素的方式手写一个。原因很简单：  完全掌…
---

## 为什么选择纯静态方案

市面上的博客框架很多——Hexo、Hugo、Jekyll、WordPress……但我最终选择用**最朴素的方式**手写一个。原因很简单：

- 完全掌控设计与代码，不被模板束缚
- 零构建步骤，打开即用，部署即上线
- 没有依赖地狱，十年后依然能跑

> 最好的工具，是你完全理解它如何工作的工具。

## 核心技术栈

整套博客只用了三样东西：

1. **HTML** —— 页面骨架
2. **CSS** —— 视觉与排版
3. **JavaScript** —— 路由与 Markdown 渲染

Markdown 渲染借助 `marked.js`（通过 CDN 引入），仅此而已。

## 路由怎么实现

没有 React Router，没有 Vue Router，就用最原始的 **hash 路由**：

```
window.addEventListener('hashchange', router);

function router() {
  const hash = location.hash.slice(1) || '/';
  // 根据 hash 渲染对应页面
  if (hash === '/') renderHome();
  else if (hash === '/tags') renderTags();
  else if (hash === '/about') renderAbout();
  else if (hash.startsWith('/post/')) renderPost(hash.slice(6));
}
```

简单、可靠、无刷新。浏览器前进后退都正常工作。

## 文章数据如何组织

我把所有文章存在一个 JS 数组里，每篇包含元信息和 Markdown 正文：

```
const ARTICLES = [
  {
    id: "my-post",
    title: "文章标题",
    category: "技术",
    tags: ["前端", "CSS"],
    date: "2026-07-18",
    excerpt: "摘要……",
    content: "## 这里是 Markdown 正文"
  }
];
```

渲染时用 `marked.parse()` 把正文转成 HTML。新增文章只需往数组里加一项。

## 部署到哪里

因为是纯静态文件，部署选择极其自由：

平台
特点
适合

GitHub Pages
免费、绑定仓库
开发者

Netlify
拖拽上传、自动 HTTPS
快速上线

Vercel
边缘网络、速度极快
追求性能

任意虚拟主机
传统但稳妥
已有服务器

我推荐 **Netlify**：把文件夹拖进去，30 秒拿到一个带 HTTPS 的网址。

## 一些设计取舍

- **字体**：正文用衬线体 `Noto Serif SC`，阅读更舒适；UI 用无衬线 `Inter`，清晰利落。
- **配色**：暖色调米白底 + 砖红强调色，避开了千篇一律的蓝紫。
- **代码块**：深色背景，与浅色正文形成节奏对比。

## 写在最后

这个博客本身就是一个活生生的例子——你正在看的页面就是它。代码不多，但每一行都是我亲手敲下的。

**技术不该是炫技，而是恰好够用。**