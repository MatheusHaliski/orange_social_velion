---
rf: RF25
titulo: Perfil público do autor com o feed dele (toque na foto ou no nome)
status: parcial
numeracao_provisoria: true
cards: [OS-57]
paths:
  - src/main/java/com/orangesocial/api/UserProfileController.java
  - src/main/java/com/orangesocial/application/post/PostQueryService.java
  - src/main/java/com/orangesocial/application/post/AuthorDirectory.java
  - src/main/java/com/orangesocial/application/post/PostViews.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/PostRepository.java
  - src/main/resources/db/migration/V2__posts_interactions.sql
  - design/prototype/index.html
---

# RF25 · Perfil público do autor com o feed dele

> **Como** usuário, **quero** tocar na foto ou no nome de quem publicou **para** ver o perfil dessa pessoa e
> tudo o que ela publicou.

> ⚠️ **Numeração provisória** — ver [RF24](RF24-visualizar-post.md).

| | |
|---|---|
| **Base legal (LGPD)** | Art. 7º, V. **Minimização (Art. 6º, III):** o perfil público mostra só nome, categoria, foto, "membro desde" e número de posts — nunca cidade, e-mail, telefone ou interesses |
| **Status** | 🟡 Parcial — API, paginação por cursor, testes e protótipo prontos; seguir/deixar de seguir fica para outro RF |

## Critérios de aceite

1. Foto **e** nome do autor são um único link acessível (`<a>` com `aria-label="Ver perfil de {nome}"`) no
   card, no modal (RF24) e nos comentários (RF26).
2. O perfil mostra cabeçalho (foto, nome, glifo + rótulo da categoria, membro desde, nº de posts) e o
   **feed do autor**, mais recentes primeiro, com os mesmos cards e ações do feed principal.
3. Feed paginado por cursor opaco `(created_at, id)`: estável mesmo com posts novos chegando; 1–50 por página.
4. Entram `PUBLISHED` e `ARCHIVED`; rascunhos e removidos nunca.
5. Conta **suspensa** ou **eliminada**: o perfil responde 404; nos posts e comentários o nome aparece sem link
   ("Conta excluída" no caso de eliminação LGPD).

## Caso de uso

```mermaid
flowchart LR
    U([Usuário]) --> UC1[Tocar na foto ou no nome do autor]
    UC1 --> UC2[Ver perfil público]
    UC2 --> UC3[Rolar o feed do autor]
    UC3 --> UC4[Abrir um post · RF24]
    UC3 --> UC5[Interagir · RF26]
    UC1 -.conta suspensa ou eliminada.-> UC6[Nome sem link · nada abre]
```

## Sequência

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant APP as App
    participant API as UserProfileController
    participant Q as PostQueryService
    participant PG as PostgreSQL

    U->>APP: toca em "techblog.br" (card, modal ou comentário)
    par cabeçalho
        APP->>API: GET /api/v1/users/{id}/profile
        API->>Q: getProfile(id)
        Q->>PG: SELECT usuário WHERE id = ? (ACTIVE?)
        Q->>PG: COUNT posts PUBLISHED + ARCHIVED
        Q-->>APP: 200 PublicProfileView
    and primeira página
        APP->>API: GET /api/v1/users/{id}/posts?limit=20
        API->>Q: authorFeed(id, cursor=∅, 20, viewer?)
        Q->>PG: SELECT … ORDER BY created_at DESC, id DESC LIMIT 21
        Q->>PG: post_ids curtidos/salvos pelo viewer (1 consulta por tipo)
        Q-->>APP: 200 {items[20], nextCursor}
    end
    APP-->>U: perfil + feed
    U->>APP: chega ao fim da lista
    APP->>API: GET …/posts?cursor={nextCursor}
    API-->>APP: 200 {items, nextCursor = null}
    APP-->>U: "Você viu todos os posts de techblog.br"
```

## Paginação por cursor

```mermaid
flowchart TD
    A[pedido com limit e cursor opcional] --> B[limit = clamp 1..50]
    B --> C{tem cursor?}
    C -- não --> D[SELECT … LIMIT limit+1]
    C -- sim --> E{cursor decodifica?}
    E -- não --> F[400 Cursor de paginação inválido]
    E -- sim --> G["SELECT … WHERE (created_at, id) < (cursor) LIMIT limit+1"]
    D --> H{voltaram limit+1?}
    G --> H
    H -- sim --> I[devolve limit itens + nextCursor do último]
    H -- não --> J[devolve todos + nextCursor = null]
```

## Rastreabilidade

| Camada | Artefato | Situação |
|---|---|---|
| Persistência | índice parcial `idx_post_author_created`, `PostRepository.findAuthorFeed*`, `countByAuthorUserIdAndStatusIn` | ✅ |
| Aplicação / API | `PostQueryService.getProfile` / `authorFeed`, `AuthorDirectory`, `GET /api/v1/users/{id}/profile`, `GET /api/v1/users/{id}/posts` | ✅ |
| Testes | `PostApiIT.profileShowsOnlyPublicDataAndFeedPagesByCursor`, `FeedCursorTest` | ✅ |
| Tela | Protótipo: [10-perfil-autor](../../design/prototype/screens/10-perfil-autor.png); autor como link no card e no modal | ✅ protótipo |
| App | rota `/u/{id}` | ⏳ OS-39 |
| Identidade | `ViewerResolver` lê a sessão autenticada ([RF27](RF27-autenticacao-sessao.md)); o cabeçalho de dev `X-Orange-Dev-User` foi removido e os testes entram com login real (sessão + CSRF) | ✅ |
| Pendências | seguir/deixar de seguir e contagem de seguidores; bloquear/silenciar | ⏳ novo RF |
