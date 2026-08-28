/* ====== 博客配置 ======
 * 文章数据：每篇文章一个文件，存于 posts/ 目录（posts/<id>.md，Markdown + front matter）
 * 站点信息：js/site.json（运行时 fetch 加载，可在线编辑发布）
 * 本文件只保留：GitHub 仓库配置、封面配色板
 */

// GitHub 仓库配置（在线编辑发布用）
const CONFIG = {
  owner: "Littledragon-wxl",
  repo: "blog",
  branch: "main",
  postsDir: "posts",          // 文章目录：每篇一个 <id>.md 文件
  sitePath: "js/site.json"
};

// 封面渐变配色板（小红书卡片视图用）
const COVERS = {
  ocean:   "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  indigo:  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  teal:    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  night:   "linear-gradient(135deg, #434343 0%, #000000 100%)",
  sunset:  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  berry:   "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  forest:  "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  amber:   "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
  aurora:  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  galaxy:  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
};
