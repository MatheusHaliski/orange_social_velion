# Design System — Orange Social

Derivado dos documentos de visão (`orange_social_spec`, `velion_sistema_identificacao_visual`,
`lgpd-config-perfil`) e da pesquisa de 17/10/2026. Contrastes verificados com
[`scripts/wcag_contrast.py`](../scripts/wcag_contrast.py).

## 1. Princípios

1. **Forma é gramática, cor é categoria** — mas **a cor nunca é o único sinal** (WCAG 1.4.1).
   Toda categoria carrega cor **+ glifo + rótulo**.
2. **Três camadas, três perguntas:** bolinha = *quem publica* (`Usertype`); borda = *que tipo de
   conteúdo*; chip = *para quem é adequado* (`ageRating`).
3. **Feed nunca mostra texto corrido:** título obrigatório (5–12 palavras, até 2 linhas),
   subtítulo opcional, corpo só no PostView.
4. **Privacy by Default na UI:** toggles de consentimento começam desligados; revogar é o mesmo
   controle que consentir.

## 2. Stack de UI

| Camada | Web | Mobile |
|---|---|---|
| Framework | Next.js 16 / React 19 | Expo SDK 58 / Expo Router |
| Estilo | Tailwind v4 + shadcn/ui + Radix | Uniwind (ou NativeWind 4.2) + react-native-reusables |
| Tokens | DTCG 2025.10 → Style Dictionary 5 → variáveis CSS / `@theme` | mesmo build → objeto TS |
| Ícones | glifos VSL em `packages/glyphs` (SVGR) + Lucide | `react-native-svg` + Lucide |
| Listas | TanStack Virtual | FlashList v2 |
| Dados | TanStack Query v5 + Zustand | idem |
| Animação | Motion 14 | Reanimated 4 + Gesture Handler |
| Áudio | `<audio>` + canvas/SVG waveform | `expo-audio` + Skia waveform |
| Docs / testes | Storybook 10 + addon-a11y; Chromatic ou Playwright + axe | `@storybook/react-native` |
| i18n | i18next 26 (ICU) | idem |

Monorepo Turborepo: `apps/web`, `apps/mobile`, `packages/tokens`, `packages/ui-web`,
`packages/ui-native`, `packages/glyphs`, `packages/api` (gerado do OpenAPI do Spring), `packages/i18n`.
**O Git é a fonte da verdade dos tokens**; Figma Variables / Tokens Studio alimentam o repositório.

## 3. Paleta e contraste

Fundos: tema escuro `#17120D` (warm charcoal), tema claro `#FFFFFF`. Marca: Orange `#FF6A2B`.

| Categoria | Cor original | Sobre `#17120D` | Sobre branco | Variante tema claro | Sobre branco |
|---|---|---|---|---|---|
| VERDE · pessoa física | `#3DDC6B` | 10,32 ✅ | 1,80 ❌ | `#1E7A3A` | 5,38 ✅ |
| AMARELO · imprensa / networking | `#F7C948` | 11,87 ✅ | 1,57 ❌ | `#8B6B00` | 5,00 ✅ |
| AZUL · marketing | `#4A93FF` | 6,12 ✅ | 3,04 ⚠️ | `#1D5FCC` | 5,90 ✅ |
| LARANJA · comunidade | `#FF9F1C` | 9,06 ✅ | 2,05 ❌ | `#A85200` | 5,42 ✅ |
| VERMELHO · instituição | `#FF4D4D` | 5,69 ✅ | 3,27 ⚠️ | `#C5221F` | 5,80 ✅ |
| PRETO · especial | `#0C0A07` | **1,06 ❌** | 19,77 ✅ | anel `#D6D0C8` no escuro | 12,15 ✅ |
| ORANGE · marca | `#FF6A2B` | 6,51 ✅ | 2,86 ❌ | `#C2410C` (texto/link) | 5,18 ✅ |

Limiares: 4,5:1 texto normal (AA); 3:1 texto grande e elementos não textuais (1.4.11 — bolinha, borda).
⚠️ = serve para bolinha/borda, não para texto pequeno.

**Correções obrigatórias:**

- **PRETO no tema escuro é invisível (1,06:1).** A bolinha PRETO recebe anel `#D6D0C8` de 2 px e
  glifo claro; no tema claro continua sólida.
- **Tema claro usa as variantes escuras** da tabela; as cores originais ficam para o tema escuro.
- **Botões Orange usam texto `#17120D`** (6,51:1), nunca branco (2,86:1). Links/texto Orange no
  tema claro usam `#C2410C`.
- Azul e Vermelho no escuro: para texto pequeno, clarear ~10–15 % de L em Oklch.

## 4. Sinais redundantes por categoria

| Categoria | Cor | Glifo VSL na bolinha | Rótulo (i18n) |
|---|---|---|---|
| VERDE | `category.person` | ◇ losango (identidade) | `category.person` |
| AMARELO | `category.press` | ✦ estrela | `category.press` |
| AZUL | `category.marketing` | △ triângulo *(proposto — VSL não tinha glifo)* | `category.marketing` |
| LARANJA | `category.community` | ⬢ hexágono | `category.community` |
| VERMELHO | `category.institution` | ▭ retângulo | `category.institution` |
| PRETO | `category.special` | ◎ círculo duplo *(proposto; o círculo era "reservado" na VSL)* | `category.special` |

Borda por tipo de conteúdo: cor **+ padrão** (sólida / tracejada / dupla) **ou ícone de canto**
Lucide (`user`, `file-text`, `mic`, `bell`). Chips de classificação sempre com texto visível
(`SAFE`, `KIDS`, `12+`, `16+`, `18+`, `Sensível`) e `accessibilityLabel` por extenso. Raridade
(Common → Mythic): largura/efeito da borda **+ selo textual**; respeitar `prefers-reduced-motion` /
`AccessibilityInfo.isReduceMotionEnabled` nos brilhos.

## 5. Tokens (DTCG 2025.10)

Três camadas: **primitive** (paleta crua) → **semantic** (`category.*`, `content.border.*`,
`rating.*`, `rarity.*`, por tema) → **component** (`card.dot`, `card.border`, `chip.*`).
Um arquivo por modo (`tokens/semantic.dark.json`, `tokens/semantic.light.json`) resolvido pelo
Style Dictionary.

```json
{
  "primitive": {
    "charcoal": { "900": { "$type": "color", "$value": "#17120D" } },
    "orange":   { "500": { "$type": "color", "$value": "#FF6A2B" },
                  "700": { "$type": "color", "$value": "#C2410C" } },
    "green":    { "500": { "$type": "color", "$value": "#3DDC6B" },
                  "700": { "$type": "color", "$value": "#1E7A3A" } },
    "yellow":   { "500": { "$type": "color", "$value": "#F7C948" },
                  "700": { "$type": "color", "$value": "#8B6B00" } },
    "blue":     { "500": { "$type": "color", "$value": "#4A93FF" },
                  "700": { "$type": "color", "$value": "#1D5FCC" } },
    "amber":    { "500": { "$type": "color", "$value": "#FF9F1C" },
                  "700": { "$type": "color", "$value": "#A85200" } },
    "red":      { "500": { "$type": "color", "$value": "#FF4D4D" },
                  "700": { "$type": "color", "$value": "#C5221F" } },
    "ink":      { "900": { "$type": "color", "$value": "#0C0A07" } },
    "sand":     { "200": { "$type": "color", "$value": "#D6D0C8" } }
  }
}
```

`tokens/semantic.dark.json` (o `.light.json` troca `500` → `700` e remove o anel do PRETO):

```json
{
  "category": {
    "person":      { "fg": { "$type": "color", "$value": "{primitive.green.500}" },  "glyph": { "$type": "string", "$value": "diamond" } },
    "press":       { "fg": { "$type": "color", "$value": "{primitive.yellow.500}" }, "glyph": { "$type": "string", "$value": "star" } },
    "marketing":   { "fg": { "$type": "color", "$value": "{primitive.blue.500}" },   "glyph": { "$type": "string", "$value": "triangle" } },
    "community":   { "fg": { "$type": "color", "$value": "{primitive.amber.500}" },  "glyph": { "$type": "string", "$value": "hexagon" } },
    "institution": { "fg": { "$type": "color", "$value": "{primitive.red.500}" },    "glyph": { "$type": "string", "$value": "rectangle" } },
    "special":     { "fg": { "$type": "color", "$value": "{primitive.ink.900}" },
                     "ring": { "$type": "color", "$value": "{primitive.sand.200}", "$description": "Obrigatório no tema escuro (1,06:1 sem anel)" },
                     "glyph": { "$type": "string", "$value": "double-circle" } }
  },
  "rating": {
    "safe":      { "bg": { "$type": "color", "$value": "{primitive.green.700}" }, "fg": { "$type": "color", "$value": "#FFFFFF" } },
    "18plus":    { "bg": { "$type": "color", "$value": "{primitive.red.700}" },   "fg": { "$type": "color", "$value": "#FFFFFF" } }
  },
  "action": {
    "primary": { "bg": { "$type": "color", "$value": "{primitive.orange.500}" },
                 "fg": { "$type": "color", "$value": "{primitive.charcoal.900}", "$description": "6,51:1 — branco reprova (2,86:1)" } }
  },
  "rarity": {
    "common":  { "border": { "$type": "border", "$value": { "color": "#2A2F36", "width": "1px", "style": "solid" } } },
    "mythic":  { "border": { "$type": "border", "$value": { "color": "{primitive.orange.500}", "width": "2px", "style": "solid" } } }
  }
}
```

Relação com o backend: `category.*` ↔ `UserCategoryEnum` (o enum já expõe `hexColor` e `label`;
adicionar `glyph`); `rating.*` ↔ `ageRating` do post; `content.border.*` ↔ `FeedType`/`mediaType`.

## 6. Componentes-chave

Anatomia numerada de cada card (partes, dado da API e regra): [TAXONOMIA_ATORES_E_CARDS.md §5](TAXONOMIA_ATORES_E_CARDS.md#5-anatomia-dos-cards).

| Componente | Regras |
|---|---|
| **TopBar + Segmented Switcher** | 4 abas (Profile · Post · Audio · Alert), `role="tablist"`, navegação por setas, estado persistido; transição com layout animation |
| **FeedCard** | bolinha (cor + glifo + `aria-label`), borda por tipo, chip de classificação, título obrigatório, subtítulo opcional, ações, indicador de trending (🔥 📈 ➖ 📉) discreto; foto + nome do autor = um link para o perfil (RF25); data relativa em `<time datetime>` com a absoluta no `title`; toque no card abre o PostModal |
| **PostModal** (RF24) | sheet de 92 % da altura, `role="dialog"` + `aria-modal`, foco no "Fechar", `Esc` fecha e devolve o foco ao card; autor em destaque, mídia, texto completo, "Publicado em {data absoluta}" + relativo, contagens por extenso e as 4 ações com rótulo |
| **CommentsSheet / ShareSheet** (RF26) | caixa de mensagens com lista, apagar o próprio comentário e campo com contador 0/2.000; folha com prévia do link, Copiar link, WhatsApp, Telegram, X, e-mail e "Mais opções" (Web Share API) |
| **AudioCard** | waveform pré-computado (JSON de ~1.000 picos), play/pause acessível, duração, categoria do autor |
| **AlertCard** | faixa hazard, fonte verificada visível, validade (`expires` do CAP), nunca sensacionalista; variante "vaga" |
| **FilterBar** | 6 chips combináveis (Categoria, Tipo, Local, País, Cidade, Nome), "limpar filtros", estado na URL |
| **Settings LGPD** | Radix Switch / `accessibilityRole="switch"`; cada controle mostra o artigo da LGPD; "Excluir conta" em `AlertDialog` com reautenticação; "Exportar dados" com status do job |

Matriz de testes visuais: 6 categorias × 2 temas × 6 chips de classificação.

## 7. Ícones

Um só estilo para tudo que não é glifo de categoria: **Lucide** (ISC), versão fixada (`lucide-react` /
`lucide-react-native`; no protótipo, caminhos copiados de `lucide-static@0.460.0`). Nada de ícones
desenhados à mão "parecidos com Lucide": eles divergem no traço e nos cantos e quebram a consistência.

| Regra | Valor |
|---|---|
| Grade / traço | 24 × 24, `stroke-width` 2, pontas e junções arredondadas, `fill="none"` |
| Tamanhos | `icon.size.md` 18 px (topbar, tab bar) · `sm` 14 px (ações do card, abas) · `xs` 12 px (chips, selos) |
| Cor | `currentColor`, herdando o texto; estado ativo usa `--brand` **e** muda a forma (ex.: coração preenchido) |
| Preenchido | só para estado (curtido, salvo) e para play/pause |
| Acessibilidade | decorativo → `aria-hidden`; ícone sozinho em controle → `<button>` com `aria-label` por extenso |
| Glifos de categoria | **não** são Lucide: losango, estrela, triângulo, hexágono, retângulo e círculo duplo (§4) |

**Um ícone, um significado** — ações do card:

| Ação | Ícone Lucide | Contagem visível | Observação |
|---|---|---|---|
| Curtir | `heart` (preenchido quando ativo) | sim | |
| Comentar | `message-circle` | sim | abre a caixa de comentários |
| Compartilhar | `share-2` | sim | abre a folha de compartilhamento (Web Share API / nativa) |
| Repostar | `repeat-2` | sim | só se o produto tiver repost; não usar `repeat` para "compartilhar" |
| Salvar | `bookmark` (preenchido quando ativo) | não (privado) | |
| Trending | `flame` · `trending-up` · `minus` · `trending-down` | texto ao lado | indicador, não botão |

Alerta oficial (Alert Feed) tem **só compartilhar**: sem curtidas nem comentários, para não premiar
sensacionalismo. Card de áudio e vaga têm as quatro ações.

Implementado no protótipo ([RF26](rf/RF26-interacoes-post.md)): ações são `<button>` com contagem,
`aria-label` com o número por extenso e `aria-pressed` em curtir/salvar; comentar abre a caixa de
mensagens e compartilhar abre a folha de compartilhamento.

## 8. Marca

Logo principal: **a laranja "OS" no centro de uma rede de usuários**, com os nós nas 6 cores de categoria
(§3; PRETO aparece em cinza `#7A7570` para ser visível no disco). Arquivos em `design/brand/`, gerados por
`python3 design/brand/build_logo.py` (recriação vetorial da arte de referência):

| Arquivo | Uso |
|---|---|
| `orange-social-logo.svg` | logo completo — splash, login, loja de apps, materiais, cabeçalhos ≥ 48 px |
| `orange-social-mark.svg` | só a laranja — topbar, favicon, ícone de notificação, avatar oficial, < 48 px |

- **Tamanho mínimo:** logo completo 48 px; abaixo disso a rede vira ruído e usa-se o mark (mínimo 16 px).
- **Área de proteção:** ¼ do diâmetro em volta do disco; nada de texto ou borda dentro dela.
- **Fundo:** funciona sobre `#17120D`, branco e laranja da marca; nunca sobre foto sem véu escuro.
- **Não fazer:** recolorir os nós fora da paleta de categorias, esticar, girar, trocar "OS" por outra
  sigla, aplicar sombra/brilho extra, usar a rede sem a laranja.
- **Assinatura:** mark + "orange." em Bricolage Grotesque 800, ponto em `--brand-text`.
- A arte raster original deve ficar versionada como `design/brand/orange-social-logo-original.png` para
  referência; os SVGs são a fonte para produção.

Tela de referência: `design/prototype/screens/08-marca.png`.

## 9. Referências

- [DTCG 2025.10 — primeira versão estável](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/) · [Format Module](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)
- [Style Dictionary v5 + DTCG](https://help.zeroheight.com/hc/en-us/articles/48049028236187) · [Terrazzo: importar do Figma](https://terrazzo.app/docs/guides/import-from-figma)
- [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55) · [NativeWind v5](https://www.nativewind.dev/v5/customization/configuration) · [gluestack-ui v5](https://gluestack.io/blogs/gluestack-ui-v5-alpha-release)
- [FlashList v2](https://shopify.engineering/flashlist-v2) · [Storybook 10](https://storybook.js.org/releases/10.0)
- [Lucide](https://lucide.dev) (ISC) — guia de design dos ícones: grade 24, traço 2
- WCAG 2.x: 1.4.1 (uso da cor), 1.4.3 (contraste mínimo), 1.4.11 (contraste não textual). APCA é informativo (rascunho WCAG 3).
