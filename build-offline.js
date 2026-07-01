const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const js = fs.readFileSync("script.js", "utf8");

const offline = html
  .replace('<link rel="stylesheet" href="./styles.css">', `<style>\n${css}\n</style>`)
  .replace('<script src="./script.js"></script>', `<script>\n${js}\n</script>`);

fs.writeFileSync("福田観光栗園_防除計算ツール_オフライン.html", offline);
