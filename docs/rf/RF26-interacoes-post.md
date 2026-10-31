---
rf: RF26
titulo: Interações com contagem — curtir, comentar (caixa de mensagens), compartilhar e salvar
status: parcial
numeracao_provisoria: true
cards: [OS-58, OS-59]
paths:
  - src/main/java/com/orangesocial/application/post/PostInteractionService.java
  - src/main/java/com/orangesocial/domain/model/PostComment.java
  - src/main/java/com/orangesocial/domain/model/CommentStatus.java
  - src/main/java/com/orangesocial/domain/model/ReactionKind.java
  - src/main/java/com/orangesocial/domain/model/ShareChannel.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/PostCommentRepository.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/PostRepository.java
  - src/main/java/com/orangesocial/api/PostController.java
  - src/main/resources/db/migration/V2__posts_interactions.sql
  - design/prototype/index.html
  # app web (frontend/): telas, componentes e testes deste RF
  - frontend/apps/web/components/post/InteractionBar.tsx
  - frontend/apps/web/components/post/Comments.tsx
  - frontend/apps/web/lib/share.ts
  - frontend/apps/web/e2e/fixtures/comentarios.json
---

# RF26 · Interações com contagem

> **Como** usuário, **quero** curtir, comentar, compartilhar e salvar um post vendo quantas pessoas já
> fizeram o mesmo **para** participar da conversa e levar o conteúdo para fora do app.

> ⚠️ **Numeração provisória** — ver [RF24](RF24-visualizar-post.md).

| | |
|---|---|
| **Base legal (LGPD)** | Art. 7º, V. Curtidas e comentários são públicos; **salvar é privado** (ninguém mais vê nem conta). O link compartilhado não carrega quem compartilhou |
| **Eliminação** | Na exclusão de conta (RF23) curtidas somem, comentários perdem o texto, compartilhamentos perdem o vínculo e os contadores dos posts de terceiros são corrigidos (`PostContentEraser`) |
| **Status** | 🟡 Parcial — API idempotente, contadores atômicos, testes e protótipo prontos; tempo real, notificações e moderação ainda não |

## Critérios de aceite

1. **Um ícone, um significado** (DESIGN_SYSTEM.md §7), todos `<button>` com `aria-label` por extenso e
   `aria-pressed` quando alternam:

   | Ação | Ícone | Contagem | Ao tocar |
   |---|---|---|---|
   | Curtir | `heart` (preenchido quando ativo) | sim | alterna; número atualiza na hora |
   | Comentar | `message-circle` | sim | abre a **caixa de mensagens** (sheet) do post |
   | Compartilhar | `share-2` | sim | abre a **folha de compartilhamento** |
   | Salvar | `bookmark` (preenchido quando ativo) | não (privado) | alterna |

2. Curtir/descurtir e salvar são **idempotentes** (`PUT`/`DELETE`): repetir não muda o número.
3. Contador e linha de associação mudam **na mesma transação**; o contador só se move quando a linha
   entrou ou saiu de fato. Nunca `COUNT(*)` na leitura.
4. Caixa de mensagens: lista do mais antigo para o mais novo, paginada; campo com limite de 2.000
   caracteres e contador; quem escreveu ou o dono do post pode apagar; comentário vazio é recusado.
   A exclusão é **atômica** (`UPDATE … WHERE status = 'VISIBLE'`): se quem escreveu e o dono do post apagam ao
   mesmo tempo, só uma vale (`204`), a outra recebe `404` e o contador desce uma vez só.
5. Compartilhar: Web Share API / folha nativa quando houver; senão, folha própria com Copiar link,
   WhatsApp, Telegram, X e e-mail. O número conta **pares distintos (usuário, canal)**.
6. Exige conta **ativa**: anônimo recebe 401 ("Entre na sua conta…"), conta pendente/suspensa 403.
   Post arquivado: leitura sim, novas interações não (409).
7. Interface otimista: o botão muda na hora e volta atrás com aviso se a API falhar.
8. Alerta oficial do Alert Feed tem **só compartilhar** (sem curtidas e comentários); áudio e vaga têm as
   quatro ações.

## Caso de uso

```mermaid
flowchart LR
    U([Usuário ativo]) --> L[Curtir / descurtir]
    U --> C[Comentar na caixa de mensagens]
    U --> S[Compartilhar]
    U --> B[Salvar / remover dos salvos]
    C --> C2[Ler comentários]
    C --> C3[Apagar meu comentário]
    DONO([Dono do post]) --> C4[Apagar comentário na minha caixa]
    VIS([Visitante anônimo]) --> C2
    VIS -.tenta interagir.-> LOGIN[Convite para entrar · 401]
    S --> S1[Folha nativa]
    S --> S2[Copiar link · WhatsApp · Telegram · X · e-mail]
```

## Sequência · curtir (idempotente)

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant APP as App
    participant API as PostController
    participant S as PostInteractionService
    participant PG as PostgreSQL

    U->>APP: toca no coração (2,1 mil)
    APP->>APP: otimista: coração cheio, 2,1 mil → 2.101
    APP->>API: PUT /api/v1/posts/{id}/like
    API->>S: like(id, viewer)
    S->>PG: conta ativa? post visível e PUBLISHED?
    S->>PG: BEGIN
    S->>PG: INSERT post_reaction … ON CONFLICT DO NOTHING
    alt linha nova (1)
        S->>PG: UPDATE post SET like_count = like_count + 1
    else já curtido (0)
        Note over S,PG: nada muda — retry seguro
    end
    S->>PG: SELECT like_count (linha travada pela transação)
    S->>PG: COMMIT
    S-->>APP: 200 {liked: true, likes: 2101}
    APP->>APP: reconcilia com o valor do servidor
    opt erro 4xx/5xx
        APP-->>U: desfaz o otimista + aviso
    end
```

## Sequência · caixa de mensagens

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant APP as App
    participant API as PostController
    participant S as PostInteractionService
    participant PG as PostgreSQL

    U->>APP: toca no balão (184)
    APP->>APP: abre sheet "Comentários" (role=dialog, foco no campo)
    APP->>API: GET /api/v1/posts/{id}/comments?limit=20
    API->>S: listComments(id, after=0, 20, viewer?)
    S->>PG: SELECT … WHERE status = VISIBLE AND id > 0 ORDER BY id LIMIT 21
    S->>PG: autores da página (1 consulta)
    S-->>APP: 200 {items, nextAfter, total: 184}
    U->>APP: escreve e envia
    APP->>API: POST /api/v1/posts/{id}/comments {body}
    API->>S: addComment(id, viewer, body)
    S->>S: strip · 1..2000 caracteres
    S->>PG: INSERT post_comment · UPDATE comment_count + 1
    S-->>APP: 201 {comment, comments: 185}
    alt última página carregada é a final (nextAfter = null)
        APP-->>U: mensagem no fim da lista · contador 185 no card e no modal
    else ainda há páginas por carregar
        APP-->>U: só o contador sobe · a mensagem chega no fim, ao carregar mais (sem duplicar, lista única por id)
    end
    U->>APP: apaga o próprio comentário (o dono do post pode apagar ao mesmo tempo)
    APP->>API: DELETE /api/v1/posts/{id}/comments/{commentId}
    API->>S: removeComment(id, commentId, viewer)
    S->>S: quem escreveu ou dono do post? (senão 403)
    S->>PG: UPDATE post_comment SET status = REMOVED, body = NULL WHERE id = ? AND status = VISIBLE
    alt 0 linhas (a outra exclusão chegou antes)
        S-->>APP: 404 · o contador não mexe
        APP-->>U: "Este comentário já tinha sido apagado" · some da lista e a contagem é relida
    else 1 linha
        S->>PG: UPDATE comment_count - 1
        S-->>APP: 204
        APP-->>U: "Comentário apagado" · contador desce no card e no modal
    end
```

## Sequência · compartilhar

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant APP as App
    participant OS as Sistema (Web Share / folha nativa)
    participant API as PostController
    participant S as PostInteractionService
    participant PG as PostgreSQL

    U->>APP: toca em compartilhar (57)
    alt navigator.share disponível
        APP->>OS: share({title, url: shareUrl})
        OS-->>APP: concluído (canal NATIVE)
    else folha própria
        APP-->>U: Copiar link · WhatsApp · Telegram · X · e-mail
        U->>APP: escolhe WhatsApp
        APP->>APP: abre wa.me/?text=título + shareUrl
    end
    APP->>API: POST /api/v1/posts/{id}/shares {channel}
    API->>S: share(id, viewer, channel)
    S->>PG: INSERT post_share … ON CONFLICT (post, usuário, canal) DO NOTHING
    opt primeira vez neste canal
        S->>PG: UPDATE share_count + 1
    end
    S-->>APP: 200 {shareUrl, shares: 58, counted: true}
```

## Estados do botão de curtir

```mermaid
stateDiagram-v2
    [*] --> NaoCurtido
    NaoCurtido --> CurtindoOtimista : toque
    CurtindoOtimista --> Curtido : 200
    CurtindoOtimista --> NaoCurtido : erro (desfaz + aviso)
    Curtido --> DescurtindoOtimista : toque
    DescurtindoOtimista --> NaoCurtido : 200
    DescurtindoOtimista --> Curtido : erro (desfaz + aviso)
    NaoCurtido --> Bloqueado : post arquivado / visitante
    Bloqueado --> [*]
```

## Modelo de dados

```mermaid
erDiagram
    VSusercontrolist ||--o{ post : publica
    post ||--o{ post_reaction : recebe
    post ||--o{ post_comment : recebe
    post ||--o{ post_share : recebe
    VSusercontrolist ||--o{ post_reaction : faz
    VSusercontrolist ||--o{ post_comment : escreve
    VSusercontrolist |o--o{ post_share : "faz (NULL após LGPD)"
    post {
        uuid id PK "UUIDv7"
        bigint author_user_id FK
        varchar status "DRAFT PUBLISHED ARCHIVED REMOVED"
        bigint like_count
        bigint comment_count
        bigint share_count
        timestamptz created_at "data de publicação"
    }
    post_reaction {
        uuid post_id PK
        bigint user_id PK
        varchar kind PK "LIKE SAVE"
    }
    post_comment {
        bigint id PK
        uuid post_id FK
        bigint author_user_id FK
        varchar body "NULL se removido"
        varchar status "VISIBLE REMOVED"
    }
    post_share {
        bigint id PK
        uuid post_id FK
        bigint user_id FK "UK com post e canal"
        varchar channel
    }
```

## Telas no app web

A barra de interações (`InteractionBar`) fica no card, no modal e na página do post: curtir e salvar são
otimistas e reconciliam com o número do servidor (o nome acessível traz o número por extenso, ex.: "Curtir, 2,1 mil
(2.101 curtidas)"); visitante que toca em curtir vai para `/entrar?voltar=…`. A caixa de mensagens (`Comments`)
pagina por `after`, conta 0/2.000 caracteres e confirma antes de apagar; o comentário novo só entra direto na lista
quando a última página carregada é a final (senão chega na sua vez, ao carregar mais) e a lista é única por id; o `404` da segunda exclusão tira o
comentário da lista e relê a contagem. Compartilhar usa a folha nativa quando existe e senão a folha com os canais
(`lib/share.ts`). Post arquivado mostra as ações desabilitadas com o motivo; alerta oficial só tem compartilhar.

```mermaid
flowchart LR
    U([Usuário ativo]) --> BAR["InteractionBar<br/>curtir, comentar, compartilhar, salvar"]
    BAR -->|PUT e DELETE like e save| API[PostController]
    BAR --> COM["Comments<br/>página por after, 0 a 2.000"]
    COM -->|POST e DELETE comments| API
    COM -.com páginas pendentes.-> FIM["Novo comentário chega<br/>ao carregar mais, sem duplicar"]
    API -.404 na segunda exclusão.-> SOME["Tira da lista<br/>e relê a contagem"]
    BAR --> SH["lib/share<br/>folha nativa ou canais"]
    SH -->|POST shares com o canal| API
    V([Visitante]) -.toque em curtir.-> LOGIN["Rota /entrar com voltar"]
```

## Rastreabilidade

| Camada | Artefato | Situação |
|---|---|---|
| Domínio | `PostComment` (trim, limite, quem pode apagar), `ReactionKind`, `ShareChannel`, `CommentStatus` | ✅ |
| Persistência | `post_reaction`, `post_comment`, `post_share` (V2); `PostRepository` (insert/delete idempotentes, contadores), `PostCommentRepository` (`removeIfVisible`: exclusão atômica) | ✅ |
| Aplicação / API | `PostInteractionService`; `PUT/DELETE …/like`, `PUT/DELETE …/save`, `GET/POST …/comments`, `DELETE …/comments/{id}`, `POST …/shares` | ✅ |
| Testes | `PostDomainTest.commentIsTrimmedValidatedAndRemovableByWriterOrPostOwner`; `PostApiIT` (curtir idempotente, 401/403/409, caixa de comentários, compartilhar por canal, eliminação LGPD; `removingTheSameCommentTwiceDecrementsTheCounterOnce`: autor e dono do post apagam em paralelo em 5 rodadas) | ✅ |
| Tela | Protótipo: botões com contagem em [01-post-feed](../../design/prototype/screens/01-post-feed.png), [11-comentarios](../../design/prototype/screens/11-comentarios.png), [12-compartilhar](../../design/prototype/screens/12-compartilhar.png) | ✅ protótipo |
| Identidade | `ViewerResolver` lê a sessão autenticada ([RF27](RF27-autenticacao-sessao.md)); o cabeçalho de dev `X-Orange-Dev-User` foi removido e os testes entram com login real (sessão + CSRF) | ✅ |
| Telas (app web) | `InteractionBar`, `Comments`, `lib/share.ts` (no card, no modal e na página do post); `e2e/post.spec.ts` (curtir, salvar, comentar com contador, apagar e compartilhar com `aria-live`; número compacto e por extenso; visitante vai ao login; segunda exclusão com 404 tira da lista e avisa; comentar com páginas pendentes não duplica e o novo chega no fim) | ✅ web (OS-58) · ⏳ mobile (OS-39) |
| Pendências | tempo real dos contadores (SSE, OS-2B); notificação ao autor (OS-27); moderação de comentários (OS-4D); rate limit (OS-47); repost como ação separada | ⏳ OS-59 |
