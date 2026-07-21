/* ====== 博客配置 ======
 * 文章数据已迁移到 data/articles.json（运行时 fetch 加载，可在线编辑发布）
 * 本文件只保留：配色板、站点信息、GitHub 仓库配置
 */

// GitHub 仓库配置（在线编辑发布用）
const CONFIG = {
  owner: "Littledragon-wxl",
  repo: "blog",
  branch: "main",
  dataPath: "js/posts.json"
};

// 封面渐变配色板（小红书卡片视图用）
const COVERS = {
  ocean:   "linear-gradient(135deg, #4f8bc9 0%, #2c5f8d 100%)",
  indigo:  "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
  teal:    "linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%)",
  night:   "linear-gradient(135deg, #5b5680 0%, #2a2640 100%)",
  sunset:  "linear-gradient(135deg, #f97316 0%, #db2777 100%)",
  berry:   "linear-gradient(135deg, #e11d48 0%, #9f1239 100%)",
  forest:  "linear-gradient(135deg, #65a30d 0%, #3f6212 100%)",
  amber:   "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)"
};

// 站点信息（关于页用）
const SITE = {
  name: "码与生活",
  author: "佚名",
  role: "全栈开发者 · 写作爱好者",
  avatarText: "码",
  bio: "白天写代码，深夜写文字。相信好的程序和好的文章一样，都需要耐心打磨。这里记录我的技术探索与生活思考。",
  skills: ["JavaScript / TypeScript", "Python", "React / Vue", "Node.js", "CSS 与设计", "Markdown 写作"],
  interests: ["手冲咖啡", "深夜阅读", "长跑", "胶片摄影"],
  contact: "写邮件给我，或在关于页留言"
};
