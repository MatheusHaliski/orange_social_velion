# Máquinas de Estados — Orange Social

## 1. Ciclo de vida do Usuário (`AccountStatus`)

Implementado em `com.orangesocial.domain.model.AccountStatus#allowedTransitions()`.

```mermaid
stateDiagram-v2
    direction LR

    [*] --> Pending_Verification : cadastro concluído<br/>(RF1)

    Pending_Verification --> Active : código do e-mail confirmado
    Pending_Verification --> Anonymous_LGPD_Deleted : 7 dias sem confirmar (⏳ job de limpeza)

    Active --> Suspended : violação de termos<br/>ou denúncia procedente
    Active --> Pending_Deletion : "Excluir conta" no modal<br/>senha + 2FA (Art. 18, VI)
    Pending_Verification --> Pending_Deletion : "Excluir conta"

    Suspended --> Active : recurso aceito<br/>ou fim da penalidade
    Suspended --> Pending_Deletion : "Excluir conta"

    Pending_Deletion --> Active : entra e reativa em até 30 dias<br/>(volta ao status anterior)
    Pending_Deletion --> Anonymous_LGPD_Deleted : 30 dias sem reativar<br/>(job diário · saga RF23)

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
| `[*] → Pending_Verification` | `POST /api/v1/auth/register` | Grava `VSusercontrolist`, cria consentimentos com `granted=false` (Privacy by Default), envia código |
| `Pending_Verification → Active` | Código de e-mail validado (`POST /api/v1/me/verify-email`) | Grava `email_verified_at`; a sessão aberta no cadastro passa a poder interagir |
| `Active → Suspended` | Moderação (⏳ papel e painel) | Apaga as sessões do usuário no Valkey, oculta posts do ranking |
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
    Draft --> Published : publicar<br/>(mídia já no S3)
    Draft --> [*] : descartar

    Published --> Trending : score ≥ limiar do feed<br/>(top N do ZSET)
    Trending --> Published : score cai abaixo do limiar

    Published --> Archived : autor arquiva<br/>ou idade > janela do feed
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

Implementação: `PostStatus` + `Post.publish/archive/remove` (`Trending` é derivado do ZSET, não persistido). O autor
publica, arquiva, restaura e apaga pela API do [RF29](rf/RF29-publicar-post.md). A criação já publica direto, e o rascunho
ainda não é criado pela API (⏳).
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

---

## 3. Selo da categoria (`CategoryVerification`)

Implementado em `UserTypeDetailsValidator.initialVerification` (cadastro) e `ProfileService` (edição).
A decisão `VERIFIED`/`REJECTED` é da moderação (⏳ painel).

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Not_Required : cadastro VERDE, AMARELO, AZUL,<br/>LARANJA ou PRETO não banco
    [*] --> Pending : cadastro VERMELHO<br/>ou PRETO banco
    Pending --> Verified : moderação confere CNPJ,<br/>domínio e representante
    Pending --> Rejected : dados não conferem
    Rejected --> Pending : titular corrige os dados (⏳)
    Verified --> Pending : titular muda nome, @<br/>ou dados do tipo
    note right of Verified
        Só VERMELHO verificado
        publica alerta oficial.
    end note
```

| Estado | Pode publicar como instituição / banco | Selo no perfil |
|---|---|---|
| `NOT_REQUIRED` | não se aplica | — |
| `PENDING` | não (lê e interage normalmente) | "em verificação" |
| `VERIFIED` | sim; VERMELHO também publica alerta | ✓ verificado |
| `REJECTED` | não | — |

## 4. Login em etapas (`PendingLogin`)

A meia-sessão guarda só `{userId, etapa, expira, tentativas}`; ela não dá acesso a nada. Senha errada mantém o
visitante onde está, com espera progressiva a partir da 5ª falha (`LoginThrottle`). Detalhe do lado do
navegador em [RF27 · Estados da sessão](rf/RF27-autenticacao-sessao.md#estados-da-sessão-no-navegador).

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Visitante
    Visitante --> Etapa_MFA : senha certa + 2FA ativo
    Visitante --> Etapa_Reativacao : senha certa + conta em exclusão
    Visitante --> Autenticada : senha certa
    Etapa_MFA --> Autenticada : código válido (anti-replay)
    Etapa_MFA --> Etapa_Reativacao : código válido + conta em exclusão
    Etapa_MFA --> Visitante : 5 erros ou 5 min
    Etapa_Reativacao --> Autenticada : "Reativar minha conta"
    Etapa_Reativacao --> Visitante : "Manter a exclusão e sair" ou 5 min
    Autenticada --> Visitante : Sair · 60 min ocioso · 24 h ·<br/>encerrada em outro aparelho
    note right of Autenticada
        changeSessionId: o id da sessão
        muda ao entrar (anti-fixação).
    end note
```
