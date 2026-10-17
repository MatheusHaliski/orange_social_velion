---
rf: RF1
titulo: Cadastro de usuário (VSusercontrolist)
status: parcial
cards: [OS-10, OS-11, OS-12, OS-17, OS-49]
paths:
  - src/main/java/com/orangesocial/domain/model/UserControlList.java
  - src/main/java/com/orangesocial/domain/model/UserCategoryEnum.java
  - src/main/java/com/orangesocial/domain/model/AccountStatus.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/UserControlListRepository.java
  - src/main/resources/schema.sql
  - src/main/resources/db/migration/V1__baseline.sql
---

# RF1 · Cadastro de usuário

> **Como** visitante, **quero** criar uma conta escolhendo minha categoria (Usertype) **para** publicar e
> ser encontrado nos feeds com a cor certa.

| | |
|---|---|
| **Base legal (LGPD)** | Art. 7º, V (execução de contrato) para os dados obrigatórios; Art. 7º, I (consentimento) para os opcionais — ver [RF3](RF03-consentimento-privacidade.md) |
| **Dados sensíveis** | `sexual_preference` (Art. 11) — opcional, só com consentimento específico |
| **ECA Digital** | Aferição de idade no cadastro; conta de menor entra em modo restrito (OS-49) |
| **Status** | 🟡 Parcial — entidade, schema e testes prontos; endpoint `POST /api/v1/users` e verificação ainda não |

## Critérios de aceite

1. E-mail único; senha forte guardada como hash **Argon2id** (`password_hash`).
2. Conta nasce em `PENDING_VERIFICATION`; vira `ACTIVE` só após código de e-mail/SMS (7 dias de validade).
3. Todos os consentimentos opcionais nascem **desligados** (Privacy by Default).
4. `VERMELHO` e `PRETO` entram com verificação manual antes do selo.
5. Cadastro não confirmado em 7 dias é eliminado (princípio da necessidade, Art. 6º, III).

## Caso de uso

```mermaid
flowchart LR
    V([Visitante]) --> UC1[Criar conta]
    UC1 --> UC2[Escolher categoria · Usertype]
    UC1 --> UC3[Selecionar comunidades<br/>tipo → país → cidade]
    UC1 --> UC4[Confirmar e-mail/SMS]
    UC1 -.opcional.-> UC5[Autorizar localização<br/>RF3]
    MOD([Moderação]) --> UC6[Verificar VERMELHO / PRETO]
    UC2 -.VERMELHO ou PRETO.-> UC6
```

## Sequência

```mermaid
sequenceDiagram
    autonumber
    actor V as Visitante (app)
    participant API as UserController
    participant S as UserService
    participant DB as PostgreSQL
    participant OB as outbox_event
    participant N as Notificador (e-mail/SMS)

    V->>API: POST /api/v1/users {nome, email, senha, usertype, ...}
    API->>API: Bean Validation (e-mail, E.164, data de nascimento)
    API->>S: register(cmd)
    S->>DB: SELECT 1 WHERE email = ?
    alt e-mail já cadastrado
        S-->>V: 409 Conflict
    else novo
        S->>S: Argon2id(senha)
        S->>DB: BEGIN
        S->>DB: INSERT "VSusercontrolist" (status = PENDING_VERIFICATION)
        S->>DB: INSERT consent_event (granted = false) para cada finalidade
        S->>OB: INSERT UserRegistered
        S->>DB: COMMIT
        S-->>V: 201 Created {id, status: PENDING_VERIFICATION}
        OB-->>N: UserRegistered (após commit)
        N-->>V: código de verificação
    end
```

## Modelo de dados envolvido

```mermaid
erDiagram
    VSusercontrolist ||--o{ consent_event : registra
    VSusercontrolist ||--o| user_key : "DEK (crypto-shredding)"
    VSusercontrolist ||--o{ post : "publica (RF24–RF26)"
    VSusercontrolist {
        bigint id PK
        varchar email UK
        varchar password_hash
        varchar user_type "VERDE..PRETO"
        varchar account_status
        jsonb list_of_communities_of_interest
        jsonb last_saved_location
        geography last_saved_point "gerada"
    }
    consent_event {
        bigint id PK
        bigint user_id FK
        varchar purpose
        boolean granted
        varchar policy_version
        timestamptz occurred_at
    }
    user_key {
        bigint user_id PK
        bytea wrapped_dek
        timestamptz destroyed_at
    }
    post {
        uuid id PK
        bigint author_user_id FK
        varchar author_user_type "cópia da categoria"
    }
```

Só conta `ACTIVE` aparece como autor com link para o perfil público ([RF25](RF25-perfil-publico-autor.md)) e
pode curtir, comentar ou compartilhar ([RF26](RF26-interacoes-post.md)); o cadastro em
`PENDING_VERIFICATION` lê, mas recebe 403 ao interagir.

Fluxo de atividades completo do cadastro (por Usertype, comunidades e GPS):
[`DIAGRAMA_ATIVIDADES.md`](../DIAGRAMA_ATIVIDADES.md) · estados da conta: [`MAQUINA_ESTADOS.md`](../MAQUINA_ESTADOS.md).

## Rastreabilidade

| Camada | Artefato | Situação |
|---|---|---|
| Domínio | `UserControlList`, `UserCategoryEnum`, `AccountStatus`, `GeoLocation`, `CommunityInterest` | ✅ |
| Persistência | `V1__baseline.sql` (parte de `schema.sql`), `UserControlListRepository` | ✅ |
| Testes | `DomainModelTest`, `UserControlListRepositoryIT` (PostGIS real) | ✅ |
| API | `POST /api/v1/users`, verificação de código | ⏳ OS-11, OS-12 |
| Tela | Protótipo: [Perfis](../../design/prototype/screens/04-profile-feed.png) (resultado do cadastro) | 🟡 tela de cadastro ainda não desenhada |
