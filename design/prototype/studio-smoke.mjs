// Teste de fumaça do Background Studio (RF28) no protótipo: troca de aba, limpeza de escolhas incompatíveis,
// modal com rascunho (Aplicar/Cancelar), contraste automático, serialização do JSON e a Aura Plus
// (toca AV1 ou H.264, para em 5 s, fica no pôster com "Reduzir movimento").
//
//   npm i playwright-core
//   CHROMIUM=/caminho/do/chrome node design/prototype/studio-smoke.mjs
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const url = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "index.html")).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const open = async reduced => {
  const page = await browser.newPage({ viewport: { width: 1840, height: 2000 } });
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => m.type() === "error" && errors.push(m.text()));
  await page.route("https://fonts.googleapis.com/**", r => r.fulfill({ contentType: "text/css", body: "" }));
  await page.goto(url);
  return { page, errors };
};
const state = async ph => JSON.parse(await ph.locator("[data-studio]").getAttribute("data-studio"));
const ok = msg => console.log("ok", msg);

{
  const { page, errors } = await open(false);
  let ph = page.locator('[data-shot="22-studio-cor"]');

  await ph.locator('[data-tab="aura"]').click();
  assert.match(await ph.locator("[role=tab][aria-selected=true]").textContent(), /Aura/);
  ok("troca de aba");

  await ph.locator('[data-st="aura"][data-v="mare"]').click();
  let st = await state(ph);
  assert.equal(st.aura.presetId, "mare");
  assert.equal(st.gradientId, null, "aura limpa o gradiente");
  await ph.locator('[data-art="IA"]').click();
  st = await state(ph);
  assert.equal(st.customArt.origin, "IA");
  assert.equal(st.aura, null, "arte própria remove o preset");
  assert.equal(await ph.locator(".frame-note").textContent(), "Moldura gerada por IA");
  await ph.locator('[data-st="aura"][data-v="eclipse"]').click();
  st = await state(ph);
  assert.equal(st.customArt, null, "preset remove a arte própria");
  ok("arte própria ⇄ preset");

  await ph.locator('[data-st="auraPlus"][data-v="aurora"]').click();
  st = await state(ph);
  assert.equal(st.auraPlusId, "aurora");
  assert.equal(st.aura, null);
  const video = ph.locator("video[data-aura-plus]");
  await page.waitForTimeout(1200);
  assert.equal(await video.evaluate(v => v.paused), false, "Aura Plus toca quando aparece");
  assert.match(await video.evaluate(v => v.currentSrc), /aurora-(hq|leve)\.mp4$/);
  await page.waitForTimeout(5200);
  assert.equal(await video.evaluate(v => v.paused), true, "para em 5 s (WCAG 2.2.2)");
  ok("Aura Plus toca e para em 5 s");

  await ph.locator('[data-tab="layout"]').click();
  await ph.locator('[data-st="layout"][data-v="POSTER"]').click();
  await ph.locator('[data-tab="aura"]').click();
  st = await state(ph);
  assert.deepEqual([st.aura, st.auraPlusId, st.materialId, st.metamorphose.mode], [null, null, null, "OFF"]);
  assert.equal(await ph.locator(".disabled-note").count(), 1, "aba Aura desligada com explicação");
  await ph.locator('[data-tab="layout"]').click();
  await ph.locator('[data-st="layout"][data-v="CLASSICO"]').click();
  ok("layout com arte própria desliga a aba Aura");

  await ph.locator('[data-tab="cor"]').click();
  await ph.locator("[data-open-season]").click();
  await ph.locator('[data-season-form] input[value="natal"]').check();
  assert.deepEqual((await state(ph)).seasonal, { presetId: null, auto: false }, "rascunho não mexe no post");
  await ph.locator("[data-season-form] [data-close]").click();
  assert.equal(await ph.locator("[data-season-form]").count(), 0);
  assert.deepEqual((await state(ph)).seasonal, { presetId: null, auto: false }, "Cancelar descarta");
  await ph.locator("[data-open-season]").click();
  await ph.locator('[data-season-form] input[value="natal"]').check();
  await ph.locator("[data-season-form] button[type=submit]").click();
  assert.deepEqual((await state(ph)).seasonal, { presetId: "natal", auto: false }, "Aplicar grava");
  ok("modal sazonal com rascunho");

  ph = page.locator('[data-shot="26-studio-container"]');
  assert.equal(await ph.locator(".contrast-bad b").first().textContent(), "1,8:1");
  await ph.locator("[data-use-ink]").click();
  assert.deepEqual((await state(ph)).container, { color: "#F5EDE3", ink: "#17120D" });
  await ph.locator('[data-st="ink"][data-v="AUTO"]').click();
  await ph.locator('[data-st="container"][data-v="#FF6A2B"]').click();
  const ratio = parseFloat((await ph.locator(".contrast-ok b").textContent()).replace(",", "."));
  assert.ok(ratio >= 4.5, `tinta automática passa no AA (${ratio})`);
  ok("contraste automático e sugestão");

  const saved = JSON.parse(await ph.locator(".json-box pre").textContent());
  assert.deepEqual(Object.keys(saved), ["v", "color", "gradientId", "seasonal", "animationId", "aura", "auraPlusId", "auraHypeStyle",
    "metamorphose", "materialId", "customArt", "layoutId", "skinId", "container"]);
  assert.ok(!JSON.stringify(saved).includes("url("), "o JSON não leva URL nem CSS");
  ok("serialização do JSON");

  assert.deepEqual(errors, []);
}
{
  const { page, errors } = await open(true);
  await page.waitForTimeout(1500);
  const paused = await page.locator('[data-shot="24-studio-aura-plus"] video[data-aura-plus]').evaluate(v => v.paused);
  assert.equal(paused, true, "Reduzir movimento: só pôster");
  assert.deepEqual(errors, []);
  ok("Reduzir movimento mantém o pôster");
}
await browser.close();
