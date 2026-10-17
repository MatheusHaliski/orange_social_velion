# Pesquisa de Tecnologias — Orange Social

Consolidação de cinco pesquisas paralelas realizadas em **17/10/2026** (backend e persistência;
feeds, busca e mídia; segurança e LGPD; frontend e design system; infraestrutura e custo).
Cada seção é um ADR curto: contexto, opções, decisão e riscos. O design system tem documento
próprio em [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

> Preços, datas de EOL e licenças vêm das fontes listadas no fim de cada seção; os valores
> de custo são estimativas e devem ser confirmados no AWS Pricing Calculator antes de orçar.

---

## 0. Achados urgentes (afetam o que já está no repositório)

| # | Achado | Impacto | Ação |
|---|---|---|---|
| U1 | **Spring Boot 3.5 perdeu suporte OSS em 30/06/2026** (3.5.16 foi a última; Framework 6.2 e Security 6.5 idem). O Maven Central confirma 4.0.8 e 4.1.1 disponíveis. | O `pom.xml` rodava sem correções de segurança públicas | ✅ **Aplicado:** `pom.xml` em **Spring Boot 4.1.1** (`starter-webmvc`), testes verdes. Java 25 LTS é o alvo de CI; local compila com 21 (ADR-01) |
| U2 | **MySQL 8.0 chegou ao EOL em abril/2026** (8.0.46) | O DDL foi escrito "para MySQL 8.0" | ✅ **Aplicado:** migração para **PostgreSQL 17 + PostGIS** (ADR-02) |
| U3 | **MinIO Community foi abandonado** (console removido 06/2025, sem imagens Docker 10/2025, repositório arquivado 02/2026) | `application.yml` e backlog citavam MinIO para dev | ✅ **Aplicado:** Garage em dev (`S3_ENDPOINT` :3900); API S3 genérica em produção (ADR-05) |
| U4 | **ECA Digital (Lei 15.211/2025) em vigor desde 17/03/2026**; ANPD virou agência (Lei 15.352/2026) | Rede social com "provável acesso" por menores: aferição de idade, sem perfilamento de menores, multa até R$ 50 mi | Novos cards no backlog (RF23) e no RIPD (ADR-09) |

---

## ADR-01 · Framework e runtime

| Opção | Prós | Contras |
|---|---|---|
| Boot 3.5 (atual) | Já está no repositório | Sem patches OSS desde 06/2026 |
| **Boot 4.1 (Framework 7)** | OSS até ~07/2027; Modulith 2.x, Jakarta EE 11, Jackson 3; Authorization Server embutido no Security 7 | Quebras na migração (Jackson 3, starters modularizados). A 4.0 perde OSS em 12/2026 |
| Quarkus | Startup rápido, pouca memória, native | Outro ecossistema; Spring Data Cassandra/Redis teriam de ser reescritos |
| Micronaut | AOT, leve | Comunidade menor |

**Decisão:** **Spring Boot 4.1 + Java 25 LTS**, `spring.threads.virtual.enabled=true` (no Java 24+ o
`synchronized` não prende mais a virtual thread — JEP 491). **Spring Modulith 2.x** para separar os
módulos (`profile`, `post`, `audio`, `alert`, `trending`, `filter`, `lgpd`, `velion-*`), com
verificação de fronteiras em teste (ArchUnit) e Event Publication Registry como outbox.
Empacotamento: JVM + AOT cache (Leyden, JDK 25) — não GraalVM native (reflexão nos drivers
Cassandra/AWS SDK e build lento).

Fontes: [Spring Boot 3.5.16 — última OSS](https://spring.io/blog/2026/06/25/spring-boot-3-5-16-available-now/) ·
[HeroDevs: EOL 3.5](https://www.herodevs.com/blog-posts/spring-boot-3-5-is-officially-end-of-life-here-is-what-that-means-for-teams-still-running-it) ·
[Spring Modulith 2.0 GA](https://spring.io/blog/2025/11/21/spring-modulith-2-0-ga-1-4-5-and-1-3-11-released/) ·
[Authorization Server → Security 7](https://spring.io/blog/2025/09/11/spring-authorization-server-moving-to-spring-security-7-0) ·
[CRaC vs Leyden](https://devops.com/crac-vs-leyden-comparison-of-two-approaches-to-remove-slow-startup-in-java/)

## ADR-02 · Banco relacional (fonte da verdade)

| Critério | MySQL 8.4 LTS | PostgreSQL 17/18 |
|---|---|---|
| JSON (`Listof*`, `LastSavedLocation`) | `JSON` + índices funcionais | `JSONB` + GIN, superior |
| Geo (local / país / cidade) | Tipos espaciais básicos | **PostGIS** |
| Nome (busca aproximada, acentos) | FULLTEXT limitado em pt-BR | `pg_trgm` + `unaccent` |
| Suporte | 8.4 LTS até ~2032 | ~5 anos por major |
| Gerenciado em sa-east-1 | RDS / Aurora MySQL | RDS / Aurora PostgreSQL |

**Decisão (aprovada em 17/10/2026):** **migrar para PostgreSQL 17 + PostGIS** antes do primeiro
dado em produção. Motivos: `JSONB` + GIN para as listas e a localização, `GEOGRAPHY` gerada a
partir de `LastSavedLocation` para o eixo "Local", `pg_trgm` + `unaccent` para o eixo "Nome" — o
filtro de 6 eixos fica coberto sem motor de busca externo no MVP (OpenSearch entra só com escala,
ADR-06). Aplicado em `schema.sql`, `pom.xml`, `application.yml` e no pacote
`infrastructure.persistence.postgres`. Migrações com **Flyway** (Apache 2.0; Liquibase 5 passou
para FSL).

Fontes: [EOL MySQL 8.0](https://atlasgo.io/blog/2026/05/05/mysql-8-eol) ·
[Liquibase adota FSL](https://www.liquibase.com/blog/liquibase-community-for-the-future-fsl) ·
[Flyway Community](https://www.red-gate.com/blog/why-every-user-can-now-fly-first-class-with-flyway)

## ADR-03 · Cache, sessões e Trending Score

| Opção | Licença | Observação |
|---|---|---|
| Redis 8.x | RSALv2 / SSPL / AGPLv3 | AGPL exige análise jurídica |
| **Valkey 9** | **BSD-3 (Linux Foundation)** | Padrão no ElastiCache (~20–33 % mais barato); compatível com Lettuce/Spring Data Redis e ZSET |
| Dragonfly | BSL 1.1 | Não OSI |

**Decisão:** **Valkey 9**, sem nenhuma mudança no código Spring (`StringRedisTemplate` continua).
**Sessões opacas no Valkey** em vez de JWT de longa duração no app (revogação imediata — Art. 8º §5º
e exclusão de conta); JWT ≤ 5 min só entre serviços.

Trending: ZSET por janela e dimensão (`trend:{feed}:{país}:{cat}:{hora}`), `ZUNIONSTORE` com pesos,
TTL por chave. Fórmula alvo (estilo Hacker News), substituindo a soma linear atual do
`TrendingScoreCalculator`:

```
score = (w_v·log10(1 + views_únicas) + w_l·likes + w_s·shares + w_c·comments) / (idade_h + 2)^G   (G ≈ 1,5–1,8)
```

Anti-manipulação: views únicas por (user, post) via HyperLogLog; só views com tempo mínimo de
exibição; peso por reputação/idade da conta; rate limit por IP/dispositivo; z-score de picos congela
para revisão; autor e contas novas sem peso.

Fontes: [Redis volta ao AGPL](https://www.theregister.com/2025/08/14/redis_redux/) ·
[Valkey 9 GA](https://www.cloudmagazin.com/en/2026/04/10/valkey-9-redis-fork-cloud-cache-landscape/) ·
[ElastiCache pricing](https://www.aws.amazon.com/elasticache/pricing/)

## ADR-04 · Timeline em fan-out

| Opção | Licença 2026 | Prós | Contras |
|---|---|---|---|
| **Cassandra 5.0.x** | Apache 2.0 | SAI, maduro, gerenciado (Keyspaces, Astra) | Operação pesada; 6.0 (Accord) em alpha |
| ScyllaDB 2025.x | Source-available (grátis até 50 vCPU / 10 TB) | p99 muito menor | Não OSI |
| Valkey + MySQL | BSD | Simples no MVP | Memória cara em escala |

**Decisão:** **Cassandra 5.0 (CQL)** como já modelado; ScyllaDB fala o mesmo protocolo e é a rota
de saída se a latência exigir. **Fan-out híbrido**: on write para autores com < ~10k seguidores,
merge na leitura (`author_posts`) para contas grandes; inativos > 30 dias não recebem fan-out.
**Alert Feed não usa timeline por seguidor** — público é geográfico (geohash / município IBGE) +
push. No MVP é aceitável manter a timeline em Valkey + MySQL e ligar o Cassandra com carga real.
Em AWS: Keyspaces no MVP (sa-east-1, serverless, mas sem LWT completo/limites de batch) → Scylla
acima de ~1M usuários.

Fontes: [ScyllaDB source-available FAQ](https://www.scylladb.com/source-available-faq) ·
[Cassandra 6 / Accord](https://thenewstack.io/apache-cassandra-6-features/) ·
[Keyspaces endpoints](https://docs.aws.amazon.com/en_gb/general/latest/gr/keyspaces.html)

## ADR-05 · Object storage e pipeline de mídia

| Opção | Status 2026 | Custo |
|---|---|---|
| MinIO CE | **Arquivado (02/2026)** | — |
| AWS S3 (sa-east-1) | Referência | ~US$ 0,023/GB-mês + egress ~US$ 0,09/GB |
| Cloudflare R2 | API S3 | US$ 0,015/GB-mês, **egress gratuito** (dados fora do Brasil → Art. 33) |
| Garage / SeaweedFS / LocalStack | OSS ativos | Dev e testes |

**Decisão:** **AWS SDK v2 com API S3 genérica**; S3 sa-east-1 para fotos e dados pessoais;
R2 avaliado para vídeo/áudio (egress domina o custo) **somente** com base legal do Art. 33 e sem
dado pessoal. **Remover MinIO** de `application.yml`, Compose e backlog.

Pipeline: upload direto por URL pré-assinada → evento `media.uploaded` → fila de processamento +
moderação antes de publicar. **Áudio:** FFmpeg próprio (AAC/Opus HLS 64/128 kbps) + waveform
pré-computado com `audiowaveform` (~1.000 picos em JSON). **Imagem:** libvips/imgproxy gerando
AVIF + WebP (fallback JPEG), thumbnails 150/480/1080, EXIF/GPS removidos. **Vídeo:** começar com
Cloudflare Stream ou Mux atrás de uma interface `VideoProvider`; migrar para FFmpeg + HLS (CMAF)
quando o custo justificar.

Fontes: [InfoQ: alternativas ao MinIO](https://infoq.com/news/2025/12/minio-s3-api-alternatives/) ·
[MinIO remove console](https://blocksandfiles.com/2025/06/19/minio-removes-management-features-from-basic-community-edition-object-storage-code/) ·
[Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing/index.md) ·
[Mux pricing](https://www.mux.com/docs/pricing/overview)

## ADR-06 · Busca e filtro multidimensional (6 eixos)

| Opção | Prós | Contras |
|---|---|---|
| **OpenSearch 3.x** | Apache 2.0 / Linux Foundation; `geo_point`, facetas; gerenciado na AWS; reaproveitável para logs | Operação pesada (JVM, shards) |
| Elasticsearch 9 | Maduro | Binários sob ELv2 |
| Typesense | Rápido, geo radius, typo-tolerant | Índice todo em RAM; comunidade Java menor |
| Meilisearch | Simples | Geo limitado, escala horizontal limitada |
| Só SQL/Valkey | Nenhum componente novo | 6 facetas + geo + nome em escala ficam ruins no MySQL |

**Decisão:** **OpenSearch** alimentado por CDC (ADR-07). Os 6 eixos viram `keyword`, local vira
`geo_point`, nome usa `edge_ngram` + `asciifolding` (pt-BR). Com equipe pequena e < ~10M documentos,
**Typesense** é um MVP aceitável. MySQL segue como fonte da verdade.

Fontes: [OpenSearch geo](https://docs.opensearch.org/3.3/mappings/supported-field-types/geographic/) ·
[Typesense vs Meilisearch](https://typesense.org/typesense-vs-meilisearch/)

## ADR-07 · Eventos, outbox e projeções

| Opção | Prós | Contras |
|---|---|---|
| **Kafka 4.x (KRaft)** | Apache 2.0; Debezium 3.2+ (exactly-once MySQL na 3.3); replay de projeções | Operação |
| Redpanda | API Kafka, binário único | BSL 1.1 |
| RabbitMQ | Filas simples | Sem replay |
| Redis/Valkey Streams | Já na stack | Durabilidade limitada pela memória |
| NATS JetStream | Leve | CDC/conectores fracos |

**Decisão:** **Kafka 4 + Debezium Outbox Event Router** lendo a tabela `outbox` gravada na mesma
transação do domínio (ou o Event Publication Registry do Modulith no MVP). Tópicos por agregado:
`user.events`, `post.events`, `alert.events`, `engagement.events`, `media.events`. Consumidores:
Cassandra (timeline), Valkey (trending), OpenSearch (busca), moderação. **Nunca dual-write.**

Fontes: [Debezium releases](https://debezium.io/releases) ·
[Debezium 3.2 / Kafka 4](https://debezium.io/blog/2025/07/09/debezium-3-2-final-released/)

## ADR-08 · Tempo real, push e Alert Feed

**Decisão:** **SSE** para notificações e Alert Feed (fan-out entre instâncias via Valkey Pub/Sub);
WebSocket só se houver DM. **Push:** FCM (canal de importância máxima) e APNs
(`interruption-level: time-sensitive`; solicitar cedo o entitlement de *Critical Alerts*, que a
Apple restringe a órgãos oficiais/saúde). **Fontes oficiais:** ingestão em **CAP 1.2 (OASIS)**;
a Portaria MIDR nº 2.458/2026 regulamenta a IDAP / Defesa Civil Alerta — confirmar com o MIDR
se terceiros podem consumir o feed. Só categoria VERMELHO verificada publica alerta com push.

SLOs: p99 criação→push aceito ≤ 5 s (p95 ≤ 2 s); API de alertas 99,9 %; ≥ 99,5 % de entregas
confirmadas em 60 s; medir ponta a ponta com timestamps no evento; canário sintético por minuto.

Fontes: [CAP v1.2](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2.html) ·
[Portaria MIDR 2.458/2026](https://www.lex.com.br/portaria-midr-no-2-458-de-30-de-julho-de-2026/)

## ADR-09 · Identidade, segurança e LGPD

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| Spring Security 7 + Authorization Server embutido | Nativo, sem custo por usuário, dados no Brasil | Telas de conta/MFA/admin por conta da equipe | Só com um único app |
| **Keycloak 26.x auto-hospedado** | Apache 2.0; passkeys oficiais (26.4); MFA, brute-force, auditoria, federação prontos | Operação (JVM, cluster, upgrades) | **Recomendado** para o ecossistema Velion |
| Auth0 / Clerk / Cognito | Rápido | Custo por MAU em rede social; transferência internacional (Res. ANPD 19/2024) | Não |
| Zitadel | Event-sourced, passkeys | Licença AGPL (confirmar) | Alternativa |

**Decisões:**
- **Keycloak 26.x** no Brasil; **passkeys** como primeiro fator desde o cadastro; TOTP/passkey como
  2FA (obrigatório para admins); SMS só como último recurso; **step-up** (`max_age`/`acr`) para
  Exportar e Excluir.
- **Argon2id** (`Argon2PasswordEncoder`, m ≥ 19 MiB, t = 2, p = 1) dentro de
  `DelegatingPasswordEncoder` — o `password_hash` do DDL já suporta isso.
- **Criptografia de campo** com **Tink (AES-256-GCM) + AWS KMS**, **uma DEK por usuário**
  (`user_keys`), `user_id` como dado associado; índice cego HMAC quando precisar buscar.
  Cobre `sexual_preference`, `last_saved_location`, `address`, `cellphone_number`, foto.
- **Crypto-shredding:** excluir conta = destruir a DEK → backups do MySQL, SSTables do Cassandra
  e versões no S3 ficam ilegíveis sem reescrever backups. É a única forma realista de cumprir o
  Art. 18 VI / Art. 16 com backups imutáveis.
- **Consentimento próprio** (`user_consent` já existe; torná-la append-only como `consent_events`
  com versão do texto, canal e IP com hash). CMP de cookies só na web (Klaro/Osano).
- **Auditoria:** eventos com encadeamento de hash em S3 Object Lock; logins, leituras de dado
  sensível, exportações, exclusões, acessos admin. Logs sem PII em claro.
- **Registro de operações (Art. 37) e RIPD** versionados no repositório (YAML). RIPD é
  obrigatório na prática: dado sensível + geolocalização + menores + larga escala.
- **ECA Digital:** aferição confiável de idade, modo restrito para menores (sem perfilamento,
  sem geolocalização, sem publicidade direcionada), supervisão parental.
- **Reconhecimento facial:** desligado por padrão, consentimento específico (Art. 11 I),
  **processado no aparelho** (ML Kit / Apple Vision), **nunca para menores**. A NT nº 4/2026 da
  ANPD suspendeu reconhecimento facial em escolas do PR por base legal frágil e falta de
  proporcionalidade — Rekognition em nuvem vai contra esse padrão de fiscalização.
- **Exportação (Art. 18 V):** step-up → job assíncrono → JSON versionado + mídias em ZIP cifrado
  → URL pré-assinada 24–72 h; 1 pedido/dia.
- **Exclusão (Art. 18 VI), saga idempotente:** reautenticar → carência opcional (15 dias) →
  revogar sessões → anonimizar MySQL (mantendo registros de acesso do Marco Civil Art. 15 por
  6 meses) → deletes no Cassandra → objetos e versões no S3 → destruir DEK → recibo na
  auditoria. Tabela de estado da saga + reconciliação diária; reaplicar após qualquer restore.
- **Hardening:** Bucket4j com backend Valkey (por IP, usuário e rota); AWS WAF/Cloudflare;
  **OWASP ASVS 5.0** nível 2 (nível 3 em autenticação e dados sensíveis); CI com Dependabot,
  OWASP Dependency-Check, CodeQL/Semgrep, Gitleaks + push protection, Trivy, SBOM CycloneDX;
  segredos no Secrets Manager/Vault, nunca em `application.yml`.

Fontes: [Passkeys no Spring Security](https://docs.spring.io/spring-security/reference/servlet/authentication/passkeys.html) ·
[Keycloak 26.4 passkeys](https://www.keycloak.org/2025/09/passkeys-support-26-4) ·
[ECA Digital em vigor](https://canaltech.com.br/internet/pontos-para-entender-o-eca-digital-que-entra-em-vigor-nesta-terca-17/) ·
[ANPD e ECA Digital (Mayer Brown)](https://www.mayerbrown.com/pt/insights/publications/2026/04/enforcement-of-brazils-eca-digital-introduces-new-obligations-for-companies) ·
[ANPD NT 4/2026 reconhecimento facial](https://www.felsberg.com.br/anpd-reconhecimento-facial-escolas-parana/) ·
[OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) ·
[OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

## ADR-10 · Moderação de conteúdo

| Camada | Ferramentas |
|---|---|
| Texto | OpenAI omni-moderation (gratuita, multimodal), Perspective API, ou classificador LLM com prompt de política |
| Imagem / vídeo | AWS Rekognition Content Moderation, Hive, Google SafeSearch; hash de **CSAM** (PhotoDNA / PDQ) é obrigatório |
| Áudio | Transcrever (Whisper / AWS Transcribe) → classificador de texto; fingerprint de música (Audible Magic / ACRCloud) |

**Decisão:** pipeline assíncrono via Kafka: score alto bloqueia, faixa intermediária vai para
revisão humana, baixo publica. Logs de decisão para auditoria e apelação; política alinhada ao
ECA Digital e ao Marco Civil. Alert Feed de usuário comum sempre passa por moderação.

## ADR-11 · Infraestrutura, DevOps e observabilidade

| Hospedagem | Região BR | Veredito |
|---|---|---|
| **AWS ECS Fargate (ARM)** | sa-east-1 | **Recomendado** — todos os bancos gerenciados na mesma região |
| AWS EKS | sa-east-1 | Só acima de ~1M usuários |
| GCP Cloud Run + Cloud SQL | southamerica-east1 | Boa alternativa; sem Cassandra gerenciado nativo |
| Fly.io | gru | Protótipo |
| Railway / Render | **sem região BR** | Não para produção (Art. 33) |

**Decisões:** RDS MySQL 8.4 → Aurora MySQL; ElastiCache for **Valkey**; Keyspaces → Scylla;
S3 + CloudFront. **IaC em OpenTofu** (state em S3 com locking nativo). **CI/CD em GitHub
Actions**: `mvn verify` + Testcontainers 2.0 (`@ServiceConnection`; atenção aos artefatos
renomeados) → CodeQL, Dependabot, Trivy, Gitleaks, SBOM (Syft) → imagem com **Jib** → ECR via
**OIDC** → deploy ECS (rolling/blue-green). Trunk-based; ambientes `dev` → `staging` → `prod`
(aprovação manual), contas AWS separadas. **Observabilidade:** Micrometer + OpenTelemetry →
Collector sidecar → **Grafana Cloud (LGTM)**; mascarar IPs/IDs no Collector.

**Local:** Docker Compose com `mysql:8.4`, `valkey/valkey:9`, `cassandra:5` (heap 1 GB,
healthcheck `cqlsh`), **Garage** no lugar do MinIO; profile `light` sem Cassandra.

**Backup/DR:** PITR 7–35 dias, snapshot diário copiado para segunda conta em sa-east-1 com
Backup Vault Lock (cópia cross-region é transferência internacional); S3 versionado com Object
Lock de retenção limitada; backups expiram em ≤ 35 dias (declarar na política de privacidade);
registro de pedidos de exclusão reaplicado após restore. RPO ≤ 5 min, RTO ≤ 4 h, restore testado
por trimestre.

**Custo mensal estimado (US$, sa-east-1 ≈ us-east-1 + 40 %):**

| Item | MVP (~10k MAU) | Escala (~1M MAU) |
|---|---|---|
| Fargate ARM | 80 | 2.000–3.500 |
| ALB + NAT | 70 | 300–600 |
| RDS MySQL Multi-AZ → Aurora + réplicas | 220 | 2.500–3.500 |
| Valkey | 20 | 1.500–2.500 |
| Keyspaces → Scylla | 30–60 | 2.000–6.000 |
| S3 + CloudFront (egress de mídia domina) | 30 | 6.000–14.000 |
| Observabilidade | 0–20 | 1.000–3.000 |
| Backups, KMS, Secrets, WAF | 30 | 500–1.000 |
| **Total** | **~500–550** | **~16k–35k** |

Savings Plans cortam ~30 %. O egress de vídeo é o item a atacar primeiro (CDN, AVIF/WebP, HLS).

Fontes: [RDS MySQL pricing](https://aws.amazon.com/rds/mysql/pricing/) ·
[Fargate pricing](https://cloudchipr.com/blog/aws-fargate-pricing) ·
[Grafana Cloud pricing](https://last9.io/blog/grafana-cloud-pricing/) ·
[Fly.io regions](https://fly.io/docs/reference/regions) ·
[Leyden/AOT com Spring Boot](https://dzone.com/articles/spring-boot-startup-time)

## ADR-12 · Frontend

| Opção | Nota | Motivo |
|---|---|---|
| **Next.js 16 (web) + Expo SDK 58 (mobile) em Turborepo** | **9** | SSR/SEO para perfis e posts públicos; app nativo real; tokens, API client, i18n e glifos compartilhados |
| Expo Router universal | 7 | SEO/SSR/a11y web abaixo do Next |
| Flutter | 5 | Web em canvas (SEO, a11y, texto não selecionável) |
| Kotlin Multiplatform + Compose | 5 | Compose Web/iOS menos maduro |

**Decisão:** monorepo **Turborepo** (`apps/web`, `apps/mobile`, `packages/{tokens,ui-web,
ui-native,glyphs,api,i18n}`); `packages/api` gerado do OpenAPI do springdoc (orval). Tailwind v4 +
shadcn/Radix no web, Uniwind/NativeWind 4 + react-native-reusables no mobile, ambos sobre as
mesmas variáveis CSS geradas dos tokens. Storybook 10 + Chromatic (ou Playwright
`toHaveScreenshot` + axe-core). FlashList v2 / TanStack Virtual; TanStack Query v5 + Zustand;
i18next 26; Motion 14 / Reanimated 4; `expo-audio` com waveform pré-computado pelo backend.
Detalhes e tokens em [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

---

## Stack consolidada

| Camada | Escolha | Substitui / observação |
|---|---|---|
| Runtime | Java 25 LTS + Spring Boot 4.1 + virtual threads + Modulith 2 | Boot 3.5.16 (EOL) |
| Relacional | PostgreSQL 17 + PostGIS (RDS → Aurora PostgreSQL) + Flyway | MySQL 8.0 (EOL) |
| Cache / ranking / sessões | Valkey 9 | Redis 8 (AGPL) — zero mudança de código |
| Timeline | Cassandra 5.0 (Keyspaces no MVP) → ScyllaDB se precisar | Fan-out híbrido; Alert Feed geográfico |
| Objetos | S3 sa-east-1 via SDK v2; Garage em dev | MinIO (arquivado) |
| Busca | OpenSearch 3 (Typesense no MVP pequeno) | — |
| Eventos | Kafka 4 + Debezium outbox | Dual-write |
| Tempo real | SSE + Valkey Pub/Sub; FCM/APNs; CAP 1.2 | — |
| Identidade | Keycloak 26 + passkeys + Argon2id; sessões opacas | JWT de longa duração |
| Dados sensíveis | Tink + KMS, DEK por usuário, crypto-shredding | — |
| Frontend | Next.js 16 + Expo 58, Turborepo, DTCG → Style Dictionary 5 | — |
| Infra | AWS sa-east-1, ECS Fargate, OpenTofu, GitHub Actions + Jib + OIDC, OTel + Grafana | — |

## Riscos transversais

1. **Rodar fora de suporte** (Boot 3.5, MySQL 8.0, Boot 4.0 em 12/2026): adotar ciclo de upgrade semestral.
2. **Quatro bancos para uma equipe pequena:** começar com MySQL + Valkey + S3 e ligar Cassandra, OpenSearch e Kafka conforme a carga; preferir gerenciados.
3. **Licenças não-OSI** (Redis 8 AGPL, Redpanda/Dragonfly BSL, Scylla source-available, Liquibase FSL, Elastic ELv2): preferir Apache/BSD.
4. **Transferência internacional** (R2, Grafana Cloud, backups cross-region, IdP SaaS): base no Art. 33 ou manter em sa-east-1.
5. **ECA Digital** (aferição de idade, menores) e **biometria** (ANPD): podem bloquear funcionalidades inteiras.
6. **Eliminação incompleta** em backups/Cassandra se o crypto-shredding não cobrir tudo desde a primeira gravação.
7. **Egress de mídia** e **manipulação do trending** precisam de telemetria desde o dia 1.
8. **Pontos a confirmar:** API da IDAP para terceiros; licença atual do Zitadel; orientações definitivas de aferição de idade; rate cards oficiais de sa-east-1.

## Impacto imediato no backlog (`TRELLO_BACKLOG.md`)

- **OS-01** passa a incluir migração para Boot 4.1 / Java 25.
- **OS-03** troca MinIO por Garage; Redis por Valkey; `mysql:8.4`.
- **Novos cards 🔴:** aferição de idade e modo menor (ECA Digital); crypto-shredding com DEK por usuário; RIPD e registro de operações; saga de exclusão.
- **Novos cards 🔵:** outbox + Kafka/Debezium; OpenSearch para o filtro de 6 eixos; fan-out híbrido; Alert Feed geográfico; ingestão CAP.
- **Novos cards 🟠:** paleta para tema claro; anel + glifo para PRETO; glifos VSL para todas as categorias.
