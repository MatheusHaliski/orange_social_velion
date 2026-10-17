// Anatomia dos cards: recorta cada card do protótipo, numera as partes e salva em anatomia/*.png (2x).
// As partes e os textos são a fonte das tabelas de docs/TAXONOMIA_ATORES_E_CARDS.md §5.
//
//   npm i playwright-core
//   CHROMIUM=/caminho/do/chrome node design/prototype/anatomy.mjs [fontes-locais.css]
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "anatomia");
mkdirSync(out, { recursive: true });

// [nº provisório, rótulo, seletor dentro do recorte, lado do rótulo]. "@borda" = filete esquerdo de 3 px do card;
// "@faixa:top|bottom" = faixa de 11 px da moldura; "@anel" = trecho da borda direita da moldura.
// Seletor com "*" no fim = união de todos os elementos encontrados. A numeração final segue a ordem de
// leitura (de cima para baixo) e vai para anatomia/partes.json, que alimenta as tabelas da documentação.
const SPECS = [
  { id: "01-post-texto", title: "Post · texto", note: "Post Feed · FeedType.POST · MediaType.TEXT",
    shot: "01-post-feed", src: ['.card[data-post="p2"]'], parts: [
      [1, "Borda da categoria do autor (3 px)", "@borda", "l"],
      [2, "Bolinha: cor + glifo da categoria", ".author .dot", "l"],
      [3, "Nome do autor · link para o perfil", ".who b", "l"],
      [4, "Categoria · tempo relativo (&lt;time&gt;)", ".who span", "l"],
      [5, "Tipo de mídia", ".meta .type", "r"],
      [6, "Classificação indicativa", ".rating", "r"],
      [7, "Título · abre o modal", ".c-title", "l"],
      [8, "Subtítulo (até 2 linhas)", ".c-sub", "r"],
      [9, "Curtir + contagem", '[data-act="like"]', "l"],
      [10, "Comentar + contagem", '[data-act="comment"]', "l"],
      [11, "Compartilhar + contagem", '[data-act="share"]', "r"],
      [12, "Salvar (privado, sem contagem)", '[data-act="save"]', "r"],
      [13, "Tendência", ".trend", "r"]] },
  { id: "02-post-video", title: "Post · vídeo", note: "MediaType.VIDEO · em alta",
    shot: "01-post-feed", src: ['.card[data-post="p1"]'], parts: [
      [1, "Tipo: VÍDEO", ".meta .type", "r"],
      [2, "Mídia 16:9 (chave no S3)", ".media", "l"],
      [3, "Play", ".media .play", "r"],
      [4, "Duração", ".media .dur", "r"],
      [5, "Tendência: em alta", ".trend", "r"],
      [6, "Contagem compacta (2,1 mil)", '[data-act="like"] span', "l"]] },
  { id: "03-post-imagem-publicidade", title: "Post · imagem de marca", note: "MediaType.IMAGE · AZUL · publicidade",
    shot: "01-post-feed", src: ['.card[data-post="p3"]'], parts: [
      [1, "Bolinha AZUL (triângulo)", ".author .dot", "l"],
      [2, "Tipo: IMAGEM", ".meta .type", "r"],
      [3, "Imagem", ".media", "l"],
      [4, "Selo de publicidade (CDC art. 36)", ".sponsored", "l"],
      [5, "Tendência: estável", ".trend", "r"]] },
  { id: "04-vaga", title: "Vaga", note: "Alert Feed · AlertCategory.JOB_OPENING",
    shot: "03-alert-feed", src: ['.card[data-post="j1"]'], parts: [
      [1, "Borda VERMELHO (instituição)", "@borda", "l"],
      [2, "Autor: instituição", ".author", "l"],
      [3, "Tipo: VAGA", ".meta .type", "r"],
      [4, "Cargo · modelo · cidade", ".c-title", "l"],
      [5, "Requisitos e prazo", ".c-sub", "r"],
      [6, "Ações (sem classificação)", ".actions", "r"]] },
  { id: "05-audio", title: "Áudio", note: "Audio Feed · AudioKind.PERSONAL_AUDIO",
    shot: "02-audio-feed", src: ['.card[data-post="a2"]'], parts: [
      [1, "Autor (bolinha + nome + tempo)", ".author", "l"],
      [2, "Tipo de áudio", ".meta .type", "r"],
      [3, "Classificação", ".rating", "r"],
      [4, "Título", ".c-title", "l"],
      [5, "Forma de onda (picos do backend)", ".wave", "r"],
      [6, "Trecho já ouvido", ".wave i:not(.after)*", "l"],
      [7, "Play / pausa", ".play-sm", "l"],
      [8, "Posição / duração", ".audio-row .time", "r"],
      [9, "Ações", ".actions", "r"]] },
  { id: "06-mini-player", title: "Tocando agora", note: "Audio Feed · mini player fixo",
    shot: "02-audio-feed", src: [".now-playing"], parts: [
      [1, "Play / pausa", ".np-btn", "l"],
      [2, "Rótulo e episódio", ".np-info small", "r"],
      [3, "Título", ".np-info b", "r"],
      [4, "Progresso", ".progress", "l"]] },
  { id: "07-alerta", title: "Alerta oficial", note: "Alert Feed · CAP 1.2 · fonte verificada",
    shot: "03-alert-feed", src: ['.card[data-post="al1"]'], parts: [
      [1, "Borda VERMELHO + fundo de alerta", "@borda", "l"],
      [2, "Severidade · evento", ".sev", "l"],
      [3, "Emitido há", ".card-top .type", "r"],
      [4, "Título", ".c-title", "l"],
      [5, "Área no mapa", ".map", "l"],
      [6, "Epicentro", ".map .pin", "r"],
      [7, "Fonte", ".kv dd:nth-of-type(1)", "l"],
      [8, "Selo: fonte verificada", ".verified", "r"],
      [9, "Área e raio", ".kv dd:nth-of-type(2)", "r"],
      [10, "Válido até (expires)", ".kv dd:nth-of-type(3)", "r"],
      [11, "O que fazer (instruction)", ".kv dd:nth-of-type(4)", "r"],
      [12, "Só compartilhar", '[data-act="share"]', "l"],
      [13, "Sem curtidas em alerta oficial", ".actions .trend", "r"]] },
  { id: "08-perfil", title: "Perfil", note: "Profile Feed · FeedType.PROFILE",
    shot: "04-profile-feed", src: [".pcard"], parts: [
      [1, "Avatar (foto ou iniciais)", ".avatar", "l"],
      [2, "Bolinha da categoria", ".avatar .dot", "l"],
      [3, "Nome", ".p-body > b", "r"],
      [4, "Categoria: cor + rótulo", ".p-cat", "r"],
      [5, "Cidade, UF · país", ".p-loc", "l"],
      [6, "Interesses (taxonomia fixa)", ".tags", "l"],
      [7, "Seguir / Seguindo", ".follow", "r"]] },
  { id: "09-perfil-cabecalho", title: "Cabeçalho do perfil do autor", note: "RF25 · só dados públicos",
    shot: "10-perfil-autor", src: [".profile-head", ".p-stats"], wrap: [], parts: [
      [1, "Avatar + bolinha", ".profile-head .avatar", "l"],
      [2, "Nome", ".profile-head b", "r"],
      [3, "Categoria: glifo + rótulo", ".profile-head .p-cat", "r"],
      [4, "Membro desde", ".profile-head .since", "r"],
      [5, "Nº de posts", ".p-stats div:nth-child(1)", "l"],
      [6, "Curtidas recebidas", ".p-stats div:nth-child(2)", "r"]] },
  { id: "10-modal-post", title: "Modal do post", note: "RF24 · role=dialog · aria-modal",
    shot: "09-post-modal", src: [".overlay .sheet"], wrap: [], fix: true, parts: [
      [1, "Alça (arrastar para fechar)", ".grabber", "l"],
      [2, "Tipo de mídia", ".sheet-head .type", "l"],
      [3, "Fechar (Esc)", ".close", "r"],
      [4, "Autor · link para o perfil", ".pm-author", "l"],
      [5, "Mídia", ".media", "r"],
      [6, "Título (h2)", ".pm-title", "l"],
      [7, "Subtítulo", ".pm-sub", "r"],
      [8, "Texto completo", ".pm-body", "l"],
      [9, "Data absoluta", ".pm-meta > span:nth-child(1)", "l"],
      [10, "Tempo relativo", ".pm-meta > span:nth-child(2)", "r"],
      [11, "Local", ".pm-meta > span:nth-child(3)", "l"],
      [12, "Classificação", ".pm-meta .rating", "r"],
      [13, "Contagens por extenso", ".pm-counts", "r"],
      [14, "Ações com rótulo", ".pm-actions", "l"],
      [15, "Prévia dos comentários", ".pm-comments", "r"]] },
  { id: "11-comentario", title: "Comentário", note: "RF26 · CommentStatus",
    shot: "11-comentarios", src: [".comment:nth-of-type(3)", ".comment:nth-of-type(4)"], wrap: ["sheet-body"], parts: [
      [1, "Bolinha do autor", ".comment:nth-of-type(1) .dot", "l"],
      [2, "Nome · link para o perfil", ".comment:nth-of-type(1) .c-head a", "l"],
      [3, "Tempo relativo", ".comment:nth-of-type(1) time", "r"],
      [4, "Texto (1–2.000)", ".comment:nth-of-type(1) p", "r"],
      [5, "Seu comentário: nome sem link", ".comment:nth-of-type(2) .c-head b", "l"],
      [6, "Apagar (autor ou dono do post)", ".comment:nth-of-type(2) .del", "r"]] },
  { id: "12-opcao-tipo", title: "Opção de tipo de usuário", note: "RF1 · cadastro · role=radio",
    shot: "14-cadastro", src: [".types"], wrap: ["auth-card"], parts: [
      [1, "Bolinha: cor + glifo", '.type-opt[aria-checked="true"] .dot', "r"],
      [2, "Rótulo da categoria", '.type-opt[aria-checked="true"] b', "r"],
      [3, "Para quem é", '.type-opt[aria-checked="true"] small', "r"],
      [4, "Selecionada: borda + fundo laranja", '.type-opt[aria-checked="true"]', "r"],
      [5, "Não selecionada", '.type-opt[data-type="VERDE"]', "l"],
      [6, "PRETO: anel claro no escuro", '.type-opt[data-type="PRETO"] .dot', "l"]] },
  { id: "13-sessao", title: "Sessão ativa", note: "RF27 · Senha e segurança",
    shot: "17-seguranca", src: [".group:nth-of-type(2) .rows"], wrap: ["settings"], parts: [
      [1, "Aparelho (celular / computador)", ".sess:nth-child(1) svg", "l"],
      [2, "Navegador e sistema", ".sess:nth-child(1) b", "l"],
      [3, "Esta sessão", ".here", "r"],
      [4, "Último acesso · cidade aproximada", ".sess:nth-child(2) .txt span", "l"],
      [5, "Encerrar aquela sessão", ".sess:nth-child(2) [data-end]", "r"]] },
  { id: "14-post-tema-claro", title: "Post · tema claro", note: "Variantes 700 da paleta",
    shot: "06-post-feed-claro", src: ['.card[data-post="p2"]'], parts: [
      [1, "Borda: variante escura (#1E7A3A)", "@borda", "l"],
      [2, "Bolinha com glifo branco", ".author .dot", "l"],
      [3, "Classificação: texto branco", ".rating", "r"],
      [4, "Curtido: laranja #C2410C", '[data-act="like"]', "l"]] },
  { id: "15-moldura", title: "Moldura do post", note: "RF28 · Background Studio · post em alta",
    shot: "28-feed-molduras", src: [".frame"], parts: [
      [1, "Arte da moldura (faixa de 11 px)", "@faixa:top", "l"],
      [2, "Aura Hype: anel (só em alta)", "@anel", "r"],
      [3, "Filete da categoria, dentro do container", "@borda", "l"],
      [4, "Bolinha da categoria: o sinal real", ".author .dot", "l"],
      [5, "Mídia dentro do container", ".media", "r"],
      [6, "Container opaco: texto nunca sobre a arte", ".c-title", "l"],
      [7, "Texto “em alta”: sinal obrigatório do Hype", ".trend", "r"],
      [8, "Material (vidro) por cima da arte", "@faixa:bottom", "l"]] }
];

const localFontsCss = process.argv[2] ? resolve(process.argv[2]) : null;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const page = await browser.newPage({ viewport: { width: 1840, height: 2000 }, deviceScaleFactor: 2 });
if (localFontsCss) {
  const base = pathToFileURL(dirname(localFontsCss) + "/").href;
  const css = readFileSync(localFontsCss, "utf8").replace(/url\(([^)]+)\)/g, (_, u) => `url(${base}${u})`);
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: css }));
}
// Versão estática (Reduzir movimento): Hype parado e pôster da Aura Plus, para o desenho sair igual a cada execução
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(pathToFileURL(join(here, "index.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: `
  .gallery, .gallery-head { visibility: hidden; }
  #anat { position: absolute; left: 0; top: 0; z-index: 999; background: #0B0906; padding: 74px 200px 30px; }
  #anat .phone { height: auto; width: 390px; border-radius: 22px; box-shadow: 0 0 0 1px #2B2217; padding: 16px 0; overflow: visible; }
  #anat .phone > div, #anat .feed, #anat .settings, #anat .sheet-body { overflow: visible; flex: none; }
  #anat .auth-card { margin: 0 16px; }
  #anat .sheet { max-height: none; height: auto; box-shadow: none; border-radius: 0; }
  #anat .sheet .sheet-body { padding-bottom: 6px; }
  #anat h1 { position: absolute; left: 200px; top: 22px; font: 700 21px 'Bricolage Grotesque', sans-serif; color: #F6EFE5; }
  #anat h1 small { font: 400 11px 'Space Mono', monospace; letter-spacing: .1em; color: #8C7E69; margin-left: 10px; text-transform: uppercase; }
  #anat .lbl { position: absolute; width: 168px; display: flex; align-items: flex-start; gap: 7px; font: 500 11.5px/1.3 'Inter', sans-serif; color: #F6EFE5; }
  #anat .lbl.l { flex-direction: row-reverse; text-align: right; }
  #anat .lbl b { flex: none; width: 19px; height: 19px; border-radius: 50%; background: #FF6A2B; color: #17120D; font: 800 10.5px/19px 'Inter', sans-serif; text-align: center; }
  #anat .lbl span { padding-top: 2px; }
  #anat svg.ov { position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; }
`});

const parts = {};
for (const spec of SPECS) {
  const numbered = await page.evaluate(spec => {
    document.getElementById("anat")?.remove();
    const srcPhone = document.querySelector(`[data-shot="${spec.shot}"]`);
    const wrap = document.createElement("div"); wrap.id = "anat";
    wrap.innerHTML = `<h1>${spec.title}<small>${spec.note}</small></h1>`;
    const ph = document.createElement("div");
    ph.className = "phone" + (srcPhone.classList.contains("light") ? " light" : "");
    let host = ph;
    for (const cls of spec.wrap ?? ["feed"]) { const d = document.createElement("div"); d.className = cls; host.appendChild(d); host = d; }
    for (const s of spec.src) host.appendChild(srcPhone.querySelector(s).cloneNode(true));
    wrap.appendChild(ph);
    document.body.appendChild(wrap);
    window.scrollTo(0, 0);

    const W = wrap.getBoundingClientRect(), P = ph.getBoundingClientRect();
    const rel = r => ({ x: r.left - W.left, y: r.top - W.top, w: r.width, h: r.height });
    const box = sel => {
      if (sel === "@borda") { const r = rel(ph.querySelector(".card, .pcard").getBoundingClientRect()); return { ...r, w: 3, h: 24 }; }
      if (sel.startsWith("@faixa")) { const r = rel(ph.querySelector(".frame").getBoundingClientRect());
        return sel.endsWith("bottom") ? { ...r, y: r.y + r.h - 11, h: 11 } : { ...r, h: 11 }; }
      if (sel === "@anel") { const r = rel(ph.querySelector(".frame").getBoundingClientRect()); return { x: r.x + r.w - 3, y: r.y + 24, w: 3, h: 44 }; }
      const all = sel.endsWith("*") ? [...ph.querySelectorAll(sel.slice(0, -1))] : [ph.querySelector(sel)];
      if (!all[0]) throw new Error(`${spec.id}: seletor sem resultado: ${sel}`);
      const rs = all.map(e => e.getBoundingClientRect());
      const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
      return rel({ left: l, top: t, width: Math.max(...rs.map(r => r.right)) - l, height: Math.max(...rs.map(r => r.bottom)) - t });
    };
    const px = { l: P.left - W.left, r: P.right - W.left };
    const items = spec.parts.map(([, label, sel, side]) => ({ label, side, b: box(sel) }))
      .sort((a, b) => (a.b.y + a.b.h / 2) - (b.b.y + b.b.h / 2) || a.b.x - b.b.x);
    items.forEach((it, i) => { it.n = i + 1; });
    let svg = "", bottom = 0;
    for (const side of ["l", "r"]) {
      let prev = -Infinity;
      for (const it of items.filter(i => i.side === side).sort((a, b) => (a.b.y + a.b.h / 2) - (b.b.y + b.b.h / 2))) {
        const ay = it.b.y + it.b.h / 2;
        const y = Math.max(ay - 9, prev + 34);
        prev = y;
        const el = document.createElement("div");
        el.className = `lbl ${side}`;
        el.innerHTML = `<b>${it.n}</b><span>${it.label}</span>`;
        el.style.top = `${y}px`;
        el.style.left = side === "l" ? `${px.l - 182}px` : `${px.r + 14}px`;
        wrap.appendChild(el);
        const bx = side === "l" ? px.l - 14 - 4 : px.r + 14 + 4;      // centro da bolinha numerada no lado de dentro
        const ex = side === "l" ? it.b.x - 2 : it.b.x + it.b.w + 2;   // borda da parte
        const ey = Math.min(Math.max(ay, it.b.y), it.b.y + it.b.h);
        svg += `<rect x="${it.b.x - 2}" y="${it.b.y - 2}" width="${it.b.w + 4}" height="${it.b.h + 4}" rx="4" fill="none" stroke="#FF6A2B" stroke-width="1.2" stroke-dasharray="3 2"/>`
             + `<polyline points="${bx},${y + 9.5} ${side === "l" ? px.l + 6 : px.r - 6},${y + 9.5} ${ex},${ey}" fill="none" stroke="#FF6A2B" stroke-width="1" opacity=".85"/>`
             + `<circle cx="${ex}" cy="${ey}" r="2.4" fill="#FF6A2B"/>`;
      }
      bottom = Math.max(bottom, prev);
    }
    wrap.style.paddingBottom = `${Math.max(30, bottom + 44 - (P.bottom - W.top))}px`;
    const ov = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ov.setAttribute("class", "ov");
    ov.setAttribute("width", wrap.scrollWidth); ov.setAttribute("height", wrap.scrollHeight + 200);
    ov.innerHTML = svg;
    wrap.appendChild(ov);
    return items.map(({ n, label }) => [n, label.replace("&lt;", "<").replace("&gt;", ">")]);
  }, spec);
  parts[spec.id] = { title: spec.title, note: spec.note, parts: numbered };
  await page.locator("#anat").screenshot({ path: join(out, `${spec.id}.png`), animations: "disabled" });
  console.log("ok", spec.id);
}
writeFileSync(join(out, "partes.json"), JSON.stringify(parts, null, 2) + "\n");
await browser.close();
