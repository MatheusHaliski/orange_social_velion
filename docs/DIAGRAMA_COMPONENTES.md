# Diagrama de Componentes — Orange Social

Arquitetura em camadas Spring Boot 3 / Java 21 com persistência poliglota.

```mermaid
flowchart TB
    subgraph Clients["Clientes"]
        WEB["Web App<br/>(TopBar · Segmented Switcher)"]
        MOBILE["Mobile App"]
        VELION["Módulos Velion<br/>FriendlyEats · Sports · Points · Trophies · Post"]
    end

    subgraph App["Orange Social · Spring Boot"]
        direction TB

        subgraph Security["Camada de Segurança & LGPD"]
            JWT["JwtAuthenticationFilter"]
            RATE["RateLimitFilter"]
            CONSENT["ConsentGuard<br/>(Art. 7º I / Art. 11)"]
            AUDIT["LgpdAuditInterceptor<br/>(Art. 37 – registro de operações)"]
        end

        subgraph Controllers["Controllers (REST /api/v1)"]
            AUTHC["AuthController"]
            USERC["UserController"]
            FEEDC["FeedController<br/>(profile · post · audio · alert)"]
            POSTC["PostController"]
            MEDIAC["MediaController<br/>(URLs pré-assinadas)"]
            PRIVC["PrivacyController<br/>(exportar · excluir · consentimentos)"]
            VELC["VelionIntegrationController"]
        end

        subgraph Services["Services (regras de negócio)"]
            AUTHS["AuthService"]
            USERS["UserService"]
            FEEDS["FeedService<br/>(filtro 6 eixos)"]
            POSTS["PostPublishingService"]
            TRENDS["TrendingService"]
            MEDIAS["MediaStorageService"]
            LGPDS["LgpdService<br/>(portabilidade · eliminação)"]
            POINTS["VelionPointsService"]
            EVENTS["DomainEventPublisher"]
        end

        subgraph Repositories["Repositories"]
            USERR["UserControlListRepository<br/>(JPA)"]
            CONSR["UserConsentRepository<br/>(JPA)"]
            POSTR["PostRepository<br/>(JPA)"]
            TIMER["PostTimelineRepository<br/>(Spring Data Cassandra)"]
            TRENDR["TrendingScoreRepository<br/>(StringRedisTemplate · ZSET)"]
            SESSR["SessionRepository<br/>(Redis)"]
            S3A["S3StorageAdapter<br/>(AWS SDK v2)"]
        end
    end

    subgraph Data["Persistência Poliglota"]
        MYSQL[("MySQL 8.0<br/>VSusercontrolist · user_consent<br/>post · velion_points")]
        REDIS[("Redis<br/>trending:{feed}:{cor}<br/>session:{jwtId}")]
        CASS[("Cassandra<br/>post_timeline · activity_log<br/>notification")]
        S3[("AWS S3 / MinIO<br/>fotos · vídeos · áudios")]
    end

    WEB & MOBILE & VELION -->|HTTPS + JWT| JWT
    JWT --> RATE --> CONSENT --> AUDIT
    AUDIT --> AUTHC & USERC & FEEDC & POSTC & MEDIAC & PRIVC & VELC

    AUTHC --> AUTHS
    USERC --> USERS
    FEEDC --> FEEDS
    POSTC --> POSTS
    MEDIAC --> MEDIAS
    PRIVC --> LGPDS
    VELC --> POINTS

    AUTHS --> USERR & SESSR
    USERS --> USERR & CONSR & MEDIAS
    FEEDS --> TIMER & TRENDR & USERR
    POSTS --> POSTR & TIMER & TRENDS & EVENTS
    TRENDS --> TRENDR
    MEDIAS --> S3A
    LGPDS --> USERR & CONSR & TIMER & TRENDR & S3A & SESSR
    POINTS --> USERR
    EVENTS -.->|PostPublished| POINTS

    USERR & CONSR & POSTR --> MYSQL
    TRENDR & SESSR --> REDIS
    TIMER --> CASS
    S3A --> S3

    WEB -.->|upload direto<br/>via URL pré-assinada| S3
```

## Responsabilidades por camada

| Camada | Pacote | Responsabilidade |
|---|---|---|
| Segurança | `com.orangesocial.security` | Validação JWT, rate limit, verificação de consentimento antes de tratar dados opcionais, trilha de auditoria |
| Controllers | `com.orangesocial.api` | DTOs de entrada/saída, validação Bean Validation, códigos HTTP |
| Services | `com.orangesocial.application` | Casos de uso, transações (`@Transactional` só no MySQL), orquestração entre armazenamentos |
| Domínio | `com.orangesocial.domain.model` | Entidades, enums (`UserCategoryEnum`, `AccountStatus`, `FeedType`), regras de transição |
| Infraestrutura | `com.orangesocial.infrastructure.*` | Adaptadores MySQL (`persistence.mysql`), Cassandra (`persistence.cassandra`), Redis (`cache.redis`), S3 |

## Consistência entre armazenamentos

- **MySQL é a fonte da verdade.** Cassandra e Redis são projeções reconstruíveis a partir dele.
- A gravação no MySQL acontece dentro da transação; Cassandra e Redis são atualizados **após o commit**
  (`@TransactionalEventListener(phase = AFTER_COMMIT)`), com retentativa idempotente
  (o `post_id` é `timeuuid` gerado uma única vez).
- Mídia é enviada **antes** da publicação (URL pré-assinada); o post só referencia a chave do objeto.
