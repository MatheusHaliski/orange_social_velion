# Diagramas de Sequência — Orange Social

## Sequências implementadas (por RF)

| Fluxo | Onde |
|---|---|
| Cadastro com tipo de usuário e Termos | [RF1 · Sequência](rf/RF01-cadastro-usuario.md#sequência) |
| Editar preferências (fundo do app) | [RF2](rf/RF02-editar-perfil.md#sequência--editar-preferências-fundo-do-app) |
| Revogar localização | [RF3](rf/RF03-consentimento-privacidade.md#sequência--revogar-localização) |
| Excluir conta, reativar e eliminar após 30 dias | [RF23](rf/RF23-direitos-titular-lgpd.md#excluir-conta--modal-carência-de-30-dias-e-reativação) |
| Abrir post no modal | [RF24](rf/RF24-visualizar-post.md#sequência) |
| Perfil e feed do autor | [RF25](rf/RF25-perfil-publico-autor.md#sequência) |
| Curtir · comentar · compartilhar | [RF26](rf/RF26-interacoes-post.md#sequência--curtir-idempotente) |
| Login com 2FA · ativar 2FA | [RF27](rf/RF27-autenticacao-sessao.md#sequência--login-com-2fa) |
| Publicar post de texto com moldura | [RF29](rf/RF29-publicar-post.md#sequência--publicar) · [RF28](rf/RF28-moldura-post.md#sequência--publicar-com-moldura-e-ver-no-feed) |
| Publicar post com foto (URL pré-assinada, foto sem EXIF/GPS) | [RF29 · Sequência com foto](rf/RF29-publicar-post.md#sequência--publicar-com-foto) |
| Trocar a foto de perfil (quadrado de 512 px, a antiga sai do bucket) | [RF2 · Sequência](rf/RF02-editar-perfil.md#sequência--trocar-a-foto-de-perfil) |

## Publicação no Audio Feed (desenho alvo · ⏳ OS-23)

Ainda não implementado: áudio, `TrendingService` e o fan-out são o desenho alvo. O `PostPublishingService` e o envio
pré-assinado (`MediaUploadController` · `MediaUploads`) já existem para texto, foto do post e foto de perfil ([RF29](rf/RF29-publicar-post.md));
o áudio vai reaproveitar o mesmo envio. A autenticação já segue o que existe (RF27): sessão opaca no Valkey e `X-XSRF-TOKEN` em toda escrita —
nunca JWT no app.

Fluxo completo: upload do áudio para o S3, persistência canônica no PostgreSQL, atualização do
*Trending Score* no Valkey (ZSET) e fan-out da timeline no Cassandra.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário (App)
    participant SEC as SecurityFilterChain (sessão + CSRF)
    participant MC as MediaUploadController
    participant MS as MediaUploads
    participant S3 as AWS S3
    participant PC as PostController
    participant PS as PostPublishingService
    participant DB as PostgreSQL (PostRepository)
    participant EV as DomainEventPublisher
    participant TS as TrendingService
    participant R as Valkey (TrendingScoreRepository)
    participant TL as TimelineFanoutWorker
    participant C as Cassandra (PostTimelineRepository)

    Note over U,S3: Etapa 1 — upload da mídia (fora da transação)
    U->>SEC: POST /api/v1/media/uploads {kind: AUDIO, contentType: audio/mpeg, sizeBytes}<br/>cookie de sessão + X-XSRF-TOKEN
    SEC->>SEC: sessão válida no Valkey · CSRF confere · conta ACTIVE
    SEC->>MC: requisição autenticada
    MC->>MS: requestUpload(userId, AUDIO, contentType, sizeBytes)
    MS->>MS: assina PUT uploads/{userId}/{uuid} (15 min, tipo e tamanho na assinatura)
    MS-->>U: 201 {objectKey, uploadUrl, headers, expiresAt}
    U->>S3: PUT áudio (upload direto)
    S3-->>U: 200 ETag

    Note over U,DB: Etapa 2 — publicação (transação PostgreSQL)
    U->>SEC: POST /api/v1/posts {feed: AUDIO, title, mediaObjectKey, kind: PODCAST}
    SEC->>PC: requisição autenticada
    PC->>PS: publish(cmd)
    PS->>S3: HEAD objectKey (existe? duração? mime?)
    S3-->>PS: metadata
    alt mídia ausente ou inválida
        PS-->>U: 422 Unprocessable Entity
    else mídia válida
        PS->>DB: BEGIN · INSERT post (status=PUBLISHED, authorCategory=userType)
        DB-->>PS: postId (timeuuid)
        PS->>EV: publish(PostPublishedEvent)
        PS->>DB: COMMIT
        PS-->>U: 201 Created {postId}
    end

    Note over EV,C: Etapa 3 — projeções assíncronas (AFTER_COMMIT)
    par Trending Score
        EV->>TS: onPostPublished(event)
        TS->>TS: score = TrendingScoreCalculator.score(0,0,0,0,0, 0h)
        TS->>R: ZADD trending:audio score postId
        TS->>R: ZADD trending:audio:{cor} score postId
        TS->>R: EXPIRE ... 48h
    and Fan-out da timeline
        EV->>TL: onPostPublished(event)
        TL->>DB: SELECT seguidores do autor (paginado)
        loop para cada lote de seguidores
            TL->>C: BATCH UNLOGGED INSERT post_timeline<br/>(owner, AUDIO, dia, postId, ...)
        end
        TL->>C: INSERT activity_log (POST_PUBLISHED)
    end

    Note over U,R: Etapa 4 — interação posterior atualiza o ranking
    U->>PC: POST /api/v1/posts/{id}/plays
    PC->>TS: registerInteraction(postId, VIEW)
    TS->>R: ZINCRBY trending:audio 1.0 postId
    TS->>R: ZINCRBY trending:audio:{cor} 1.0 postId
    R-->>TS: novo score
    opt score entrou no top N
        TS->>EV: PostTrendingEvent (Published → Trending)
    end
```

## Pontos de decisão

| Passo | Decisão | Motivo |
|---|---|---|
| 1–9 | Upload direto ao S3 com URL pré-assinada | Áudios/podcasts são grandes; não passam pela JVM |
| 13 | `HEAD` no S3 antes do INSERT | Garante que o post nunca aponte para mídia inexistente |
| 15 | `authorCategory` copiada para o post | Permite filtro por cor sem join na leitura |
| 19+ | Valkey e Cassandra após o COMMIT | PostgreSQL é a fonte da verdade; projeções são idempotentes e reconstruíveis |
| 25 | `BATCH UNLOGGED` por partição | Fan-out barato; cada linha é independente |
| 28 | `ZINCRBY` incremental | O ranking reage em tempo real sem recalcular o score inteiro; um job periódico recalcula o *freshness* |
