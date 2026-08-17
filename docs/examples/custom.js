/**
 * Example JS config. Copy to `.autofm/config.js` when a field
 * needs a function. JSON configs cannot hold functions.
 *
 * Use `module.exports` in `.js` / `.cjs`.
 * For `export default`, name the file `.mjs`.
 */
module.exports = {
  timezone: "Asia/Shanghai",
  dateFormat: "YYYY/MM/DD HH:mm:ss",
  noCategory: ["assets", "images", "public", "static", "node_modules", "dist", "build"],
  keyOrder: ["title", "date", "updated", "categories", "tags", "abbrlink"],
  protectedFields: ["date", "abbrlink", "permalink", "uuid"],
  backup: {
    enabled: false,
    directory: ".autofm/backup",
    maxFiles: 10,
  },
  templates: {
    default: {
      title: (_filePath, fileName) => fileName.replace(/\.(md|mdx|markdown)$/i, ""),
      date: "",
      categories: (filePath) => {
        const parts = filePath.split(/[/\\]/).filter(Boolean);
        return parts.slice(-3, -1).filter((part) => !part.startsWith("_") && !part.startsWith("."));
      },
      tags: [],
    },
  },
};
