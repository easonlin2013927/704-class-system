import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { resolve } from "node:path";

const packageData = JSON.parse(await readFile("package.json", "utf8"));
const version = packageData.version;
const assetBase = `app-${version}`;
const styles = [
  "styles.css",
  "themes.css",
  "school.css",
  "redesign.css",
  "theme-expansion.css",
  "responsive.css",
  "login-layout.css",
  "v025.css",
  "resend-system.css",
  "offline.css",
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist/src", { recursive: true });
await mkdir("dist/assets", { recursive: true });
await mkdir("dist/downloads", { recursive: true });

await build({
  entryPoints: [resolve("src/main.js")],
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2022"],
  legalComments: "none",
  outfile: resolve(`dist/assets/${assetBase}.js`),
});

await build({
  stdin: {
    contents: styles.map(file => `@import "./src/${file}";`).join("\n"),
    resolveDir: resolve("."),
    loader: "css",
  },
  bundle: true,
  minify: true,
  legalComments: "none",
  outfile: resolve(`dist/assets/${assetBase}.css`),
});

const cssPath = `dist/assets/${assetBase}.css`;
const bundledCss = await readFile(cssPath, "utf8");
await writeFile(
  cssPath,
  bundledCss.replace(/@import\s*(?:url\()?['"]https:\/\/fonts\.googleapis\.com\/[^'"]+['"]\)?;/g, ""),
);

let html = await readFile("index.html", "utf8");
html = html
  .replace(/^\s*<link rel="modulepreload"[^>]+>\s*$/gm, "")
  .replace(/^\s*<link rel="stylesheet"[^>]+>\s*$/gm, "")
  .replace(
    /(<link rel="apple-touch-icon"[^>]+>)/,
    `$1\n    <link rel="stylesheet" href="./assets/${assetBase}.css" />`,
  )
  .replace(
    /<script type="module" src="\.\/src\/main\.js\?v=[^"]+"><\/script>/,
    `<script type="module" src="./assets/${assetBase}.js"></script>`,
  );

await writeFile("dist/index.html", html);
await cp("service-worker.js", "dist/service-worker.js");
await cp("src", "dist/src", { recursive: true });
await cp("docs/presentations/704-class-system-role-guide.pptx", "dist/downloads/704-class-system-role-guide.pptx");

const portals = {
  student: "學生端安裝｜704班級系統",
  teacher: "教師端安裝｜704班級系統",
  admin: "管理員登入｜704班級系統",
};
for (const [role, title] of Object.entries(portals)) {
  const portalHtml = html
    .replace("<head>", '<head>\n    <base href="../" />')
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  await mkdir(`dist/${role}`, { recursive: true });
  await writeFile(`dist/${role}/index.html`, portalHtml);
}
console.log("Static site built in dist/");
