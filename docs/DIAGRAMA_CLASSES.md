# Diagrama de Classes — Orange Social

Modelo de domínio central. `VSusercontrolist` é a tabela PostgreSQL; a entidade Java correspondente é
`com.orangesocial.domain.model.UserControlList`. Os campos marcados como `«sensível»` são dados
pessoais sensíveis (LGPD Art. 5º, II) e só são tratados com consentimento específico (Art. 11).

```mermaid
classDiagram
    direction TB

    class VSusercontrolist {
        <<Entity · PostgreSQL>>
        -Long id
        -String name
        -String passwordHash
        -String email
        -String recoveryEmail
        -String citizenship
        -String countryOfResidence
        -String stateOfResidence
        -String cityOfResidence
        -String address
        -String cellphoneNumber
        -List~String~ listOfInterestsAndHobbies
        -List~String~ listOfJobsInterests
        -LocalDate userDateOfBirth
        -String gender
        -String sexualPreference «sensível»
        -String photoObjectKey
        -UserCategoryEnum userType
        -List~CommunityInterest~ listOfCommunitiesOfInterest
        -GeoLocation lastSavedLocation
        -AccountStatus accountStatus
        -String handle «@usuário»
        -String bio
        -List~String~ pronouns
        -List~String~ links
        -Map typeDetails «campos do tipo»
        -CategoryVerification categoryVerification
        -Instant emailVerifiedAt
        -Instant deletionScheduledFor
        -AccountStatus statusBeforeDeletion
        -Instant createdAt
        -Instant updatedAt
        -Instant deletedAt
        +activate() void
        +suspend() void
        +markEmailVerified(Instant) void
        +requestDeletion(Instant, Duration) Instant
        +reactivate(Instant) void
        +anonymizeForLgpdDeletion(String hash) void
    }

    class UserCategoryEnum {
        <<enumeration>>
        VERDE   #3DDC6B Pessoa Física
        AMARELO #F7C948 Imprensa / Networking
        AZUL    #4A93FF Marketing
        LARANJA #FF9F1C Comunidade
        VERMELHO #FF4D4D Instituição
        PRETO   #0C0A07 Especial
        +char code
        +String hexColor
        +String label
        +canPublishOfficialAlerts() boolean
        +fromCode(char) UserCategoryEnum
    }

    class AccountStatus {
        <<enumeration>>
        PENDING_VERIFICATION
        ACTIVE
        SUSPENDED
        PENDING_DELETION
        ANONYMOUS_LGPD_DELETED
        +canTransitionTo(AccountStatus) boolean
    }

    class CategoryVerification {
        <<enumeration>>
        NOT_REQUIRED
        PENDING
        VERIFIED
        REJECTED
    }

    class TermsAcceptance {
        <<Entity · PostgreSQL terms_acceptance>>
        -Long userId
        -String document «TERMS_OF_USE»
        -String version
        -Instant acceptedAt
        -String channel
        -String ipHash «HMAC»
    }

    class UserPreference {
        <<Entity · PostgreSQL user_preference>>
        -Theme theme
        -AppBackground appBackground «PLAIN NETWORK MOSAIC MOSAIC_*»
        -String language
        -short fontScale
        -boolean reduceMotion
        -boolean profilePrivate
        -CommentAudience whoCanComment
        -FeedType defaultFeed
        -SensitiveContent sensitiveContent
        -Map notifications
        -boolean loginAlerts
        +defaultsFor(userId, minor) UserPreference
    }

    class UserMfa {
        <<Entity · PostgreSQL user_mfa>>
        -byte[] totpSecret «AES-256-GCM»
        -long lastUsedStep «anti-replay»
        +consumeStep(long) boolean
    }

    class RecoveryCode {
        <<Entity · PostgreSQL user_recovery_code>>
        -String codeHash «Argon2id»
        -Instant usedAt
    }

    class GeoLocation {
        <<record · JSON>>
        +double lat
        +double lng
        +Instant timestamp
    }

    class CommunityInterest {
        <<record · JSON>>
        +String typeOfCommunity
        +String country
        +String city
    }

    class ConsentEvent {
        <<Entity · PostgreSQL>>
        -Long id
        -ConsentPurpose purpose
        -String legalBasis
        -boolean granted
        -String policyVersion
        -Instant grantedAt
        -Instant revokedAt
        +revoke() void
    }

    class FeedType {
        <<enumeration>>
        PROFILE
        POST
        AUDIO
        ALERT
    }

    class Post {
        <<Entity · PostgreSQL post>>
        #UUID id «UUIDv7»
        #Long authorUserId
        #UserCategoryEnum authorUserType
        #FeedType feedType
        #MediaType mediaType
        #String title
        #String subtitle
        #String body
        #String mediaObjectKey
        #AgeRating ageRating
        #PostStatus status
        #String country
        #String city
        #long likeCount «somente leitura»
        #long commentCount «somente leitura»
        #long shareCount «somente leitura»
        #long viewCount
        #Instant createdAt «data de publicação»
        +publish() void
        +archive() void
        +remove() void
        +isVisibleTo(Long viewerId) boolean
        +acceptsInteractions() boolean
        +trendingScore() double
    }

    class PostStatus {
        <<enumeration>>
        DRAFT
        PUBLISHED
        ARCHIVED
        REMOVED
        +canTransitionTo(PostStatus) boolean
    }

    class AgeRating {
        <<enumeration>>
        LIVRE
        AGE_12
        AGE_16
        AGE_18
        SENSITIVE
    }

    class PostComment {
        <<Entity · PostgreSQL post_comment>>
        -Long id
        -UUID postId
        -Long authorUserId
        -String body «máx. 2000»
        -CommentStatus status
        -Instant createdAt
        +remove() void
        +canBeRemovedBy(Long userId, Post post) boolean
    }

    class PostReaction {
        <<tabela post_reaction>>
        UUID postId
        Long userId
        ReactionKind kind «LIKE · SAVE»
    }

    class PostShare {
        <<tabela post_share>>
        UUID postId
        Long userId «NULL após LGPD»
        ShareChannel channel
    }

    class ShareChannel {
        <<enumeration>>
        COPY_LINK
        NATIVE
        WHATSAPP
        TELEGRAM
        X
        EMAIL
    }

    class MediaPost {
        -MediaType mediaType
        -List~String~ mediaObjectKeys
        -String body
    }

    class AudioContent {
        -AudioKind kind
        -String audioObjectKey
        -int durationSeconds
        -String transcript
        -List~String~ tags
    }

    class AlertContent {
        -AlertCategory category
        -Severity severity
        -GeoLocation epicenter
        -int radiusKm
        -Instant expiresAt
        -boolean verifiedSource
        +isActive() boolean
    }

    class MediaType {
        <<enumeration>>
        TEXT
        IMAGE
        VIDEO
        AUDIO
    }

    class AudioKind {
        <<enumeration>>
        PODCAST
        PERSONAL_AUDIO
        MUSIC
    }

    class AlertCategory {
        <<enumeration>>
        EMERGENCY
        NATURAL_DISASTER
        OFFICIAL_COMMUNICATION
        JOB_OPENING
    }

    class VelionPoints {
        <<Entity · PostgreSQL>>
        -Long userId
        -long balance
        -long lifetimeEarned
        -Tier tier
        +credit(long amount, String reason) void
        +debit(long amount, String reason) void
    }

    class VelionTrophy {
        <<Entity · PostgreSQL>>
        -String code
        -Rarity rarity
        -Instant awardedAt
    }

    VSusercontrolist "1" --> "1" UserCategoryEnum : userType
    VSusercontrolist "1" --> "1" AccountStatus : accountStatus
    VSusercontrolist "1" *-- "0..1" GeoLocation : lastSavedLocation
    VSusercontrolist "1" *-- "0..*" CommunityInterest : communities
    VSusercontrolist "1" *-- "0..*" ConsentEvent : consents
    VSusercontrolist "1" *-- "1..*" TermsAcceptance : aceita
    VSusercontrolist "1" *-- "1" UserPreference : configura
    VSusercontrolist "1" *-- "0..1" UserMfa : 2FA
    VSusercontrolist "1" *-- "0..10" RecoveryCode : recuperação
    VSusercontrolist "1" --> "1" CategoryVerification : selo
    VSusercontrolist "1" -- "1" VelionPoints : wallet
    VSusercontrolist "1" -- "0..*" VelionTrophy : trophies
    VSusercontrolist "1" -- "0..*" Post : publica
    VSusercontrolist "1" -- "0..*" PostComment : escreve
    VSusercontrolist "1" -- "0..*" PostReaction : curte / salva
    VSusercontrolist "0..1" -- "0..*" PostShare : compartilha
    Post "1" *-- "0..*" PostComment : caixa de mensagens
    Post "1" *-- "0..*" PostReaction
    Post "1" *-- "0..*" PostShare
    Post --> PostStatus
    Post --> AgeRating
    PostShare --> ShareChannel

    Post <|-- MediaPost
    Post <|-- AudioContent
    Post <|-- AlertContent
    Post --> FeedType
    MediaPost --> MediaType
    AudioContent --> AudioKind
    AlertContent --> AlertCategory
    AlertContent *-- GeoLocation : epicenter
```

## Onde cada classe é persistida

| Classe | Armazenamento | Observação |
|---|---|---|
| `VSusercontrolist`, `ConsentEvent`, `VelionPoints`, `VelionTrophy` | PostgreSQL 17 + PostGIS | Fonte da verdade, transações ACID |
| `Post` (+ subclasses) — metadados e contadores | PostgreSQL 17 + PostGIS (`post`) | Registro canônico do post (V2) |
| `PostComment`, `PostReaction`, `PostShare` | PostgreSQL (`post_comment`, `post_reaction`, `post_share`) | Interações RF26; contadores na linha do `post` |
| `Post` — projeção de timeline | Cassandra `post_timeline` | Fan-out on write por seguidor/feed |
| `Post.trendingScore()` | Valkey ZSET `trending:{feed}[:{categoria}]` | Ranking em tempo real |
| Mídias (`photoObjectKey`, `mediaObjectKeys`, `audioObjectKey`) | AWS S3 | O banco guarda apenas a chave do objeto |

## Regras de domínio relevantes

- **Alert Feed:** somente `UserCategoryEnum.VERMELHO` verificado (`canPublishOfficialAlerts()`)
  ou conteúdo curado pela moderação publica `AlertContent` com `category ≠ JOB_OPENING`.
  Vagas (`JOB_OPENING`) podem ser publicadas por qualquer conta `VERMELHO` ou `AMARELO`.
- **Cor do autor desnormalizada:** `Post.authorCategory` é copiada no momento da publicação para
  permitir filtro por categoria na timeline sem join.
- **`ANONYMOUS_LGPD_DELETED` é terminal:** nenhum método de domínio aceita transição a partir dele.
- **Visibilidade do post (RF24):** `PUBLISHED`/`ARCHIVED` para todos, `DRAFT` só para o autor, `REMOVED` para
  ninguém; autor não `ACTIVE` esconde o post de terceiros. Só `PUBLISHED` aceita interações (RF26).
- **Contadores somente leitura no JPA:** quem altera é o `PostInteractionService`, com UPDATE atômico.
