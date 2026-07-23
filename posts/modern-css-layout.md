---
id: modern-css-layout
title: CSS 现代布局完全指南：Flexbox 与 Grid 实战
emoji: 🎨
date: 2026-07-02
category: 技术
tags: [CSS, 布局, 前端]
cover: teal
excerpt: Flexbox 和 Grid 不是二选一，而是配合使用。一文理清什么时候用哪个，以及那些容易踩的坑。
---

## 一句话区分

- **Flexbox** —— 一维布局（一行或一列）
- **Grid** —— 二维布局（行和列同时控制）

这不是教科书定义，而是实战心法。

## Flexbox 最常用的三个属性

```css
.container {
  display: flex;
  justify-content: space-between;  /* 主轴对齐 */
  align-items: center;             /* 交叉轴对齐 */
  gap: 16px;                       /* 间距 */
}
```

记住这三个，90% 的场景就够了。

### 经典：导航栏

```css
.nav {
  display: flex;
  justify-content: space-between; /* logo 在左，菜单在右 */
  align-items: center;
}
```

### 经典：卡片底部

```css
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

## Grid 的网格思维

Grid 的强大在于**显式定义行列**：

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}
```

这一行就实现了**响应式卡片网格**——屏幕宽时多列，窄时自动减少列数，无需媒体查询。

> `auto-fit` + `minmax` 是 Grid 最优雅的组合。

### 经典：页面整体布局

```css
.layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}
.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.footer { grid-area: footer; }
```

## 什么时候用哪个

| 场景 | 推荐 |
| --- | --- |
| 导航栏、按钮组、工具条 | Flexbox |
| 卡片网格、相册 | Grid |
| 居中一个元素 | Flexbox |
| 整页布局 | Grid |
| 不确定数量的一排项 | Flexbox |
| 需要项跨越多行多列 | Grid |

## 一个常见误区

很多人觉得"用 Flex 就别用 Grid"。其实它们可以**嵌套**：

```css
/* Grid 控制整体，Flex 控制局部 */
.page { display: grid; grid-template-columns: 1fr 3fr; }
.card { display: flex; flex-direction: column; }
```

外层用 Grid 划分区域，内层用 Flex 排列内容，各司其职。

## gap 属性：被低估的好东西

以前用 margin 控制间距，还要处理首尾元素的多余边距。现在 `gap` 一行搞定，Flex 和 Grid 都支持：

```css
.row { display: flex; gap: 12px; }
.grid { display: grid; gap: 20px; }
```

**抛弃 margin 凑间距的老办法吧。**

## 结语

现代 CSS 布局的核心就两个工具，配合 `gap` 这个粘合剂。别再去背 `float`、`position: absolute` 那套老黄历了——它们该退休了。

布局本该如此简单。