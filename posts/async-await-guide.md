---
id: async-await-guide
title: JavaScript 异步进阶：async/await 的正确打开方式
emoji: ⚡
date: 2026-07-10
category: 技术
tags: [JavaScript, 异步编程, 前端]
cover: indigo
excerpt: async/await 看起来简单，但并发、错误处理、取消这些进阶场景，用错了照样翻车。本文聊点实战里的坑。
---

## 别被同步的表象骗了

`async/await` 让异步代码看起来像同步代码，这是它最大的优点，也是最大的陷阱。

```javascript
// 看起来人畜无害
async function getData() {
  const a = await fetchA();  // 1 秒
  const b = await fetchB();  // 1 秒
  return a + b;
}
// 总耗时：2 秒 ❌
```

如果 `fetchA` 和 `fetchB` 互不依赖，你白白浪费了一秒。

## 用 Promise.all 实现并发

```javascript
async function getData() {
  const [a, b] = await Promise.all([fetchA(), fetchB()]);
  return a + b;
}
// 总耗时：1 秒 ✅
```

**规则**：互相独立的 await，就放进 `Promise.all`。

## 错误处理的三种姿势

### 1. try/catch —— 最直观

```javascript
try {
  const data = await fetchData();
} catch (err) {
  console.error('获取失败', err);
}
```

### 2. .catch() 链式 —— 更简洁

```javascript
const data = await fetchData().catch(err => null);
if (!data) return;
```

### 3. 包装工具函数 —— 最优雅

```javascript
// 把 await 变成 [err, data] 元组
function to(p) {
  return p.then(d => [null, d]).catch(e => [e, null]);
}

const [err, data] = await to(fetchData());
if (err) return;
```

> 第三种借鉴了 Go 的风格，在大型项目里可读性最好。

## 一个经典坑：循环里的 await

```javascript
// ❌ 串行，慢
for (const url of urls) {
  const data = await fetch(url);
  process(data);
}

// ✅ 并发，快
const results = await Promise.all(urls.map(fetch));
results.forEach(process);
```

但如果接口有限流，你需要分批并发：

```javascript
async function batch(urls, size = 5) {
  const results = [];
  for (let i = 0; i < urls.length; i += size) {
    const batch = urls.slice(i, i + size);
    results.push(...await Promise.all(batch.map(fetch)));
  }
  return results;
}
```

## 取消已经发出的请求

`async/await` 本身不支持取消，但 `AbortController` 可以：

```javascript
const controller = new AbortController();

fetch(url, { signal: controller.signal })
  .then(r => r.json())
  .catch(e => {
    if (e.name === 'AbortError') console.log('已取消');
  });

// 需要取消时
controller.abort();
```

这在搜索框防抖场景特别有用——用户连续输入时，取消上一次未完成的请求。

## 小结

| 场景 | 推荐做法 |
| --- | --- |
| 多个独立请求 | `Promise.all` |
| 需要错误兜底 | try/catch 或 to() 包装 |
| 循环请求 | map + Promise.all |
| 需要取消 | AbortController |

`async/await` 是好工具，但别让它掩盖了"这是异步"的本质。**写出能跑的代码不难，写出高性能的异步代码才见功力。**