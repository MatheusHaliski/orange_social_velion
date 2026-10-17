# Trello Backlog — Orange Social

Plano de montagem do quadro **Orange Social · Engenharia** no Trello.

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
| 🔵 Backend & Persistência | `blue` | Spring Boot, MySQL, Redis, Cassandra, S3 |
| 🟠 UI/UX & Feed Cards | `orange` | Tokens CSS, componentes, feeds |
| 🔴 LGPD & Segurança | `red` | RF23, consentimento, direitos do titular |
| 🟣 Ecossistema Velion | `purple` | FriendlyEats, Sports, Points, Trophies, Post |

## Checklist padrão "LGPD Check" (anexar a todo card que trata dado pessoal)

- [ ] Base legal identificada (Art. 7º ou Art. 11)
- [ ] Campo novo documentado no mapeamento de dados
- [ ] Padrão desligado para tratamentos opcionais (Privacy by Default)
- [ ] Dado incluído na exportação JSON (Art. 18, V)
- [ ] Dado coberto pelo fluxo de eliminação (Art. 18, VI) em MySQL, Redis, Cassandra e S3
- [ ] Logs não registram o dado em texto puro

---

## Cards

Formato: **ID · Título** — etiqueta · estimativa (pontos) · lista inicial.

### Sprint 0 — Fundação (Current Sprint)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-01 | Estrutura do repositório, Maven e Spring Boot 3.5 / Java 21 | 🔵 | 2 | `mvn test` verde; pacotes `domain`, `infrastructure`, `config` |
| OS-02 | Documentação UML em Mermaid (`docs/`) | 🔵 | 3 | 5 diagramas: classes, estados, componentes, sequência, atividades |
| OS-03 | Docker Compose local: MySQL 8, Redis, Cassandra, MinIO | 🔵 | 3 | `docker compose up` sobe os 4 serviços com healthcheck |
| OS-04 | Pipeline CI no GitHub Actions (build, testes, análise de dependências) | 🔵 | 2 | PR bloqueado se o CI falhar |
| OS-05 | Migrações versionadas (Flyway) a partir de `schema.sql` | 🔵 | 2 | `V1__vsusercontrolist.sql` aplicado no boot |
| OS-06 | Testes de integração com Testcontainers (MySQL, Redis, Cassandra) | 🔵 | 3 | Repositórios testados contra containers reais |

### Autenticação & Cadastro (Backlog)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-10 | Entidade `UserControlList` + repositório JPA (19 campos) | 🟢 🔵 | 3 | Mapeamento validado com `ddl-auto=validate` |
| OS-11 | RF1 — Endpoint de cadastro `POST /api/v1/users` | 🟢 | 5 | Valida e-mail único, senha forte, status `PENDING_VERIFICATION` |
| OS-12 | Verificação de e-mail/SMS e ativação da conta | 🟢 | 3 | Código expira; transição para `ACTIVE` |
| OS-13 | Login com JWT + refresh token + sessões no Redis | 🟢 🔴 | 5 | Logout revoga o token; sessão com TTL |
| OS-14 | RF2 — Edição de perfil (Art. 18, III) | 🟢 🔴 | 3 | Todos os campos editáveis; histórico de alteração no `activity_log` |
| OS-15 | Seleção encadeada typeofcommunity → selectcountry → selectcity | 🟢 🟠 | 5 | Listas filtradas pelo item anterior; grava `Listofcommunitiesofinterest` |
| OS-16 | Captura de GPS `LastSavedLocation` com consentimento | 🟢 🔴 | 3 | Sem consentimento não grava; JSON `{lat,lng,timestamp}` |
| OS-17 | Fluxo de cadastro por Usertype (6 categorias) | 🟢 🟠 | 5 | Campos específicos por categoria; VERMELHO/PRETO com verificação manual |
| OS-18 | Upload de foto de perfil via URL pré-assinada S3 | 🟢 🔵 | 3 | Banco guarda só a chave do objeto |

### Backend & Persistência Poliglota (Backlog)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-20 | `TrendingScoreRepository` (Redis ZSET) | 🔵 | 3 | Ranking global e por cor; TTL 48h |
| OS-21 | Job de recálculo de *freshness* do Trending Score | 🔵 | 3 | Executa a cada 10 min; não bloqueia escrita |
| OS-22 | `PostTimelineEntity` + fan-out on write no Cassandra | 🔵 | 5 | Partição (owner, feed, dia); escrita após commit no MySQL |
| OS-23 | Publicação de post (texto/imagem/vídeo) | 🔵 | 5 | Estados Draft → Published; mídia validada no S3 |
| OS-24 | Publicação no Audio Feed (podcast, áudio pessoal, música) | 🔵 | 5 | Conforme `DIAGRAMA_SEQUENCIA.md` |
| OS-25 | Alert Feed: publicação restrita a fontes verificadas | 🔵 🔴 | 5 | Somente VERMELHO verificado; vagas para VERMELHO/AMARELO |
| OS-26 | Filtro multidimensional (6 eixos) nos 4 feeds | 🔵 | 8 | Categoria, tipo, local, país, cidade, nome combináveis |
| OS-27 | Notificações em Cassandra com TTL | 🔵 | 3 | Lidas/não lidas; TTL 30 dias |
| OS-28 | Outbox/eventos de domínio para projeções (Redis/Cassandra) | 🔵 | 5 | Reprocessamento idempotente |

### UI/UX, Tokens CSS e Feed Cards (Backlog)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-30 | Design tokens: cores das 6 categorias, Orange, base escura | 🟠 | 3 | Tokens exportados para CSS e mobile |
| OS-31 | TopBar com Segmented Switcher (Profile/Post/Audio/Alert) | 🟠 | 5 | Navegação por teclado; estado persistido |
| OS-32 | Componente Feed Card (bolinha + borda + classificação) | 🟠 | 5 | Título obrigatório, sem texto corrido no feed |
| OS-33 | Card de áudio com waveform e player | 🟠 | 5 | Play/pause, duração, acessível |
| OS-34 | Card de alerta (hazard) e card de vaga | 🟠 | 3 | Destaque visual sem sensacionalismo |
| OS-35 | Barra de filtros dos 6 eixos | 🟠 | 5 | Chips combináveis; limpar filtros |
| OS-36 | Indicadores de trending (🔥 📈 ➖ 📉) | 🟠 | 2 | Nunca competem com o título |
| OS-37 | Acessibilidade: cor nunca é o único sinal (WCAG 1.4.1) | 🟠 🔴 | 3 | Ícone/texto redundante por categoria; contraste AA |

### LGPD Compliance & Segurança — RF23 (Backlog)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-40 | Tabela `user_consent` + API de consentimentos (Art. 7º, I) | 🔴 | 5 | Toggles desligados por padrão; histórico preservado |
| OS-41 | Revogação de consentimento em 1 clique (Art. 8º, §5º) | 🔴 | 2 | Revogar é tão fácil quanto consentir |
| OS-42 | Biometria/reconhecimento facial desligado por padrão (Art. 11) | 🔴 | 3 | Consentimento específico e destacado |
| OS-43 | Exportar meus dados em JSON (Art. 18, V) | 🔴 | 5 | Job assíncrono; link expira; inclui todos os armazenamentos |
| OS-44 | Excluir conta com reautenticação (Art. 18, VI) | 🔴 | 8 | Anonimiza MySQL, apaga S3, Cassandra e Redis; estado terminal |
| OS-45 | Trilha de auditoria de operações (Art. 37) | 🔴 | 3 | Registro em `activity_log` sem dado pessoal em claro |
| OS-46 | Criptografia de campos sensíveis em repouso | 🔴 | 5 | `sexual_preference`, endereço e telefone criptografados |
| OS-47 | Rate limiting e proteção contra força bruta no login | 🔴 | 3 | Bloqueio progressivo; alerta de segurança |
| OS-48 | Página de configurações LGPD (Conta, Privacidade, Seus dados) | 🔴 🟠 | 5 | Cada controle mapeado ao artigo correspondente |

### Ecossistema Velion (Backlog)

| ID | Título | Etiqueta | Pts | Critérios de aceite |
|---|---|---|---|---|
| OS-50 | Velion Points: carteira, crédito e débito | 🟣 | 5 | Saldo ACID no MySQL; extrato |
| OS-51 | Velion Trophies: conquistas e raridade (Common → Mythic) | 🟣 | 5 | Regras de concessão por evento |
| OS-52 | Velion Post: publicação cruzada entre apps | 🟣 | 5 | Post de outro app aparece no feed correto |
| OS-53 | Velion FriendlyEats: integração de perfil e avaliações | 🟣 | 8 | SSO e card de restaurante no Post Feed |
| OS-54 | Velion Sports: comunidades de clubes (LARANJA) | 🟣 | 5 | Clubes como comunidades selecionáveis |
| OS-55 | Contrato de API entre módulos Velion (OpenAPI) | 🟣 🔵 | 3 | Especificação versionada no repositório |

---

## Ordem sugerida das sprints

1. **Sprint 0:** OS-01 → OS-06
2. **Sprint 1:** OS-10, OS-11, OS-12, OS-13, OS-40, OS-30
3. **Sprint 2:** OS-14, OS-15, OS-16, OS-17, OS-18, OS-41, OS-42, OS-31, OS-32
4. **Sprint 3:** OS-20, OS-22, OS-23, OS-24, OS-28, OS-33
5. **Sprint 4:** OS-25, OS-26, OS-27, OS-34, OS-35, OS-36, OS-37
6. **Sprint 5:** OS-43, OS-44, OS-45, OS-46, OS-47, OS-48
7. **Sprint 6+:** OS-21, OS-50 → OS-55
