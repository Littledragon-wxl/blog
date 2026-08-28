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

// 封面渐变配色板（小红书卡片视图用）- 暗黑科技+文艺自然风格
const COVERS = {
  ocean:   "linear-gradient(135deg, #0a3d62 0%, #1e3799 50%, #0c2461 100%)",
  aurora:  "linear-gradient(135deg, #00d4aa 0%, #3498db 50%, #9b59b6 100%)",
  forest:  "linear-gradient(135deg, #1e8449 0%, #27ae60 50%, #2ecc71 100%)",
  galaxy:  "linear-gradient(135deg, #2c3e50 0%, #4a69bd 50%, #6c5ce7 100%)",
  sunset:  "linear-gradient(135deg, #e67e22 0%, #f39c12 50%, #e74c3c 100%)",
  berry:   "linear-gradient(135deg, #8e44ad 0%, #9b59b6 50%, #a569bd 100%)",
  night:   "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  tech:    "linear-gradient(135deg, #00d4aa 0%, #00b894 50%, #00a388 100%)",
  nature:  "linear-gradient(135deg, #2ecc71 0%, #27ae60 50%, #1e8449 100%)",
  cosmic:  "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)"
};
