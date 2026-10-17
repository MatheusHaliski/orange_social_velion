# Diagrama de Classes — Orange Social

Modelo de domínio central. `VSusercontrolist` é a tabela MySQL; a entidade Java correspondente é
`com.orangesocial.domain.model.UserControlList`. Os campos marcados como `«sensível»` são dados
pessoais sensíveis (LGPD Art. 5º, II) e só são tratados com consentimento específico (Art. 11).

```mermaid
classDiagram
    direction TB

    class VSusercontrolist {
        <<Entity · MySQL>>
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
        -Instant createdAt
        -Instant updatedAt
        -Instant deletedAt
        +activate() void
        +suspend() void
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
        ANONYMOUS_LGPD_DELETED
        +canTransitionTo(AccountStatus) boolean
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

    class UserConsent {
        <<Entity · MySQL>>
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
        <<abstract>>
        #UUID id
        #Long authorId
        #UserCategoryEnum authorCategory
        #FeedType feed
        #String title
        #String subtitle
        #AgeRating ageRating
        #PostStatus status
        #String country
        #String city
        #long views
        #long likes
        #long comments
        #long shares
        #Instant createdAt
        +publish() void
        +archive() void
        +remove(String reason) void
        +trendingScore() double
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
        <<Entity · MySQL>>
        -Long userId
        -long balance
        -long lifetimeEarned
        -Tier tier
        +credit(long amount, String reason) void
        +debit(long amount, String reason) void
    }

    class VelionTrophy {
        <<Entity · MySQL>>
        -String code
        -Rarity rarity
        -Instant awardedAt
    }

    VSusercontrolist "1" --> "1" UserCategoryEnum : userType
    VSusercontrolist "1" --> "1" AccountStatus : accountStatus
    VSusercontrolist "1" *-- "0..1" GeoLocation : lastSavedLocation
    VSusercontrolist "1" *-- "0..*" CommunityInterest : communities
    VSusercontrolist "1" *-- "0..*" UserConsent : consents
    VSusercontrolist "1" -- "1" VelionPoints : wallet
    VSusercontrolist "1" -- "0..*" VelionTrophy : trophies
    VSusercontrolist "1" -- "0..*" Post : publica

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
| `VSusercontrolist`, `UserConsent`, `VelionPoints`, `VelionTrophy` | MySQL 8.0 | Fonte da verdade, transações ACID |
| `Post` (+ subclasses) — metadados | MySQL 8.0 | Registro canônico do post |
| `Post` — projeção de timeline | Cassandra `post_timeline` | Fan-out on write por seguidor/feed |
| `Post.trendingScore()` | Redis ZSET `trending:{feed}[:{categoria}]` | Ranking em tempo real |
| Mídias (`photoObjectKey`, `mediaObjectKeys`, `audioObjectKey`) | AWS S3 / MinIO | O banco guarda apenas a chave do objeto |

## Regras de domínio relevantes

- **Alert Feed:** somente `UserCategoryEnum.VERMELHO` verificado (`canPublishOfficialAlerts()`)
  ou conteúdo curado pela moderação publica `AlertContent` com `category ≠ JOB_OPENING`.
  Vagas (`JOB_OPENING`) podem ser publicadas por qualquer conta `VERMELHO` ou `AMARELO`.
- **Cor do autor desnormalizada:** `Post.authorCategory` é copiada no momento da publicação para
  permitir filtro por categoria na timeline sem join.
- **`ANONYMOUS_LGPD_DELETED` é terminal:** nenhum método de domínio aceita transição a partir dele.
