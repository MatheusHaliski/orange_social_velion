# Orange Social · Web

App web do Orange Social (ecossistema Velion): Next.js 16 (App Router), React 19 e TypeScript `strict`, num
workspace npm. Os dados vêm da API Spring do repositório (`src/`); o navegador fala só com a origem do Next, que
repassa `/api/*` ao backend. Assim o cookie de sessão (`orange_session` no perfil dev) e o `XSRF-TOKEN` ficam na
mesma origem.

## Como rodar com o backend

```bash
# 1. backend (na raiz do repositório): PostGIS, Valkey e Garage + Spring no perfil dev
docker compose up -d
mvn spring-boot:run

# 2. frontend
cd frontend
npm install
npm run dev            # http://localhost:3000 (repassa /api para http://localhost:8080)
```

Outra origem para a API: `API_ORIGIN=https://api.exemplo npm run dev` (vale também no `npm run build`, porque os
`rewrites` são gravados no build). No perfil dev o código de confirmação de e-mail aparece no log do Spring.

## Estrutura

```text
frontend/
├── package.json            workspaces e scripts da raiz
├── eslint.config.mjs       ESLint (flat config, eslint-config-next)
├── vitest.config.ts        um projeto Vitest por pacote
├── packages/
│   ├── tokens/             tokens DTCG (tokens/*.json) → Style Dictionary 5 → dist/tokens.css e dist/tokens.ts
│   └── api/                tipos escritos a partir dos records Java + fetch com sessão e CSRF
└── apps/web/
    ├── app/                rotas: / (feeds), /u/[id], /posts/[id] (+ modal em (feeds)/@modal), /posts/[id]/editar,
    │                       /p/[id], /publicar, /entrar, /cadastro, /confirmar-email, /termos, /configuracoes/*
    ├── components/         casca, feeds, post, Background Studio, publicar, conta e Configurações
    ├── lib/                feeds e filtros na URL, categorias, moldura, formatação pt-BR, erros por campo…
    ├── public/brand/       logo, mark, mosaicos do fundo do app e Aura Plus (cópias de design/brand/)
    └── e2e/                Playwright + axe; fixtures JSON e API simulada (support/mock-api.ts, mock-posts.ts)
```

- **Tokens**: as cores de `docs/DESIGN_SYSTEM.md` nos dois temas: as 6 categorias (fill, tinta, anel e glifo;
  PRETO com anel `#D6D0C8` no escuro), classificação, alerta e o véu do fundo do app. `tokens.css` tem o claro como
  padrão, o escuro por `prefers-color-scheme` e o escolhido à mão por `data-theme`. O teste
  `packages/tokens/test/contraste.test.ts` confere 4,5:1 (texto) e 3:1 (bolinha, contorno, glifo) como o
  `scripts/wcag_contrast.py`.
- **Cor nunca é o único sinal**: `CategoryDot` desenha os 6 glifos VSL em SVG (losango, estrela, triângulo,
  hexágono, retângulo, círculo duplo) e vem sempre com o rótulo.
- **API**: `credentials: 'same-origin'`; antes da primeira escrita busca `GET /api/v1/auth/csrf` se o cookie
  `XSRF-TOKEN` não existir e manda `X-XSRF-TOKEN` em toda escrita (e tenta de novo uma vez se o token estiver velho).
  Erros viram `ApiError` com o Problem Details (`detail`, `errors[]`, `Retry-After`).
- **⏳ Rotas que o backend ainda não tem** (a tela está pronta, o e2e simula, e sem a rota a tela diz que aguarda a
  API): `GET /api/v1/posts?feed=POST|ALERT` com os filtros dos 6 eixos, `GET /api/v1/users` (Profile Feed), os
  campos `alert` e `trending` no card e o Audio Feed (a aba mostra "em breve").
- **Nada de token ou dado da conta no `localStorage`**: só a preferência de tema (`os:tema`).
- **Termos de Uso**: `/termos` é gerada no build a partir de `docs/legal/TERMOS_DE_USO.md`.

## Comandos (dentro de `frontend/`)

| Comando | O que faz |
|---|---|
| `npm run dev` | gera os tokens e sobe o Next em modo dev |
| `npm run lint` | ESLint em todo o workspace |
| `npm run typecheck` | `tsc --noEmit` nos três pacotes (`next typegen` antes, no web) |
| `npm test` | Vitest: tokens (contraste), cliente da API, libs e componentes |
| `npm run build` | `next build` |
| `npm run e2e` | Playwright contra `next build && next start`, com a API simulada por `context.route` |

O Playwright está fixado em **1.56.1**. Para usar um Chromium já instalado em vez de baixar um:

```bash
PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run e2e
E2E_PORT=3171 E2E_SKIP_BUILD=1 npm run e2e                  # outra porta; reaproveita o build que acabou de rodar
SCREENSHOTS_DIR=/tmp/telas npm run e2e -- screenshots        # capturas: computador e celular, claro e escuro
```

Os testes ponta a ponta não precisam do backend nem de Docker: todo `/api/v1/**` é respondido pelas fixtures de
`apps/web/e2e/fixtures/` (mesmos campos dos records Java) e cada tela principal passa pelo axe nos dois temas, sem
violação `serious` ou `critical`. Um teste força `DejaVu Sans` com texto a 150 % em 320 px e confere que nenhuma tela
rola para os lados.

## Observações

- O `package-lock.json` foi gerado com `npx npm@11 install`: o npm 10 tem um erro de resolução de peers opcionais
  (`Cannot read properties of null (reading 'edgesOut')`) ao adicionar o Vitest 4. O `npm ci` do npm 10 lê o lock
  normalmente. O `overrides` de `playwright-core` mantém o `@axe-core/playwright` na mesma versão do Playwright.
- `lucide-react` fica em **0.460.0**, a versão citada no `DESIGN_SYSTEM.md` §7 ("um ícone, um significado").
- O modal do post (RF24) é uma rota interceptada só a partir dos feeds e do perfil (`app/(feeds)/@modal`); de
  publicar, editar e entrar, o endereço do post abre a página com navegação completa (`openPostPage`).
- As artes de `public/brand/` são cópias de `design/brand/` (fonte da verdade); ao gerar artes novas, copie de novo.
