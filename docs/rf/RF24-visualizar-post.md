---
rf: RF24
titulo: Visualizar post em detalhe (modal com dados completos e data de publicação)
status: parcial
numeracao_provisoria: true
cards: [OS-56]
paths:
  - src/main/java/com/orangesocial/domain/model/Post.java
  - src/main/java/com/orangesocial/domain/model/PostStatus.java
  - src/main/java/com/orangesocial/domain/model/AgeRating.java
  - src/main/java/com/orangesocial/domain/model/MediaType.java
  - src/main/java/com/orangesocial/domain/model/UuidV7.java
  - src/main/java/com/orangesocial/application/post/PostQueryService.java
  - src/main/java/com/orangesocial/application/post/PostViews.java
  - src/main/java/com/orangesocial/application/post/PostExceptions.java
  - src/main/java/com/orangesocial/application/post/PublicLinks.java
  - src/main/java/com/orangesocial/application/post/AuthorDirectory.java
  - src/main/java/com/orangesocial/api/PostController.java
  - src/main/java/com/orangesocial/api/ViewerResolver.java
  - src/main/java/com/orangesocial/api/ApiExceptionHandler.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/PostRepository.java
  - src/main/resources/db/migration/V2__posts_interactions.sql
  - design/prototype/index.html
---

# RF24 · Visualizar post em detalhe

> **Como** usuário, **quero** tocar em um post do feed e ver tudo sobre ele num modal — conteúdo completo,
> dono da publicação, data e as interações — **para** decidir se curto, comento ou compartilho sem perder
> meu lugar no feed.

> ⚠️ **Numeração provisória.** RF4–RF22 não estão no repositório; RF24–RF26 foram numerados depois do
> último RF conhecido (RF23) para não colidir. Renumerar quando a lista oficial chegar.

| | |
|---|---|
| **Origem** | Auditoria de 2026-10-17: o card não abria nada; a data era só relativa |
| **Base legal (LGPD)** | Art. 7º, V (execução do serviço). Visitante anônimo lê post público sem nenhum dado pessoal tratado |
| **Status** | 🟡 Parcial — API, regras de visibilidade, testes e protótipo prontos; app web/mobile (OS-39) ainda não |

## Critérios de aceite

1. Tocar em qualquer parte do card (exceto botões de ação e autor) abre o **modal** com título, subtítulo,
   texto completo, mídia, classificação, local, autor, contagens e estado dos botões de quem está vendo.
2. **Data de publicação:** o card mostra o tempo relativo ("3 min") dentro de `<time datetime>` com a data
   absoluta no tooltip; o modal mostra a data absoluta no fuso do usuário ("17 de out. de 2026, 09:41").
   A API sempre devolve `publishedAt` em ISO-8601 UTC.
3. Modal acessível: `role="dialog"`, `aria-modal`, foco preso dentro, `Esc` e o botão "Fechar" devolvem o
   foco ao card de origem; a URL muda para `/p/{id}` (link compartilhável abre o mesmo modal).
4. Rascunho só abre para o autor; post removido ou de autor suspenso responde **404** sem dizer o motivo.
5. Post arquivado abre, mas com `interactionsOpen = false` (botões desabilitados com explicação).

## Caso de uso

```mermaid
flowchart LR
    U([Usuário]) --> UC1[Abrir post no modal]
    VIS([Visitante anônimo]) --> UC1
    UC1 --> UC2[Ver conteúdo completo e mídia]
    UC1 --> UC3[Ver data absoluta da publicação]
    UC1 --> UC4[Ver dono da publicação]
    UC4 -.toque na foto ou no nome.-> RF25[[RF25 · Perfil do autor]]
    UC1 -.curtir, comentar, compartilhar, salvar.-> RF26[[RF26 · Interações]]
    UC1 --> UC5[Fechar e voltar ao mesmo ponto do feed]
```

## Sequência

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant APP as App (feed)
    participant API as PostController
    participant Q as PostQueryService
    participant PG as PostgreSQL

    U->>APP: toca no card
    APP->>APP: abre modal com os dados do card (skeleton no corpo)
    APP->>API: GET /api/v1/posts/{id}
    API->>Q: getPost(id, viewer?)
    Q->>PG: SELECT post WHERE id = ?
    alt inexistente, removido ou rascunho de outro
        Q-->>APP: 404 Problem Details
        APP-->>U: "Este post não está mais disponível"
    else visível
        Q->>PG: SELECT autor (status ACTIVE?)
        Q->>PG: EXISTS reação LIKE / SAVE do viewer
        Q-->>API: PostDetailView
        API-->>APP: 200 {title, body, mediaUrl, publishedAt, author, counts, viewer, shareUrl}
        APP->>APP: formata publishedAt no fuso do aparelho (Intl.DateTimeFormat pt-BR)
        APP-->>U: modal completo · foco no título
    end
    U->>APP: Esc / Fechar
    APP-->>U: fecha e devolve o foco ao card
```

## Estados do modal

```mermaid
stateDiagram-v2
    [*] --> Fechado
    Fechado --> Carregando : toque no card / abrir /p/{id}
    Carregando --> Aberto : 200
    Carregando --> Indisponivel : 404
    Carregando --> ErroRede : falha de rede
    ErroRede --> Carregando : tentar de novo
    Aberto --> Aberto : curtir · comentar · compartilhar (RF26)
    Aberto --> PerfilAutor : toque na foto ou no nome (RF25)
    Aberto --> Fechado : Esc · Fechar · voltar
    Indisponivel --> Fechado : Fechar
    PerfilAutor --> [*]
```

## Regras de visibilidade

```mermaid
flowchart TD
    A[GET /api/v1/posts/id] --> B{post existe?}
    B -- não --> N404[404]
    B -- sim --> C{status}
    C -- REMOVED --> N404
    C -- DRAFT --> D{viewer é o autor?}
    D -- não --> N404
    D -- sim --> E
    C -- PUBLISHED ou ARCHIVED --> E{autor ACTIVE?}
    E -- não --> F{viewer é o autor?}
    F -- não --> N404
    F -- sim --> OK
    E -- sim --> OK[200 PostDetailView]
    OK --> G{status = PUBLISHED?}
    G -- sim --> H[interactionsOpen = true]
    G -- não --> I[interactionsOpen = false]
```

## Contrato (resumo)

`GET /api/v1/posts/{id}` → `200`

```json
{
  "id": "0192f0c2-8a00-7000-8000-000000000001",
  "feed": "POST", "mediaType": "VIDEO",
  "title": "O que ninguém te conta sobre começar a programar",
  "subtitle": "Seis meses depois", "body": "Texto completo…",
  "mediaUrl": "https://cdn…/posts/video.mp4", "ageRating": "LIVRE", "ageRatingLabel": "Livre",
  "publishedAt": "2026-10-17T12:41:00Z",
  "author": { "id": 1, "name": "techblog.br", "category": { "code": "AMARELO", "label": "Networking", "color": "#F7C948" },
              "avatarUrl": "https://cdn…/users/1/avatar.webp", "profilePath": "/api/v1/users/1/profile", "available": true },
  "counts": { "likes": 2100, "comments": 184, "shares": 57, "views": 0 },
  "viewer": { "liked": false, "saved": false, "isAuthor": false },
  "interactionsOpen": true,
  "shareUrl": "https://orange…/p/0192f0c2-…",
  "background": { "artKind": "AURA_PLUS", "artId": "brasa", "palette": [], "css": null,
                  "auraPlus": { "poster": "…/brasa-poster.webp", "av1": "…/brasa-hq.mp4", "h264": "…/brasa-leve.mp4", "loopSeconds": 4, "maxPlaySeconds": 5 },
                  "container": { "color": "#211A12", "ink": "#F5EDE3", "contrast": "14,8:1" }, "config": { "v": 1, "…": "…" } }
}
```

Erros em Problem Details (RFC 9457) com `detail` em pt-BR. Identidade: a sessão opaca criada pelo login
([RF27](RF27-autenticacao-sessao.md)); sem sessão — inclusive numa aba anônima — o modal abre como visitante.

## Rastreabilidade

| Camada | Artefato | Situação |
|---|---|---|
| Domínio | `Post` (`isVisibleTo`, `acceptsInteractions`, contadores somente leitura), `PostStatus`, `AgeRating`, `MediaType`, `UuidV7` | ✅ |
| Persistência | `V2__posts_interactions.sql` (`post`), `PostRepository` | ✅ |
| Aplicação / API | `PostQueryService.getPost`, `GET /api/v1/posts/{id}`, `ApiExceptionHandler` | ✅ |
| Testes | `PostDomainTest`, `PostApiIT.anonymousVisitorOpensFullPostWithAuthorDateAndCounts`, `PostApiIT.draftOfSomeoneElseRemovedPostAndSuspendedAuthorAnswer404` | ✅ |
| Tela | Protótipo: modal [09-post-modal](../../design/prototype/screens/09-post-modal.png); card com `<time>` e tooltip em [01-post-feed](../../design/prototype/screens/01-post-feed.png) | ✅ protótipo |
| App | modal em Next.js/Expo, rota `/p/{id}` | ⏳ OS-39 |
| Identidade | `ViewerResolver` lê a sessão autenticada ([RF27](RF27-autenticacao-sessao.md)); o cabeçalho de dev `X-Orange-Dev-User` foi removido e os testes entram com login real (sessão + CSRF) | ✅ |
| Moldura | `background` resolvido no detalhe ([RF28](RF28-moldura-post.md)): `null` = moldura padrão; a arte nunca cobre o conteúdo do modal | ✅ |
| Pendências | contagem de visualizações (HyperLogLog, OS-21); bloqueio por idade para conteúdo 16+/18+ (OS-49) | ⏳ |
