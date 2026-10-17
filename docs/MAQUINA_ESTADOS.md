# Máquinas de Estados — Orange Social

## 1. Ciclo de vida do Usuário (`AccountStatus`)

Implementado em `com.orangesocial.domain.model.AccountStatus#allowedTransitions()`.

```mermaid
stateDiagram-v2
    direction LR

    [*] --> Pending_Verification : cadastro concluído\n(RF1)

    Pending_Verification --> Active : e-mail/SMS confirmado
    Pending_Verification --> Anonymous_LGPD_Deleted : TTL de verificação expirado (7 dias)\nou titular desiste

    Active --> Suspended : violação de termos\nou denúncia procedente
    Active --> Pending_Deletion : "Excluir conta" no modal\nsenha + 2FA (Art. 18, VI)
    Pending_Verification --> Pending_Deletion : "Excluir conta"

    Suspended --> Active : recurso aceito\nou fim da penalidade
    Suspended --> Pending_Deletion : "Excluir conta"

    Pending_Deletion --> Active : entra e reativa em até 30 dias\n(volta ao status anterior)
    Pending_Deletion --> Anonymous_LGPD_Deleted : 30 dias sem reativar\n(job diário · saga RF23)

    Anonymous_LGPD_Deleted --> [*]

    state Active {
        direction LR
        [*] --> Online
        Online --> Idle : sessão Valkey expira (60 min ocioso · 24 h)
        Idle --> Online : novo login (sessão opaca, RF27)
    }

    note right of Anonymous_LGPD_Deleted
        Estado terminal.
        PostgreSQL: dados pessoais anonimizados, id mantido.
        S3: foto e mídias apagadas.
        Cassandra: partições da timeline removidas.
        Valkey: sessões e rankings do usuário removidos.
    end note
```

| Transição | Disparador | Efeitos colaterais |
|---|---|---|
| `[*] → Pending_Verification` | `POST /api/v1/users` | Grava `VSusercontrolist`, cria consentimentos com `granted=false` (Privacy by Default), envia código |
| `Pending_Verification → Active` | Código de e-mail validado (`POST /api/v1/me/verify-email`) | Grava `email_verified_at`; a sessão aberta no cadastro passa a poder interagir |
| `Active → Suspended` | Moderação | Apaga as sessões do usuário no Valkey, oculta posts do ranking |
| `Suspended → Active` | Recurso aceito | Restaura posts no ranking |
| `* → Pending_Deletion` | Titular confirma no modal com senha (+2FA) | Guarda o status anterior, agenda para +30 dias, apaga **todas** as sessões; perfil e posts somem |
| `Pending_Deletion → (status anterior)` | Login no prazo + "Reativar" | Limpa as datas da exclusão |
| `Pending_Deletion → Anonymous_LGPD_Deleted` | `AccountDeletionJob` após 30 dias | `PostContentEraser`, apaga 2FA/preferências, anonimiza (sem @ e `type_details`) + log em `activity_log` |

---

## 2. Ciclo de vida da Postagem (`PostStatus`)

```mermaid
stateDiagram-v2
    direction LR

    [*] --> Draft : usuário inicia o post

    Draft --> Draft : salvar rascunho
    Draft --> Published : publicar\n(mídia já no S3)
    Draft --> [*] : descartar

    Published --> Trending : score ≥ limiar do feed\n(top N do ZSET)
    Trending --> Published : score cai abaixo do limiar

    Published --> Archived : autor arquiva\nou idade > janela do feed
    Trending --> Archived : autor arquiva

    Published --> Removed : moderação / denúncia procedente
    Trending --> Removed : moderação / denúncia procedente
    Published --> Removed : autor eliminado (LGPD)

    Archived --> Published : autor restaura
    Archived --> Removed : autor apaga

    Removed --> [*]

    state Published {
        direction LR
        [*] --> Visible
        Visible --> UnderReview : denúncia recebida
        UnderReview --> Visible : denúncia improcedente
    }
```

| Estado | Visível no feed | No Valkey ZSET | Na timeline Cassandra |
|---|---|---|---|
| `Draft` | Não | Não | Não |
| `Published` | Sim | Sim | Sim |
| `Trending` | Sim (destaque 🔥/📈) | Sim (top N) | Sim |
| `Archived` | Só no perfil do autor | Removido (`ZREM`) | Mantido até TTL |
| `Removed` | Não | Removido | Removido |

Implementação: `PostStatus` + `Post.publish/archive/remove` (`Trending` é derivado do ZSET, não persistido).
Detalhe e interações por estado ([RF24](rf/RF24-visualizar-post.md), [RF26](rf/RF26-interacoes-post.md)):

| Estado | Abre no modal | Curtir / comentar / compartilhar | Feed do autor ([RF25](rf/RF25-perfil-publico-autor.md)) |
|---|---|---|---|
| `Draft` | Só o autor | Não (409) | Não |
| `Published` | Todos | Sim | Sim |
| `Archived` | Todos | Não (409); descurtir continua permitido | Sim |
| `Removed` | Ninguém (404) | Não | Não |

## 2.1 Comentário (`CommentStatus`)

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Visible : POST …/comments (1–2000 caracteres)
    Visible --> Removed : quem escreveu ou dono do post apaga
    Visible --> Removed : moderação
    Visible --> Removed : eliminação LGPD do autor (texto apagado)
    Removed --> [*]
```

Remover apaga o texto (`body = NULL`), decrementa `post.comment_count` e mantém o id para auditoria.
