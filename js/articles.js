/* ====== 博客配置 ======
 * 文章数据：js/posts.json（运行时 fetch 加载，可在线编辑发布）
 * 站点信息：js/site.json（运行时 fetch 加载，可在线编辑发布）
 * 本文件只保留：GitHub 仓库配置、封面配色板
 */

// GitHub 仓库配置（在线编辑发布用）
const CONFIG = {
  owner: "Littledragon-wxl",
  repo: "blog",
  branch: "main",
  postsPath: "js/posts.json",
  sitePath: "js/site.json"
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
