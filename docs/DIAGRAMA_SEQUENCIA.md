# Diagrama de Sequência — Publicação no Audio Feed

Fluxo completo: upload do áudio para o S3, persistência canônica no MySQL, atualização do
*Trending Score* no Redis (ZSET) e fan-out da timeline no Cassandra.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário (App)
    participant SEC as JwtAuthenticationFilter
    participant MC as MediaController
    participant MS as MediaStorageService
    participant S3 as AWS S3 / MinIO
    participant PC as PostController
    participant PS as PostPublishingService
    participant DB as MySQL (PostRepository)
    participant EV as DomainEventPublisher
    participant TS as TrendingService
    participant R as Redis (TrendingScoreRepository)
    participant TL as TimelineFanoutWorker
    participant C as Cassandra (PostTimelineRepository)

    Note over U,S3: Etapa 1 — upload da mídia (fora da transação)
    U->>SEC: POST /api/v1/media/upload-url {type: AUDIO, mime: audio/mpeg}
    SEC->>SEC: valida JWT + status ACTIVE
    SEC->>MC: requisição autenticada
    MC->>MS: createPresignedUpload(userId, AUDIO)
    MS->>S3: gera URL pré-assinada PUT (15 min)
    S3-->>MS: url + objectKey
    MS-->>U: 200 {uploadUrl, objectKey}
    U->>S3: PUT áudio (upload direto)
    S3-->>U: 200 ETag

    Note over U,DB: Etapa 2 — publicação (transação MySQL)
    U->>SEC: POST /api/v1/posts {feed: AUDIO, title, objectKey, kind: PODCAST}
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
| 19+ | Redis e Cassandra após o COMMIT | MySQL é a fonte da verdade; projeções são idempotentes e reconstruíveis |
| 25 | `BATCH UNLOGGED` por partição | Fan-out barato; cada linha é independente |
| 28 | `ZINCRBY` incremental | O ranking reage em tempo real sem recalcular o score inteiro; um job periódico recalcula o *freshness* |
