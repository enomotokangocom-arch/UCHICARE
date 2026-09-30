// ブラウザ内デモのビルド: node demo-web/build.mjs → demo-web/dist/
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "..");
const out = path.join(here, "dist");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const shim = (p) => path.join(here, "shims", p);
await build({
  entryPoints: [path.join(here, "entry.tsx")],
  outfile: path.join(out, "app.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "next/link": shim("next-link.tsx"), "next/navigation": shim("next-navigation.ts"), "node:crypto": shim("crypto.ts") },
  external: ["fs", "path", "crypto", "node:fs", "node:path"],
  logLevel: "warning",
  plugins: [{
    name: "browser-db",
    setup(b) {
      // サーバー用の db.ts(node:sqlite)をブラウザ用に差し替える
      b.onResolve({ filter: /^\.\/db$/ }, (args) =>
        args.importer.includes(path.join("src", "onboarding", "server")) ? { path: shim("db.ts") } : undefined);
    },
  }],
});

const css = await postcss([tailwind({ base: here })]).process(fs.readFileSync(path.join(here, "styles.css"), "utf8"), { from: path.join(here, "styles.css") });
fs.writeFileSync(path.join(out, "index.html"), `<title>入職準備管理 デモ</title>
<style>${css.css}</style>
<div id="root"><p style="padding:40px 16px;text-align:center;color:#64748b;font-size:14px">読み込み中...</p></div>
<script src="app.js"></script>
`);
const kb = (f) => Math.round(fs.statSync(path.join(out, f)).size / 1024) + "KB";
console.log("built:", "index.html", kb("index.html"), "app.js", kb("app.js"));
