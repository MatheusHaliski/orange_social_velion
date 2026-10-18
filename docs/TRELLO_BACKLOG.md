# Trello Backlog — Orange Social

Fonte do quadro **[Orange Social - Velion Tech](https://trello.com/b/ImdiBMps/orange-social-velion-tech)** no Trello.
Atualizado em 17/10/2026 após a pesquisa de tecnologias ([`PESQUISA_TECNOLOGIAS.md`](PESQUISA_TECNOLOGIAS.md)).

> **Estado no Trello (17/10/2026):** 6 listas, 62 cards e etiquetas de cor aplicados via API.
> As etiquetas foram criadas sem nome (limitação da API usada) — nomeie-as no quadro conforme a
> tabela abaixo. Cards OS-01 → OS-08 estão em *Current Sprint*; OS-02 em *Done*; os demais em *Backlog*.

## Listas (da esquerda para a direita)

| # | Lista | Critério de entrada |
|---|---|---|
| 1 | **Backlog** | Card criado, com descrição e etiqueta |
| 2 | **Current Sprint** | Priorizado no planejamento da sprint (2 semanas) |
| 3 | **In Progress** | Responsável atribuído e branch criada |
| 4 | **Code Review / PR** | PR aberto no GitHub, CI verde |
| 5 | **QA & LGPD Check** | PR aprovado; aguarda testes e checklist LGPD |
| 6 | **Done** | Merge na `main` e checklist LGPD completo |

## Etiquetas

| Etiqueta | Cor Trello | Escopo |
|---|---|---|
| 🟢 Auth & Cadastro | `green` | `VSusercontrolist`, RF1, RF2 |
| 🔵 Backend & Persistência | `blue` | Spring Boot, PostgreSQL, Valkey, Cassandra, S3, Kafka, OpenSearch |
| 🟠 UI/UX & Feed Cards | `orange` | Tokens, componentes, feeds, acessibilidade |
| 🔴 LGPD & Segurança | `red` | RF23, consentimento, direitos do titular, ECA Digital |
| 🟣 Ecossistema Velion | `purple` | FriendlyEats, Sports, Points, Trophies, Post |

## Checklist padrão "LGPD Check" (anexar a todo card que trata dado pessoal)

- [ ] Base legal identificada (Art. 7º ou Art. 11) e registrada no inventário (Art. 37)
- [ ] Campo novo documentado no mapeamento de dados e no RIPD
- [ ] Padrão desligado para tratamentos opcionais (Privacy by Default)
- [ ] Dado sensível cifrado com a DEK do usuário (crypto-shredding)
- [ ] Dado incluído na exportação JSON (Art. 18, V)
- [ ] Dado coberto pela saga de eliminação (Art. 18, VI) em PostgreSQL, Valkey, Cassandra e S3
- [ ] Logs não registram o dado em texto puro
- [ ] Comportamento definido para conta de menor (ECA Digital)

---

## Cards

Formato: **ID · Título** — etiqueta · estimativa (pontos) · critérios de aceite.
Cards marcados com **(novo)** vieram da pesquisa de tecnologias.

### Sprint 0 — Fundação (Current Sprint)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-01 | Estrutura do repositório, Maven, **Spring Boot 4.1 / Java 25** | 🔵 | 3 | `mvn test` verde; pacotes `domain`, `infrastructure`, `config`; virtual threads ligadas; CI com JDK 25 |
| OS-02 | Documentação UML em Mermaid (`docs/`) | 🔵 | 3 | 5 diagramas: classes, estados, componentes, sequência, atividades |
| OS-03 | Docker Compose local: **PostgreSQL 17 + PostGIS, Valkey 9, Cassandra 5, Garage** | 🔵 | 3 | ✅ `docker-compose.yml` + `infra/garage/`; Cassandra no profile `full`; falta validar em máquina com Docker |
| OS-04 | Pipeline CI no GitHub Actions | 🔵 🔴 | 3 | ✅ `ci.yml` (verify JDK 21+25, Gitleaks, Trivy fs + imagem Jib, SBOM), `codeql.yml`, `dependabot.yml`; Code scanning ativo e recebendo CodeQL + SARIF do Trivy (CI #8 verde). **Ainda manual no GitHub:** Secret scanning + Push protection, Dependabot alerts e proteção da `main` exigindo os checks `Build & test (JDK 21)`, `Build & test (JDK 25)`, `Gitleaks`, `Trivy (dependências e config)`, `Imagem OCI (Jib) + Trivy`, `Analyze (java-kotlin)`, `Analyze (actions)` |
| OS-05 | Migrações versionadas (Flyway) a partir de `schema.sql` | 🔵 | 2 | ✅ `V1__baseline.sql` aplicado pelo Flyway e `ddl-auto=validate` verde contra PostGIS real (`UserControlListRepositoryIT`) |
| OS-06 | Testes de integração com Testcontainers 2.0 (PostGIS, Valkey, Cassandra) | 🔵 | 3 | ✅ `PolyglotContainers` + 3 classes `*IT` rodando em `mvn verify` (failsafe); unitários continuam em `mvn test` |
| OS-07 **(novo)** | Spring Modulith 2.x: módulos `profile`, `post`, `audio`, `alert`, `trending`, `filter`, `lgpd`, `velion` | 🔵 | 5 | Teste de fronteiras (ArchUnit) verde; Event Publication Registry como outbox no MVP |
| OS-08 **(novo)** | IaC em OpenTofu: VPC, ECS Fargate, RDS PostgreSQL, ElastiCache Valkey, S3 (sa-east-1) | 🔵 | 8 | `tofu plan` limpo em `dev`; state em S3 com locking; contas separadas por ambiente |

### Autenticação & Cadastro (Backlog)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-10 | Entidade `UserControlList` + repositório JPA (19 campos) | 🟢 🔵 | 3 | Mapeamento validado com `ddl-auto=validate` no PostgreSQL |
| OS-11 | RF1 — Endpoint de cadastro `POST /api/v1/users` | 🟢 | 5 | E-mail único, senha forte, **Argon2id**, status `PENDING_VERIFICATION` |
| OS-12 | Verificação de e-mail/SMS e ativação da conta | 🟢 | 3 | Código expira em 7 dias; transição para `ACTIVE`; cadastro não confirmado é eliminado |
| OS-13 | **Keycloak 26** + sessões opacas no Valkey + passkeys | 🟢 🔴 | 8 | Login com passkey e senha; TOTP; logout revoga sessão imediatamente; JWT ≤ 5 min só entre serviços |
| OS-14 | RF2 — Edição de perfil (Art. 18, III) | 🟢 🔴 | 3 | Todos os campos editáveis; histórico de alteração no `activity_log` |
| OS-15 | Seleção encadeada typeofcommunity → selectcountry → selectcity | 🟢 🟠 | 5 | Listas filtradas pelo item anterior; grava `Listofcommunitiesofinterest` |
| OS-16 | Captura de GPS `LastSavedLocation` com consentimento | 🟢 🔴 | 3 | Sem consentimento não grava; JSONB `{lat,lng,timestamp}`; `last_saved_point` gerado pelo PostGIS |
| OS-17 | Fluxo de cadastro por Usertype (6 categorias) | 🟢 🟠 | 5 | Campos específicos por categoria; VERMELHO/PRETO com verificação manual |
| OS-18 | Upload de foto de perfil via URL pré-assinada S3 | 🟢 🔵 | 3 | Banco guarda só a chave do objeto; EXIF/GPS removidos. Reaproveita `MediaStorage` e `ImageSanitizer` do OS-23 |
| OS-19 **(novo)** | Step-up de autenticação (`max_age`/`acr`) para Exportar e Excluir | 🟢 🔴 | 3 | Ações sensíveis exigem reautenticação recente |

### Backend & Persistência Poliglota (Backlog)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-20 | `TrendingScoreRepository` (Valkey ZSET) | 🔵 | 3 | Ranking global e por cor; TTL 48h |
| OS-21 | Trending Score com decaimento temporal e anti-manipulação | 🔵 | 5 | ✅ fórmula `log10(views)·W + Σ pesos / (idade_h + 2)^1.6` em `TrendingScoreCalculator`; pendente: HyperLogLog de views únicas, tempo mínimo de exibição, z-score e job de recálculo |
| OS-22 | `PostTimelineEntity` + fan-out **híbrido** no Cassandra | 🔵 | 8 | On write para < 10k seguidores; merge na leitura (`author_posts`) para contas grandes; inativos > 30 dias sem fan-out |
| OS-23 | Publicação de post (texto/imagem/vídeo) — [RF29](rf/RF29-publicar-post.md) | 🔵 | 5 | ✅ texto: `POST/PATCH/DELETE /api/v1/posts`, arquivar/restaurar, conta ativa + selo, 422 com todos os erros; ✅ foto: `POST /api/v1/media/uploads` (URL pré-assinada, tipo e tamanho na assinatura), `HEAD` no S3, foto limpa sem EXIF/GPS (orientação aplicada, até 2.048 px), apagar o post apaga a foto; ⏳ vídeo, rascunho, AVIF/WebP + miniaturas, moderação da imagem |
| OS-24 | Publicação no Audio Feed (podcast, áudio pessoal, música) | 🔵 | 5 | Conforme `DIAGRAMA_SEQUENCIA.md`; waveform pré-computado (`audiowaveform`) |
| OS-25 | Alert Feed **geográfico**: restrito a fontes verificadas | 🔵 🔴 | 8 | Somente VERMELHO verificado; consulta por geohash/município IBGE; sem timeline por seguidor; vagas para VERMELHO/AMARELO |
| OS-26 | Filtro multidimensional (6 eixos) nos 4 feeds via PostgreSQL | 🔵 | 8 | Categoria, tipo, local (PostGIS `ST_DWithin`), país, cidade, nome (`pg_trgm` + `unaccent`) combináveis |
| OS-27 | Notificações em Cassandra com TTL | 🔵 | 3 | Lidas/não lidas; TTL 30 dias |
| OS-28 | Outbox transacional + **Kafka 4 + Debezium** | 🔵 | 8 | Tabela `outbox_event`; tópicos por agregado; consumidores idempotentes; nunca dual-write |
| OS-29 **(novo)** | OpenSearch para busca e facetas (escala) | 🔵 | 8 | Índices `users`/`posts` alimentados por CDC; `geo_point`; `edge_ngram` + `asciifolding` |
| OS-2A **(novo)** | Pipeline de mídia: libvips (AVIF/WebP), FFmpeg áudio HLS, `VideoProvider` (Stream/Mux) | 🔵 | 8 | `media.uploaded` → processamento → moderação → publicação |
| OS-2B **(novo)** | Tempo real: SSE + Valkey Pub/Sub; push FCM/APNs; ingestão CAP 1.2 | 🔵 | 8 | p99 criação→push ≤ 5 s; solicitar entitlement Critical Alerts; confirmar acesso à IDAP/MIDR |
| OS-2C **(novo)** | Observabilidade: Micrometer + OpenTelemetry → Grafana Cloud; SLOs do Alert Feed | 🔵 | 5 | Traces/métricas/logs sem PII; alertas por burn-rate; canário sintético |

### UI/UX, Tokens e Feed Cards (Backlog)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-30 | Design tokens DTCG 2025.10 → Style Dictionary 5 (`packages/tokens`) | 🟠 | 5 | Variáveis CSS/`@theme` e objeto TS gerados; temas claro e escuro |
| OS-31 | TopBar com Segmented Switcher (Profile/Post/Audio/Alert) | 🟠 | 5 | `role="tablist"`, navegação por teclado; estado persistido |
| OS-32 | Componente Feed Card (bolinha + glifo + borda + classificação) | 🟠 | 5 | Título obrigatório, sem texto corrido no feed; `aria-label` da categoria |
| OS-33 | Card de áudio com waveform e player | 🟠 | 5 | Play/pause, duração, acessível; `expo-audio` no mobile |
| OS-34 | Card de alerta (hazard) e card de vaga | 🟠 | 3 | Fonte verificada e validade visíveis; sem sensacionalismo |
| OS-35 | Barra de filtros dos 6 eixos | 🟠 | 5 | Chips combináveis; limpar filtros; estado na URL |
| OS-36 | Indicadores de trending (🔥 📈 ➖ 📉) | 🟠 | 2 | Nunca competem com o título |
| OS-37 | Acessibilidade: cor nunca é o único sinal (WCAG 1.4.1 / 1.4.11) | 🟠 🔴 | 3 | Glifo + rótulo por categoria; `scripts/wcag_contrast.py` sem reprovação |
| OS-38 **(novo)** | Paleta para tema claro e correção do PRETO no tema escuro | 🟠 | 3 | Variantes `700` no tema claro; anel `#D6D0C8` + glifo no PRETO; texto escuro nos botões Orange |
| OS-39 **(novo)** | Monorepo Turborepo: Next.js 16 (web) + Expo 58 (mobile) + `packages/api` gerado do OpenAPI | 🟠 🔵 | 8 | `apps/web`, `apps/mobile`, pacotes compartilhados; Storybook 10 + axe no CI |
| OS-3A **(novo)** | Glifos VSL completos (losango, estrela, triângulo, hexágono, retângulo, círculo duplo) | 🟠 | 3 | SVG em `packages/glyphs`; SVGR e `react-native-svg` |

### LGPD Compliance & Segurança — RF23 (Backlog)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-40 | `consent_event` append-only + API de consentimentos (Art. 7º, I) | 🔴 | 5 | Toggles desligados por padrão; versão do texto, canal e IP com hash; view `user_consent_current` |
| OS-41 | Revogação de consentimento em 1 clique (Art. 8º, §5º) | 🔴 | 2 | Revogar é o mesmo controle que consentir; efeito imediato via evento |
| OS-42 | Reconhecimento facial **on-device**, desligado por padrão (Art. 11) | 🔴 | 5 | Consentimento específico e destacado; template nunca sai do aparelho; bloqueado para menores |
| OS-43 | Exportar meus dados em JSON (Art. 18, V) | 🔴 | 5 | Step-up; job assíncrono; ZIP cifrado; URL pré-assinada 24–72 h; 1 pedido/dia |
| OS-44 | Excluir conta — saga idempotente (Art. 18, VI) | 🔴 | 8 | Reautenticar → carência → revogar sessões → anonimizar PostgreSQL → Cassandra → S3 → **destruir DEK** → recibo; reconciliação diária |
| OS-45 | Trilha de auditoria de operações (Art. 37) | 🔴 | 3 | Eventos com encadeamento de hash em S3 Object Lock; sem PII em claro |
| OS-46 | Criptografia de campo com **Tink + KMS, DEK por usuário** | 🔴 | 8 | `sexual_preference`, `last_saved_location`, `address`, `cellphone_number`, foto cifrados; `user_id` como dado associado; tabela `user_key` |
| OS-47 | Rate limiting (Bucket4j + Valkey) e proteção contra força bruta | 🔴 | 3 | Por IP, usuário e rota; mais rígido em login, cadastro, recuperação e exportação |
| OS-48 | Página de configurações LGPD (Conta, Privacidade, Seus dados) | 🔴 🟠 | 5 | Cada controle mapeado ao artigo; `AlertDialog` acessível para excluir |
| OS-49 **(novo)** | **ECA Digital**: aferição de idade e modo restrito para menores | 🔴 🟢 | 8 | Sem perfilamento, geolocalização ou publicidade direcionada para menores; supervisão parental; sem biometria |
| OS-4A **(novo)** | Registro de operações (Art. 37) e **RIPD** versionados no repositório | 🔴 | 5 | YAML com finalidade, base legal, categorias, retenção, operadores, transferências; RIPD aprovado antes do lançamento |
| OS-4B **(novo)** | OWASP ASVS 5.0 nível 2 (nível 3 em auth e dados sensíveis) + WAF | 🔴 | 5 | Checklist ASVS no PR template; AWS WAF/Cloudflare com regras gerenciadas |
| OS-4C **(novo)** | Backups em sa-east-1 com Vault Lock; política de retenção ≤ 35 dias; reaplicar exclusões após restore | 🔴 🔵 | 3 | RPO ≤ 5 min, RTO ≤ 4 h; restore testado por trimestre |
| OS-4D **(novo)** | Moderação automatizada (texto, imagem, áudio) + hash CSAM | 🔴 🔵 | 8 | Pipeline via Kafka; score alto bloqueia, médio vai para fila humana; logs de decisão para apelação |

### Posts: detalhe, perfil do autor e interações — RF24 · RF25 · RF26 (auditoria 17/10/2026)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-56 | RF24 — Modal do post com dados completos e data de publicação | 🔵 🟠 | 5 | ✅ `GET /api/v1/posts/{id}` (rascunho só para o autor, removido/autor suspenso = 404), `PostApiIT`, protótipo `09-post-modal`; data relativa no card com `<time>` + tooltip absoluto; modal acessível (foco preso, `Esc`); pendente no app (OS-39) |
| OS-57 | RF25 — Perfil público do autor + feed dele (toque na foto ou no nome) | 🔵 🟠 🔴 | 5 | ✅ `GET /api/v1/users/{id}/profile` com minimização LGPD e `GET …/posts` com cursor; protótipo `10-perfil-autor`; conta suspensa/eliminada sem link |
| OS-58 | RF26 — Curtir, comentar (caixa de mensagens), compartilhar e salvar com contagem | 🔵 🟠 | 8 | ✅ tabelas `post_reaction`/`post_comment`/`post_share` (V2), contadores atômicos e idempotentes, 401/403/409, protótipo `11-comentarios` e `12-compartilhar`; botões `<button>` com `aria-label`/`aria-pressed` |
| OS-59 | RF26 — Interações em tempo real, notificação ao autor, moderação e limites | 🔵 🔴 | 8 | Contadores via SSE (OS-2B); notificação LIKE/COMMENT (OS-27); comentários na moderação (OS-4D); rate limit por usuário/rota (OS-47) |

### Conta, sessão, configurações e exclusão — RF1 · RF2 · RF23 · RF27 (17/10/2026)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-60 | RF1 — Cadastro com escolha do tipo de usuário, campos por tipo e aceite dos Termos de Uso da Velion | 🟢 🔴 | 8 | ✅ API `POST /api/v1/auth/register` (CNPJ alfanumérico, idade 13+/16/18, 6 consentimentos false, `terms_acceptance`), verificação de e-mail; `docs/legal/TERMOS_DE_USO.md` com `{{marcadores}}` para preencher; ⏳ telas e revisão jurídica |
| OS-61 | RF27 — Login em etapas, sessão opaca no Valkey, CSRF, limites, sessões ativas e 2FA TOTP | 🟢 🔴 🔵 | 8 | ✅ cookie sem Max-Age (aba anônima deslogada), logout no servidor, 60 min/24 h, 10 códigos de recuperação, anti-replay; `AuthApiIT` |
| OS-62 | RF27 — Passkeys (WebAuthn) e "lembrar este navegador por 30 dias" | 🟢 🔴 | 5 | Passkey como 1º fator; dispositivo confiável revogável na lista de sessões |
| OS-63 | RF2 — Configurações (9 seções) e fundo do app (liso, rede, 6 mosaicos com o logo oficial) | 🟠 🟢 | 5 | ✅ API de perfil e preferências; menor de 16 com proteções travadas; ⏳ telas |
| OS-64 | RF23 — Excluir conta: modal de consequências, 30 dias para reativar e job de eliminação | 🔴 | 5 | ✅ `POST /api/v1/me/deletion`, reativação no login, `AccountDeletionJob`; ⏳ modal no app, passos S3/Cassandra/DEK (OS-44) |

### Background Studio — moldura dos cards e Aura Plus (pesquisa 17/10/2026)

Detalhes em [`PESQUISA_BACKGROUND_STUDIO.md`](PESQUISA_BACKGROUND_STUDIO.md) e no [RF28](rf/RF28-moldura-post.md). Depende de OS-23
(publicar post). ✅ Protótipo navegável (telas 22–28), Aura Plus "Brasa" e "Aurora" no formato final e teste de fumaça.

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-65 | Moldura do post: `post.background` JSONB (só ids), validação no servidor e leitura resolvida | 🔵 🟠 | 5 | ✅ V4 (coluna + CHECKs); ids conferidos contra o catálogo; sem CSS/URL livre; `ALERT` recusa; contraste tinta × container ≥ 4,5:1 senão 422; moldura resolvida no detalhe e no feed; ⏳ `background_asset` (OS-70) |
| OS-66 | Catálogo procedural: `GET /api/v1/backgrounds/catalog` (público, ETag) | 🟠 🔵 | 5 | ✅ catálogo com versão por hash, ETag/304 e recomendações; Cor lisa, gradientes, 12 auras estáticas (8 já no catálogo), 4 materiais; proveniência e licença por item; tela "Créditos e licenças"; tokens web + Skia |
| OS-67 | Cartela sazonal automática (Hemisfério Sul) | 🟠 | 3 | ✅ `SeasonalCalendar` testado (2026–2028); 12 cartelas; janelas `[início, fim)` em America/Sao_Paulo; Carnaval = Páscoa − 47; prioridades; Black Friday opt-in; variação por UF |
| OS-68 | Aura Hype conquistada + Metamorfose (Prisma, Constelação, Fio Vivo, Holografia) | 🟠 | 5 | Hype só com post em alta e texto "Em alta"; animação ≤ 5 s, só cards visíveis, orçamento por aparelho; estático com `reduceMotion` |
| OS-69 | **Aura Plus**: arte animada em vídeo (H.264/AV1) + pôster, nunca GIF | 🟠 🔵 🔴 | 8 | Pipeline ffprobe → ffmpeg → EA IRIS → moderação → variantes ≤ 25/150/400 KB; preferência "Animações de fundo" (Só no Wi-Fi); Pouca Energia → pôster |
| OS-70 | Arte própria: upload e geração por IA com moderação | 🔴 🟠 | 8 | 16+; quarentena; selo "Gerada por IA"; hash perceptual; notificação de direito autoral; sem GIPHY/Tenor |
| OS-71 | Layouts e skins (bento, polaroid, revista, tela cheia) para post, story, perfil e destaque | 🟠 | 8 | Atualiza RF24/RF25 e anatomia; layout com arte própria desliga a aba Aura com explicação |
| OS-72 | Parecer jurídico do Background Studio | 🔴 | 2 | Itens da §8: licenças de stock, IA, retirada por direito autoral, STF art. 19, marcas parceiras |

### Ecossistema Velion (Backlog)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-50 | Velion Points: carteira, crédito e débito | 🟣 | 5 | Saldo ACID no PostgreSQL; extrato |
| OS-51 | Velion Trophies: conquistas e raridade (Common → Mythic) | 🟣 | 5 | Regras de concessão por evento; selo textual além da borda |
| OS-52 | Velion Post: publicação cruzada entre apps | 🟣 | 5 | Post de outro app aparece no feed correto |
| OS-53 | Velion FriendlyEats: integração de perfil e avaliações | 🟣 | 8 | SSO via Keycloak e card de restaurante no Post Feed |
| OS-54 | Velion Sports: comunidades de clubes (LARANJA) | 🟣 | 5 | Clubes como comunidades selecionáveis |
| OS-55 | Contrato de API entre módulos Velion (OpenAPI) | 🟣 🔵 | 3 | Especificação versionada; `packages/api` gerado a partir dela |

---

## Ordem sugerida das sprints

1. **Sprint 0:** OS-01 → OS-08
2. **Sprint 1:** OS-10, OS-11, OS-12, OS-13, OS-40, OS-46, OS-30, OS-60, OS-61, OS-63, OS-64
3. **Sprint 2:** OS-14, OS-15, OS-16, OS-17, OS-18, OS-19, OS-41, OS-49, OS-31, OS-32, OS-38
4. **Sprint 3:** OS-20, OS-21, OS-22, OS-23, OS-24, OS-28, OS-33, OS-3A, OS-56, OS-57, OS-58
5. **Sprint 4:** OS-25, OS-26, OS-27, OS-2B, OS-34, OS-35, OS-36, OS-37, OS-59
6. **Sprint 5:** OS-43, OS-44, OS-45, OS-47, OS-48, OS-4A, OS-4B, OS-4C
7. **Sprint 6:** OS-2A, OS-2C, OS-4D, OS-42, OS-39
8. **Sprint 7+:** OS-29, OS-50 → OS-55
