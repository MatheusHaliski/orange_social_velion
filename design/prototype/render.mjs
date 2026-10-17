// Renderiza as telas do protótipo em PNG (2x) e uma visão geral.
//
//   npm i playwright-core
//   CHROMIUM=/caminho/do/chrome node design/prototype/render.mjs [fontes-locais.css]
//
// Sem argumento usa as Google Fonts do <link>; com um CSS de @font-face local, renderiza offline.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "screens");
mkdirSync(out, { recursive: true });

const localFontsCss = process.argv[2] ? resolve(process.argv[2]) : null;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const page = await browser.newPage({ viewport: { width: 1840, height: 2000 }, deviceScaleFactor: 2 });
// Renders mostram a versão estática (pôster da Aura Plus, Hype parado): é o que vê quem usa "Reduzir movimento".
await page.emulateMedia({ reducedMotion: "reduce" });

if (localFontsCss) {
  const base = pathToFileURL(dirname(localFontsCss) + "/").href;
  const css = readFileSync(localFontsCss, "utf8").replace(/url\(([^)]+)\)/g, (_, u) => `url(${base}${u})`);
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: css }));
}

await page.goto(pathToFileURL(join(here, "index.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));

for (const el of await page.locator("[data-shot]").all()) {
  const id = await el.getAttribute("data-shot");
  await el.screenshot({ path: join(out, `${id}.png`), animations: "disabled" });
  console.log("ok", id);
}
await page.locator("#legend").screenshot({ path: join(out, "07-legenda-categorias.png") });
await page.locator("#brand").screenshot({ path: join(out, "08-marca.png") });
await page.screenshot({ path: join(out, "00-visao-geral.png"), fullPage: true, scale: "css" });  // 1x: a galeria inteira em 2x passa de 8 MB
console.log("ok visão geral");
await browser.close();
