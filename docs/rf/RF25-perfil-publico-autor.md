---
rf: RF25
titulo: Perfil público do autor com o feed dele (toque na foto ou no nome)
status: parcial
numeracao_provisoria: true
cards: [OS-57, OS-35]
paths:
  - src/main/java/com/orangesocial/api/UserProfileController.java
  - src/main/java/com/orangesocial/application/post/PostQueryService.java
  - src/main/java/com/orangesocial/application/post/AuthorDirectory.java
  - src/main/java/com/orangesocial/application/post/PostViews.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/PostRepository.java
  - src/main/resources/db/migration/V2__posts_interactions.sql
  - design/prototype/index.html
  # app web (frontend/): telas, componentes e testes deste RF
  - frontend/apps/web/app/?feeds?/u/?id?/page.tsx
  - frontend/apps/web/components/profile/ProfileView.tsx
  - frontend/apps/web/components/feed/ProfilesPanel.tsx
  - frontend/apps/web/e2e/perfil.spec.ts
  - frontend/apps/web/e2e/fixtures/perfis.json
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
6. **Compartilhar o perfil:** o perfil traz `shareUrl` = `{orange-social.public-base-url}/u/{id}`, a rota do
   perfil no app web, sem rastrear quem compartilhou. Nada de `/@handle`, que não tem rota no app e dava 404 no
   Friendly Eats; o `@` também pode mudar, o id não.

## Caso de uso

```mermaid
flowchart LR
    U([Usuário]) --> UC1[Tocar na foto ou no nome do autor]
    UC1 --> UC2[Ver perfil público]
    UC2 --> UC3[Rolar o feed do autor]
    UC3 --> UC4[Abrir um post · RF24]
    UC3 --> UC5[Interagir · RF26]
    UC2 --> UC7[Compartilhar o perfil<br/>link /u/id]
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
        Q-->>APP: 200 PublicProfileView {…, postsPath, shareUrl: …/u/{id}}
    and primeira página
        APP->>API: GET /api/v1/users/{id}/posts?limit=20
        API->>Q: authorFeed(id, cursor=∅, 20, viewer?)
        Q->>PG: findProfileFeed · SELECT … ORDER BY created_at DESC, id DESC LIMIT 21
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

## Telas no app web

`/u/[id]` (dentro do grupo dos feeds, então o modal do post também abre por cima do perfil): cabeçalho mínimo
(nome, categoria com glifo, foto ou iniciais, "membro desde", número de posts), o botão "Copiar link do perfil"
com o `shareUrl` e o feed do autor por cursor. Conta suspensa ou eliminada dá 404 com a mensagem de perfil
indisponível. A aba **Perfis** da home (Profile Feed) já tem a tela (`ProfilesPanel`), mas espera
`GET /api/v1/users`.

```mermaid
flowchart LR
    U([Visitante ou usuário]) --> NOME["Nome ou foto do autor<br/>card, modal ou comentário"]
    NOME --> PERF["Rota /u/id<br/>ProfileView"]
    PERF -->|GET /api/v1/users/id/profile| API[UserProfileController]
    PERF -->|GET /api/v1/users/id/posts por cursor| API
    PERF --> LINK["Copiar link do perfil<br/>shareUrl em /u/id"]
    U --> ABA["Aba Perfis da home<br/>ProfilesPanel"]
    ABA -.⏳ GET /api/v1/users com filtros.-> FALTA["Profile Feed<br/>aguarda a API"]:::planned
    classDef planned stroke-dasharray:5 4
```

## Rastreabilidade

| Camada | Artefato | Situação |
|---|---|---|
| Persistência | índice parcial `idx_post_author_created`, `PostRepository.findProfileFeed*` (antes `findAuthorFeed*`: o CodeQL marca como sensível método com "auth" no nome escolhido por dado do pedido; o cursor só escolhe a página, o acesso é conferido antes), `countByAuthorUserIdAndStatusIn` | ✅ |
| Aplicação / API | `PostQueryService.getProfile` / `authorFeed`, `AuthorDirectory`, `GET /api/v1/users/{id}/profile`, `GET /api/v1/users/{id}/posts`; `PublicLinks.profileShareUrl` → `shareUrl` `/u/{id}` | ✅ |
| Testes | `PostApiIT.profileShowsOnlyPublicDataAndFeedPagesByCursor` (inclui `shareUrl` = `http://localhost:3000/u/{id}`), `FeedCursorTest` | ✅ |
| Tela | Protótipo: [10-perfil-autor](../../design/prototype/screens/10-perfil-autor.png); autor como link no card e no modal | ✅ protótipo |
| Telas (app web) | `/u/[id]` (`(feeds)/u/[id]/page.tsx`, `ProfileView`, `shareUrl` copiado); aba Perfis (`ProfilesPanel`); `e2e/perfil.spec.ts` (nome no card leva ao perfil, cabeçalho mínimo, membro desde, posts e link; arquivado só para o autor; inexistente dá 404) e o teste "perfis" de `e2e/feed.spec.ts` | ✅ web · ⏳ mobile (OS-39) |
| Profile Feed | `GET /api/v1/users` com categoria, local, país, cidade e nome → `ProfilePageView` de `ProfileCardView` (`verified`, cidade/UF/país só se a visibilidade do titular permitir, `interests`): contrato proposto em `frontend/packages/api/src/types.ts`, a tela diz que aguarda a API | ⏳ OS-26, OS-35 |
| Identidade | `ViewerResolver` lê a sessão autenticada ([RF27](RF27-autenticacao-sessao.md)); o cabeçalho de dev `X-Orange-Dev-User` foi removido e os testes entram com login real (sessão + CSRF) | ✅ |
| Moldura | cada card do feed do autor traz `background` resolvido ([RF28](RF28-moldura-post.md)), sem consulta extra (vem da linha do `post`) | ✅ |
| Pendências | seguir/deixar de seguir e contagem de seguidores; bloquear/silenciar | ⏳ novo RF |
